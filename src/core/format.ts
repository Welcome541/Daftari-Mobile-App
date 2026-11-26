import type { Account, AccountData, Customer, Lang } from '../types/daftari';
import { MON, translate } from './i18n';
import type { DaftariDB } from '../types/daftari';

export const MIN = 6e4;
export const H = 36e5;
export const D = 864e5;

export const normAr = (v: unknown): string => {
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const t = String(v || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627');
  return t
    .split('')
    .map((ch) => {
      const i = AR.indexOf(ch);
      return i >= 0 ? String(i) : ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};

export function nameTokens(nm: string): string[] {
  const t = normAr(nm)
    .toLowerCase()
    .replace(/[\u0640]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return [];
  return t
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.startsWith('\u0627\u0644') ? w.slice(2) : w))
    .filter(Boolean);
}

export function levDist(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let p = new Array<number>(n + 1);
  let c = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) p[j] = j;
  for (let i = 1; i <= m; i++) {
    c[0] = i;
    for (let j = 1; j <= n; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [p, c] = [c, p];
  }
  return p[n];
}

export function similarScore(a: string, b: string): number {
  const an = normAr(a).toLowerCase().trim();
  const bn = normAr(b).toLowerCase().trim();
  if (!an || !bn) return 0;
  if (an === bn) return 1;
  const at = nameTokens(a);
  const bt = nameTokens(b);
  const as = new Set(at);
  const bs = new Set(bt);
  let inter = 0;
  for (const x of as) if (bs.has(x)) inter++;
  const uni = as.size + bs.size - inter;
  const jac = uni ? inter / uni : 0;
  const ld = levDist(an, bn);
  const ml = Math.max(an.length, bn.length);
  const levS = ml ? 1 - ld / ml : 0;
  let sub = 0;
  if (an.includes(bn) || bn.includes(an)) {
    const r = Math.min(an.length, bn.length) / Math.max(an.length, bn.length);
    if (r > 0.65) sub = r;
  }
  return Math.max(jac, levS, sub);
}

export function findSimilarCustomers(
  d: AccountData,
  inputName: string,
  excludeId?: string
): { c: Customer; score: number }[] {
  if (!inputName || !inputName.trim()) return [];
  const res: { c: Customer; score: number }[] = [];
  for (const cc of d.customers || []) {
    if (cc.archived) continue;
    if (excludeId && cc.id === excludeId) continue;
    const sc = similarScore(inputName, cc.name);
    if (sc >= 0.6) res.push({ c: cc, score: sc });
  }
  res.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, 'ar'));
  return res;
}

export const getMU = (acc?: Account | null): number => (acc && acc.minorUnit) || 2;

export function fmt(m: number, mu = 2): string {
  const pw = Math.pow(10, mu);
  let val = Math.round(Number(m) || 0);
  const neg = val < 0;
  val = Math.abs(val);
  const i = Math.floor(val / pw);
  const f = String(val % pw).padStart(mu, '0');
  return (neg ? '−' : '') + i.toLocaleString('en-US') + (mu > 0 && /[1-9]/.test(f) ? '.' + f : '');
}

export const Money = {
  parse(v: unknown, mu = 2): number {
    const pw = Math.pow(10, mu);
    let t = String(v == null ? '' : v)
      .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
      .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
      .replace(/[،\s]/g, '')
      .replace(/٫/g, '.')
      .replace(/,(?=\d{3}(?!\d))/g, '')
      .replace(/,/g, '.');
    const neg = /^-/.test(t);
    t = t.replace(/[-+]/g, '');
    if (!/^\d*(\.\d*)?$/.test(t)) return 0;
    const pp = t.split('.');
    const fr = (pp[1] || '').slice(0, mu).padEnd(mu, '0');
    return (neg ? -1 : 1) * ((parseInt(pp[0] || '0', 10) || 0) * pw + parseInt(fr || '0', 10));
  },
  fromNumber(x: number, mu = 2): number {
    return Math.round((Number(x) || 0) * Math.pow(10, mu));
  },
  dec(m: number, mu = 2): string {
    const pw = Math.pow(10, mu);
    let val = Math.round(Number(m) || 0);
    const neg = val < 0;
    val = Math.abs(val);
    return (neg ? '-' : '') + Math.floor(val / pw) + '.' + String(val % pw).padStart(mu, '0');
  },
};

