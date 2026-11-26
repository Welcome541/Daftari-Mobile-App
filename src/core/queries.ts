import type {
  Account,
  AccountData,
  Customer,
  CustomerFilter,
  DaftariDB,
  FeedFilter,
  Invoice,
  LedgerIndexes,
  Payment,
  ReportFilter,
} from '../types/daftari';
import { translate } from './i18n';
import { custOpen, getCust, isToday, lastAct } from './ledger';
import { D, dateStrText, fmt, getMU, normAr, opHasTime, pdig, timeStrText } from './format';

export interface FeedTx {
  kind: 'debt' | 'pay';
  ts: number;
  cust: string | null;
  amt: number;
  note: string;
  inv: string | null;
  key: string;
  hasTime: boolean;
  createdAt: number;
}

export function txAll(db: DaftariDB, d: AccountData): FeedTx[] {
  const arr: FeedTx[] = [];
  (d.invoices || []).forEach((i: Invoice) => {
    if (i.arch) return;
    arr.push({
      kind: 'debt',
      ts: i.ts,
      cust: i.cust,
      amt: i.amount,
      note: i.note || '',
      inv: i.id,
      key: 'd:' + i.id,
      hasTime: typeof i.hasTime === 'boolean' ? i.hasTime : opHasTime(i),
      createdAt: i.createdAt || i.ts,
    });
  });
  (d.payments || []).forEach((p: Payment) => {
    if (p.arch) return;
    arr.push({
      kind: 'pay',
      ts: p.ts,
      cust: p.cust,
      amt: p.amount,
      note: translate(db, p.method),
      inv: null,
      key: 'p:' + p.id,
      hasTime: typeof p.hasTime === 'boolean' ? p.hasTime : opHasTime(p),
      createdAt: p.createdAt || p.ts,
    });
  });
  return arr;
}

export function filteredTx(
  db: DaftariDB,
  d: AccountData,
  tf: FeedFilter,
  tq: string,
  txLimit: number
): { items: FeedTx[]; fullCount: number } {
  let list = txAll(db, d);
  if (tf.kind === 'debt') list = list.filter((x) => x.kind === 'debt');
  if (tf.kind === 'pay') list = list.filter((x) => x.kind === 'pay');
  if (tf.period === 'today') list = list.filter((x) => isToday(x.ts));
  if (tf.period === 'week') list = list.filter((x) => Date.now() - x.ts < 7 * D);
  if (tf.period === 'month') list = list.filter((x) => Date.now() - x.ts < 30 * D);
  if (tq) {
    const q = normAr(tq);
    list = list.filter((x) => {
      const c = getCust(d, x.cust);
      return (c && normAr(c.name).includes(q)) || normAr(x.note || '').includes(q);
    });
  }
  list = list.sort((x, y) => y.ts - x.ts);
  return {
    fullCount: list.length,
    items: list.slice(0, txLimit || 60),
  };
}

export function filteredCustomers(
  d: AccountData,
  ix: LedgerIndexes,
  f: CustomerFilter,
  cq: string
): Customer[] {
  const qNorm = normAr(cq || '');
  const qDigits = pdig(cq);
  let list = (d.customers || []).filter((c) => !c.archived);
  if (qNorm) {
    list = list.filter(
      (c) => normAr(c.name).includes(qNorm) || (qDigits.length >= 3 && pdig(c.phone).endsWith(qDigits))
    );
  }
  if (f.status === 'owed') list = list.filter((c) => custOpen(ix, c.id) > 0);
  if (f.status === 'none' || (f.status as string) === 'noDebt') {
    list = list.filter((c) => custOpen(ix, c.id) <= 0);
  }
  list.sort(
    (a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      (f.sort === 'name'
        ? String(a.name).localeCompare(String(b.name), 'ar')
        : f.sort === 'debt'
        ? custOpen(ix, b.id) - custOpen(ix, a.id)
        : f.sort === 'low'
        ? custOpen(ix, a.id) - custOpen(ix, b.id)
        : lastAct(ix, b.id) - lastAct(ix, a.id))
  );
  return list;
}

export function repRangeCalc(rp: ReportFilter): [number, number] {
  const now = new Date();
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const mode = rp.mode || 'week';
  let a: number;
  let b: number;
  if (mode === 'day') {
    const d = rp.day ? new Date(rp.day + 'T00:00:00') : new Date(d0);
    a = +d;
    b = a + D;
  } else if (mode === 'week') {
    const d = rp.day ? new Date(rp.day + 'T00:00:00') : new Date(d0);
    a = +d;
    b = a + 7 * D;
  } else if (mode === 'range') {
    a = rp.from ? +new Date(rp.from + 'T00:00:00') : +d0;
    b = (rp.to ? +new Date(rp.to + 'T00:00:00') : +d0) + D;
    if (a > b) {
      const tmp = a;
      a = b;
      b = tmp;
    }
  } else {
    const d = rp.month ? new Date(rp.month + '-01T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
    a = +d;
    b = +new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return [a, b];
}

export function repData(d: AccountData, rp: ReportFilter) {
  const [a, b] = repRangeCalc(rp);
  const cid = rp.cust || null;
  const invs = (d.invoices || []).filter((i) => !i.arch && i.ts >= a && i.ts < b && (!cid || i.cust === cid));
  const pays = (d.payments || []).filter((p) => !p.arch && p.ts >= a && p.ts < b && (!cid || p.cust === cid));
  return {
    a,
    b,
    invs,
    pays,
    debt: invs.reduce((x, i) => x + i.amount, 0),
    pay: pays.reduce((x, p) => x + p.amount, 0),
  };
}

export function repRows(
  db: DaftariDB,
  d: AccountData,
  acc: Account,
  rp: ReportFilter
): (string | number)[][] {
  const r = repData(d, rp);
  const mu = getMU(acc);
  const repNm = (id: string | null) => {
    const c = getCust(d, id);
    return c ? c.name : translate(db, 'deposit');
  };
  const rows: (string | number)[][] = [
    [translate(db, 'date'), translate(db, 'time'), translate(db, 'cust'), translate(db, 'type'), acc.cur, translate(db, 'remind')],
  ];
  [
    ...r.invs.map((i) => ({
      ts: i.ts,
      nm: repNm(i.cust),
      ty: translate(db, 'debt'),
      amt: i.amount,
      note: i.note || '',
      hasTime: i.hasTime,
    })),
    ...r.pays.map((p) => ({
      ts: p.ts,
      nm: repNm(p.cust),
      ty: translate(db, 'pay'),
      amt: p.amount,
      note: '',
      hasTime: p.hasTime,
    })),
  ]
    .sort((x, y) => y.ts - x.ts)
    .forEach((x) =>
      rows.push([
        dateStrText(x.ts, db.lang),
        x.hasTime ? timeStrText(x.ts, db.lang) : '',
        x.nm,
        x.ty,
        fmt(x.amt, mu),
        x.note,
      ])
    );
  return rows;
}
