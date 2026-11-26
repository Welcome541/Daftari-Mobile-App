import type { AccountData, Customer, DaftariDB, Invoice, InvoiceStatus, LedgerIndexes, Payment } from '../types/daftari';

export const Ledger = {
  bal(d: AccountData, cid: string): number {
    let s = 0;
    (d.invoices || []).forEach((i) => {
      if (i.cust === cid && !i.arch) s += i.amount || 0;
    });
    (d.payments || []).forEach((pp) => {
      if (pp.cust === cid && !pp.arch) s -= pp.amount || 0;
    });
    return s;
  },
  paid(d: AccountData, cid: string): number {
    let s = 0;
    (d.payments || []).forEach((pp) => {
      if (pp.cust === cid && !pp.arch) s += pp.amount || 0;
    });
    return s;
  },
  todayDebt(d: AccountData, a: number, b: number): number {
    let s = 0;
    (d.invoices || []).forEach((i) => {
      if (!i.arch && !i.k && i.ts >= a && i.ts < b) s += i.amount;
    });
    return s;
  },
  todayPay(d: AccountData, a: number, b: number): number {
    let s = 0;
    (d.payments || []).forEach((pp) => {
      if (!pp.arch && pp.ts >= a && pp.ts < b) s += pp.amount;
    });
    return s;
  },
};

export const Invariants = {
  check(x: Partial<DaftariDB> | null | undefined): string {
    if (!x || !x.accounts || !x.data) return 'no-accounts';
    const ids = new Set<string>();
    for (const aid in x.data) {
      const d = x.data[aid];
      const acc = (x.accounts || []).find((a) => a.id === aid);
      for (const arr of [d.customers, d.invoices, d.payments]) {
        for (const e of arr || []) {
          if (ids.has(e.id)) return 'dup-id:' + e.id;
          ids.add(e.id);
        }
      }
      for (const i of d.invoices || []) {
        if (!Number.isInteger(i.amount) || i.amount <= 0) return 'bad-amount:' + i.id;
        if (acc && acc.type !== 'personal' && !(d.customers || []).some((c) => c.id === i.cust)) {
          return 'orphan-inv:' + i.id;
        }
      }
      for (const pp of d.payments || []) {
        if (!Number.isInteger(pp.amount) || pp.amount <= 0) return 'bad-pay:' + pp.id;
        for (const a of pp.alloc || []) {
          if (!Number.isInteger(a.amt) || a.amt <= 0) return 'bad-alloc:' + pp.id;
        }
      }
    }
    return '';
  },
};

export function buildIndexes(d: AccountData): LedgerIndexes {
  const paidByInv: Record<string, number> = {};
  const open: Record<string, number> = {};
  const paid: Record<string, number> = {};
  const last: Record<string, number> = {};
  const bought: Record<string, number> = {};

  (d.payments || []).forEach((p) => {
    if (p.arch) return;
    if (p.cust) {
      paid[p.cust] = (paid[p.cust] || 0) + p.amount;
      last[p.cust] = Math.max(last[p.cust] || 0, p.ts);
    }
    (p.alloc || []).forEach((a) => {
      paidByInv[a.inv] = (paidByInv[a.inv] || 0) + a.amt;
    });
  });

  (d.invoices || []).forEach((i) => {
    if (i.arch) return;
    if (i.cust) {
      bought[i.cust] = (bought[i.cust] || 0) + i.amount;
      open[i.cust] = (open[i.cust] || 0) + Math.max(0, i.amount - (paidByInv[i.id] || 0));
      last[i.cust] = Math.max(last[i.cust] || 0, i.ts);
    }
  });

  const credit: Record<string, number> = {};
  for (const c in paid) {
    const cr = (paid[c] || 0) - (bought[c] || 0);
    if (cr > 0) credit[c] = cr;
  }

  return { paidByInv, open, paid, last, bought, credit };
}

export const invPaid = (ix: LedgerIndexes, id: string): number => ix.paidByInv[id] || 0;
export const invRem = (ix: LedgerIndexes, i: Invoice): number => Math.max(0, i.amount - invPaid(ix, i.id));
export const invStatus = (ix: LedgerIndexes, i: Invoice): InvoiceStatus => {
  const p = invPaid(ix, i.id);
  return p <= 0 ? 'open' : p >= i.amount ? 'paid' : 'part';
};
export const isOverdue = (ix: LedgerIndexes, i: Invoice): boolean =>
  !!(i.due && invRem(ix, i) > 0 && Date.now() > i.due);
export const custOpen = (ix: LedgerIndexes, id: string): number => ix.open[id] || 0;
export const custCredit = (ix: LedgerIndexes, id: string): number => ix.credit[id] || 0;
export const custPaid = (ix: LedgerIndexes, id: string): number => ix.paid[id] || 0;
export const lastAct = (ix: LedgerIndexes, id: string): number => ix.last[id] || 0;

export const custInvoices = (d: AccountData, id: string): Invoice[] =>
  (d.invoices || []).filter((i) => i.cust === id).sort((a, b) => b.ts - a.ts);

export const custPurch = (d: AccountData, id: string): number =>
  custInvoices(d, id).reduce((s, i) => s + i.amount, 0);

export const custOverdue = (d: AccountData, ix: LedgerIndexes, id: string): boolean =>
  (d.invoices || []).some((i) => i.cust === id && isOverdue(ix, i));

export const openTotal = (d: AccountData, ix: LedgerIndexes): number =>
  (d.customers || []).reduce((s, c) => s + Math.max(0, custOpen(ix, c.id)), 0);

export const isToday = (ts: number): boolean =>
  new Date(ts).toDateString() === new Date().toDateString();

export const collToday = (d: AccountData): number =>
  (d.payments || []).filter((p) => isToday(p.ts)).reduce((s, p) => s + p.amount, 0);

export function allocatePayment(
  d: AccountData,
  ix: LedgerIndexes,
  cid: string,
  amt: number
): { inv: string; amt: number }[] {
  const open = custInvoices(d, cid)
    .filter((i) => !i.arch && invRem(ix, i) > 0 && !i.k)
    .sort((a, b) => a.ts - b.ts);
  let left = amt;
  const alloc: { inv: string; amt: number }[] = [];
  open.forEach((i) => {
    if (left <= 0) return;
    const use = Math.min(invRem(ix, i), left);
    left -= use;
    alloc.push({ inv: i.id, amt: use });
  });
  return alloc;
}

export const getCust = (d: AccountData, id: string | null | undefined): Customer | undefined =>
  id ? (d.customers || []).find((c) => c.id === id) : undefined;

export const getInv = (d: AccountData, id: string | null | undefined): Invoice | undefined =>
  id ? (d.invoices || []).find((i) => i.id === id) : undefined;

export const getPay = (d: AccountData, id: string | null | undefined): Payment | undefined =>
  id ? (d.payments || []).find((p) => p.id === id) : undefined;