export function dateStrText(ts: number, lang: Lang): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MON[lang][d.getMonth()]} ${d.getFullYear()}`;
}

export function timeStrText(ts: number, lang: Lang): string {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : lang === 'ar' ? 'م' : 'PM';
  h = ((h + 11) % 12) + 1;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
}

export function opHasTime(o: { hasTime?: boolean; ts?: number } | null | undefined): boolean {
  if (!o) return false;
  if (typeof o.hasTime === 'boolean') return o.hasTime;
  if (o.ts == null) return false;
  const d = new Date(o.ts);
  return !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
}

export function dayLabelText(ts: number, db: DaftariDB): string {
  const d = new Date(ts);
  const n0 = new Date();
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(n0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / D);
  if (diff <= 0) return translate(db, 'today');
  if (diff === 1) return translate(db, 'yest');
  return dateStrText(ts, db.lang);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function lastOpTxt(ts: number, db: DaftariDB): string {
  if (!ts) return translate(db, 'noOps');
  const d = new Date(ts);
  const n0 = new Date();
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(n0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / D);
  if (diff <= 0) return translate(db, 'today');
  if (diff === 1) return translate(db, 'yest');
  return dateStrText(ts, db.lang);
}

export function pdig(s0: string | null | undefined): string {
  let x = (s0 || '').replace(/\D/g, '');
  if (x.startsWith('966')) x = x.slice(3);
  return x;
}

const ARABIC_ABC = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];

function avatarCandidates(name: string): string[] {
  const n = String(name || '').trim();
  if (!n) return [];
  const words = n.split(/\s+/).filter(Boolean);
  const cands: string[] = [];
  const push = (ch: string) => {
    if (ch && !cands.includes(ch)) cands.push(ch);
  };
  words.forEach((w) => push(w[0]));
  for (const ch of n.replace(/\s+/g, '')) {
    if (/\p{L}/u.test(ch)) push(ch);
  }
  for (const ch of n.replace(/\s+/g, '')) {
    push(ch);
  }
  words.forEach((w) => {
    for (let i = 1; i < w.length; i++) push(w[i]);
  });
  return cands.filter((ch) => ch && ch.trim());
}

export function buildAvatarMap(customers: Customer[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const list = (customers || []).filter((c) => !c.archived);
  for (const c of list) {
    const cands = avatarCandidates(c.name);
    let pick: string | null = null;
    for (const cand of cands) {
      if (!used.has(cand)) {
        pick = cand;
        break;
      }
    }
    if (!pick) {
      for (const a of ARABIC_ABC) {
        if (!used.has(a)) {
          pick = a;
          break;
        }
      }
    }
    if (!pick) pick = cands[0] || String(c.name || '').trim()[0] || '?';
    map[c.id] = pick;
    used.add(pick);
  }
  return map;
}

export function avatarLetterFor(
  avMap: Record<string, string>,
  customers: Customer[],
  cid?: string | null,
  fallbackName?: string
): string {
  if (cid && avMap[cid]) return avMap[cid];
  if (fallbackName) {
    const cust = (customers || []).find((x) => x.name === fallbackName && !x.archived);
    if (cust && avMap[cust.id]) return avMap[cust.id];
    const cands = avatarCandidates(fallbackName);
    return cands[0] || String(fallbackName).trim()[0] || '?';
  }
  return '?';
}

export const escHtml = (s: string): string =>
  String(s).replace(/[<>&"]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m] || m));
