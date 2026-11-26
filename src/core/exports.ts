import type { Account, AccountData, DaftariDB, LedgerIndexes } from '../types/daftari';
import { translate } from './i18n';
import { dateStrText, escHtml, fmt, getMU, Money } from './format';
import { custInvoices, custOpen, custPaid, getCust, invPaid, invRem, invStatus } from './ledger';

export function dl(name: string, content: string, mime: string): void {
  let href: string;
  try {
    href = URL.createObjectURL(new Blob([content], { type: mime }));
  } catch {
    href = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(content);
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

export const csvC = (v: unknown): string => {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
};

export function statementText(
  db: DaftariDB,
  d: AccountData,
  ix: LedgerIndexes,
  acc: Account,
  cid: string
): string {
  const c = getCust(d, cid);
  if (!c) return '';
  const mu = getMU(acc);
  const stLbl = {
    open: () => translate(db, 'open'),
    part: () => translate(db, 'part'),
    paid: () => translate(db, 'paid'),
  };
  const L = [
    acc.name + ' — ' + translate(db, 'printTitle'),
    translate(db, 'cust') + ': ' + c.name + (c.phone ? ' (' + c.phone + ')' : ''),
    translate(db, 'remaining') +
      ': ' +
      fmt(custOpen(ix, cid), mu) +
      ' ' +
      acc.cur +
      ' | ' +
      translate(db, 'totalPaid') +
      ': ' +
      fmt(custPaid(ix, cid), mu) +
      ' ' +
      acc.cur,
    '— ' + translate(db, 'invoices') + ' —',
  ];
  custInvoices(d, cid).forEach((i) =>
    L.push(
      i.code +
        ' | ' +
        new Date(i.ts).toLocaleDateString('en-GB') +
        ' | ' +
        fmt(i.amount, mu) +
        (i.edits && i.edits.length
          ? ' (' +
            translate(db, 'edited') +
            ' ' +
            new Date(i.edits[i.edits.length - 1].ts).toLocaleDateString('en-GB') +
            ')'
          : '') +
        ' | ' +
        stLbl[invStatus(ix, i)]() +
        (i.note ? ' | ' + i.note : '')
    )
  );
  L.push('— ' + translate(db, 'payLog') + ' —');
  (d.payments || [])
    .filter((p) => p.cust === cid)
    .forEach((p) =>
      L.push(
        new Date(p.ts).toLocaleDateString('en-GB') +
          ' | ' +
          fmt(p.amount, mu) +
          ' | ' +
          translate(db, p.method)
      )
    );
  return L.join('\n');
}

export function exportCustomerCSV(d: AccountData, acc: Account, cid: string): void {
  const c = getCust(d, cid);
  if (!c) return;
  let rows = '\uFEFFType,Date,Customer,Amount,Note\n';
  custInvoices(d, cid).forEach(
    (i) =>
      (rows +=
        'Debt,' +
        new Date(i.ts).toISOString().slice(0, 10) +
        ',' +
        csvC(c.name) +
        ',' +
        i.amount +
        ',"' +
        csvC(i.note || '') +
        '"\n')
  );
  (d.payments || [])
    .filter((p) => p.cust === cid)
    .forEach(
      (p) =>
        (rows +=
          'Payment,' +
          new Date(p.ts).toISOString().slice(0, 10) +
          ',' +
          csvC(c.name) +
          ',' +
          p.amount +
          ',' +
          csvC(p.method) +
          '\n')
    );
  dl('statement-' + c.name + '.csv', rows, 'text/csv');
}

export function exportAllCSV(d: AccountData, acc: Account): void {
  const mu = getMU(acc);
  let rows = '\uFEFFType,Date,Customer,Code,Amount,Note\n';
  (d.invoices || []).forEach(
    (i) =>
      (rows +=
        'Debt,' +
        new Date(i.ts).toISOString().slice(0, 10) +
        ',' +
        csvC((getCust(d, i.cust) || {}).name || '') +
        ',' +
        csvC(i.code) +
        ',' +
        Money.dec(i.amount, mu) +
        ',"' +
        csvC(i.note || '') +
        '"\n')
  );
  (d.payments || []).forEach(
    (p) =>
      (rows +=
        'Payment,' +
        new Date(p.ts).toISOString().slice(0, 10) +
        ',' +
        csvC((getCust(d, p.cust) || {}).name || '') +
        ',,' +
        Money.dec(p.amount, mu) +
        ',' +
        csvC(p.method) +
        '\n')
  );
  dl('dafter-data.csv', rows, 'text/csv');
}

export function buildCustomerPrintHtml(
  db: DaftariDB,
  d: AccountData,
  ix: LedgerIndexes,
  acc: Account,
  cid: string
): string {
  const c = getCust(d, cid);
  if (!c) return '';
  const mu = getMU(acc);
  return (
    '<div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #12294a;padding-bottom:10px;margin-bottom:12px">' +
    '<div style="width:52px;height:52px;border-radius:14px;background:#0d1f3a;color:#e8c76a;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px">د</div>' +
    '<div><div style="font-size:20px;font-weight:900;color:#12294a">' +
    escHtml(acc.name) +
    '</div><div style="color:#667;font-size:12px">دَفتَري Daftari · ' +
    escHtml(translate(db, 'printTitle')) +
    ' · ' +
    new Date().toLocaleDateString('en-GB') +
    '</div></div></div>' +
    '<div>' +
    escHtml(translate(db, 'cust')) +
    ': <b>' +
    escHtml(c.name) +
    '</b>' +
    (c.phone ? ' · <span dir="ltr">' + escHtml(c.phone) + '</span>' : '') +
    '</div>' +
    '<div>' +
    escHtml(translate(db, 'remaining')) +
    ': <b>' +
    fmt(custOpen(ix, cid), mu) +
    ' ' +
    escHtml(acc.cur) +
    '</b> · ' +
    escHtml(translate(db, 'totalPaid')) +
    ': ' +
    fmt(custPaid(ix, cid), mu) +
    ' ' +
    escHtml(acc.cur) +
    '</div>' +
    '<table><tr><th>' +
    escHtml(translate(db, 'invoice')) +
    '</th><th>Date</th><th>' +
    escHtml(translate(db, 'remind')) +
    '</th><th>' +
    escHtml(translate(db, 'total')) +
    '</th><th>' +
    escHtml(translate(db, 'paidLbl')) +
    '</th><th>' +
    escHtml(translate(db, 'remaining')) +
    '</th></tr>' +
    custInvoices(d, cid)
      .map(
        (i) =>
          '<tr><td>' +
          escHtml(i.code) +
          '</td><td>' +
          new Date(i.ts).toLocaleDateString('en-GB') +
          '</td><td>' +
          escHtml(i.note || '') +
          '</td><td>' +
          fmt(i.amount, mu) +
          '</td><td>' +
          fmt(invPaid(ix, i.id), mu) +
          '</td><td>' +
          fmt(invRem(ix, i), mu) +
          '</td></tr>'
      )
      .join('') +
    '</table>'
  );
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(s: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

export function shareOrCopy(text: string, onCopied: () => void): void {
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    copyText(text).then(() => onCopied());
  }
}

export function buildReportPrintHtml(
  db: DaftariDB,
  acc: Account,
  r: { a: number; b: number; debt: number; pay: number },
  custName: string | null,
  rows: (string | number)[][]
): string {
  const mu = getMU(acc);
  const hd = rows[0].map((c) => '<th style="padding:6px 8px;text-align:right">' + escHtml(String(c)) + '</th>').join('');
  const body = rows
    .slice(1)
    .map(
      (x) =>
        '<tr style="border-bottom:1px solid #e3e6ea">' +
        x.map((c) => '<td style="padding:6px 8px">' + escHtml(String(c)) + '</td>').join('') +
        '</tr>'
    )
    .join('');
  return (
    '<div style="font-family:system-ui;direction:' +
    (db.lang === 'ar' ? 'rtl' : 'ltr') +
    ';padding:18px">' +
    '<div style="font-weight:900;font-size:19px;color:#12294a">' +
    escHtml(acc.name) +
    ' — ' +
    escHtml(translate(db, 'repB')) +
    '</div>' +
    '<div style="color:#555;font-size:12px;margin-top:4px">' +
    escHtml(dateStrText(r.a, db.lang)) +
    ' ← ' +
    escHtml(dateStrText(r.b - 1, db.lang)) +
    (custName ? ' · ' + escHtml(custName) : '') +
    '</div>' +
    '<div style="display:flex;gap:14px;margin:12px 0;font-weight:800;font-size:13px">' +
    '<span style="color:#a71949">' +
    escHtml(translate(db, 'repDebtSum')) +
    ': ' +
    fmt(r.debt, mu) +
    '</span>' +
    '<span style="color:#0e7a52">' +
    escHtml(translate(db, 'repPaySum')) +
    ': ' +
    fmt(r.pay, mu) +
    '</span></div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#eef2f7">' +
    hd +
    '</tr>' +
    body +
    '</table></div>'
  );
}
