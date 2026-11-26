export type Lang = 'ar' | 'en';
export type AccountType = 'grocery' | 'personal';
export type PaymentMethod = 'cash' | 'transfer' | 'cardpay';
export type InvoiceStatus = 'open' | 'part' | 'paid';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  cur: string;
  minorUnit?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  since: string;
  archived: boolean;
  pinned: boolean;
  limit?: number | null;
  photo?: string | null;
}

export interface InvoiceEdit {
  ts: number;
  from: number;
  to: number;
  note?: string;
  kind?: string;
}

export interface Invoice {
  id: string;
  code: string;
  cust: string | null;
  ts: number;
  createdAt?: number;
  hasTime?: boolean;
  amount: number; // integer minor units (e.g. halalas)
  note?: string;
  due?: number | null;
  k?: 'open' | string;
  arch?: boolean;
  edits?: InvoiceEdit[];
  src?: string;
}

export interface PaymentAlloc {
  inv: string;
  amt: number;
}

export interface Payment {
  id: string;
  cust: string | null;
  ts: number;
  createdAt?: number;
  hasTime?: boolean;
  amount: number; // integer minor units
  method: PaymentMethod;
  alloc: PaymentAlloc[];
  arch?: boolean;
  src?: string;
}

export interface TrashEntry {
  k: 'd' | 'p' | 'c';
  o: Invoice | Payment | Customer;
  ts: number;
}

export interface AccountData {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  seq: number;
  trash?: TrashEntry[];
}

export interface DaftariDB {
  meta: {
    schemaVersion: number;
  };
  lang: Lang;
  active: string;
  accounts: Account[];
  data: Record<string, AccountData>;
}

export interface EncryptedPack {
  iv: number[];
  ct: number[];
}

export interface FingerprintEntry {
  id: string;
  wrap: EncryptedPack;
}

export interface VoiceCorrection {
  t: string;
  a: number;
  n: number;
}

export interface SecurityState {
  enabled: boolean;
  salt: string;
  pinHash: string;
  autoMin: number;
  sound: boolean;
  vib: boolean;
  credId: string | null;
  fpWrap: EncryptedPack | null;
  fps: FingerprintEntry[];
  dark: boolean;
  darkAuto?: boolean;
  priv?: boolean;
  speak: boolean;
  vosk: boolean;
  btName: string;
  lockUntil?: number;
  failN?: number;
  masterWrapPin?: EncryptedPack;
  corrections?: VoiceCorrection[];
}

export type ScreenId =
  | 'home'
  | 'customers'
  | 'reports'
  | 'settings'
  | 'profile'
  | 'invoice'
  | 'voice'
  | 'rec'
  | 'wiz'
  | 'repb'
  | 'newcust'
  | 'trash'
  | 'lock';

export interface RouteScreen {
  s: ScreenId | string;
  p?: Record<string, any>;
}

export interface CustomerFilter {
  status: 'all' | 'owed' | 'none';
  period: string;
  sort: 'recent' | 'debt' | 'low' | 'name';
  near: boolean;
  over: boolean;
}

export interface FeedFilter {
  kind: 'all' | 'debt' | 'pay';
  period: 'today' | 'week' | 'month' | 'all';
}

export interface ReportFilter {
  mode: 'day' | 'week' | 'month' | 'range';
  day: string;
  month: string;
  from: string;
  to: string;
  cust: string | null;
}

export interface WizardState {
  kind: 'debt' | 'pay';
  step: number;
  custId: string | null;
  amt: string;
  note: string;
  due: string;
  q: string;
  method: PaymentMethod;
}

export interface RecDraft {
  name: string;
  amt: number;
  note?: string;
  due?: number | null;
  method?: PaymentMethod;
  say: string;
  custId: string | null;
}

export interface RecState {
  kind: 'debt' | 'pay';
  st: 'rec' | 'edit';
  edit: boolean;
  d: RecDraft;
  cands: Customer[];
  pre: string | null;
  t0: number;
  warn?: string | null;
  src?: string;
  _voskStopRequested?: boolean;
}

export interface NewCustDraft {
  name: string;
  phone: string;
  limit?: string | number;
  photo?: string | null;
  edit: string | null;
  forceDup?: boolean;
}

export interface LedgerIndexes {
  paidByInv: Record<string, number>;
  open: Record<string, number>;
  paid: Record<string, number>;
  last: Record<string, number>;
  bought: Record<string, number>;
  credit: Record<string, number>;
}
