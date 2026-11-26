import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Account,
  AccountData,
  Customer,
  CustomerFilter,
  DaftariDB,
  FeedFilter,
  Invoice,
  Lang,
  LedgerIndexes,
  NewCustDraft,
  Payment,
  PaymentMethod,
  RecState,
  ReportFilter,
  RouteScreen,
  SecurityState,
  WizardState,
} from '../types/daftari';
import {
  ENC_KEY,
  PLAIN_KEY,
  decJSON,
  deriveKey,
  loadSecState,
  newMaster,
  saveSecState,
  sha256hex,
  uid,
  unwrapKey,
  wrapKey,
} from '../core/crypto';
import { isPersonalAccount, translate } from '../core/i18n';
import {
  allocatePayment,
  buildIndexes,
  custOpen,
  getCust,
  getInv,
  getPay,
  invRem,
  Invariants,
} from '../core/ledger';
import { demoFixtures, migrate, seed } from '../core/migrate';
import { Store, createBackupObj, saveDBToStorage, verifyBackupObj } from '../core/storage';
import { parseSay } from '../core/recognition';
import { feedback, haptic, playSound, speak } from '../core/feedback';
import { applyAppearance, clampDensity, clampScale, loadAppearance, saveAppearance } from '../core/appearance';
import { buildAvatarMap, findSimilarCustomers, fmt, getMU, Money } from '../core/format';
import {
  dl,
  exportAllCSV,
  exportCustomerCSV,
  shareOrCopy,
  statementText,
} from '../core/exports';

export type PrintData =
  | null
  | { kind: 'customer'; cid: string }
  | { kind: 'report'; r: { a: number; b: number; debt: number; pay: number }; custName: string | null; rows: (string | number)[][] };

export type SheetState =
  | null
  | { type: 'notifications' }
  | { type: 'homeMenu' }
  | { type: 'homeFilter' }
  | { type: 'custListMenu' }
  | { type: 'custPin' }
  | { type: 'custSort' }
  | { type: 'custProfileMenu'; cid: string }
  | { type: 'invMenu'; invId: string }
  | { type: 'confirmArchive'; cid: string }
  | { type: 'confirmRestore'; cid: string }
  | { type: 'exportCustomer'; cid: string }
  | { type: 'photoPicker'; target: string }
  | { type: 'openingBalance'; cid: string }
  | { type: 'returnAdjust'; invId: string }
  | { type: 'invEdit'; invId: string }
  | { type: 'payDetails'; payId: string }
  | { type: 'accountSwitcher' }
  | { type: 'paperLedger' }
  | { type: 'importLedger' }
  | { type: 'demoData' }
  | { type: 'extVoice' }
  | { type: 'customCur' }
  | { type: 'appearance' }
  | { type: 'updater' }
  | { type: 'addons' }
  | { type: 'qrSend'; payload: string }
  | { type: 'qrStmt'; cid: string; text: string }
  | { type: 'qrRecv' }
  | { type: 'contactsInfo' }
  | { type: 'dupCustomers'; sims: { c: Customer; score: number }[] }
  | { type: 'pinSetup' }
  | { type: 'confirmReset' }
  | { type: 'confirmTrashPurge' }
  | { type: 'repCustPicker' }
  | { type: 'quickActions'; cid: string }
  | { type: 'quickPay'; cid: string };

export interface ToastState {
  show: boolean;
  message?: string;
  title?: string;
  amountStr?: string;
  subtitle?: string;
  shareId?: string | null;
  undoFn?: (() => void) | null;
}

export interface UIState {
  f: CustomerFilter;
  cmax: number;
  txLimit: number;
  archQ: string;
  tf: FeedFilter;
  tq: string;
  arch: boolean;
  cq: string;
  sel: { on: boolean; ids: string[] };
  csel: { on: boolean; ids: string[] };
  rp: ReportFilter;
  wz: WizardState | null;
  rec: RecState | null;
  recPend: boolean;
  nc: NewCustDraft;
  voskOpen: boolean;
}

export interface UpdaterInfo {
  state: 'idle' | 'checking' | 'available' | 'error';
  manifest: any;
  remote: any;
  lastError: string | null;
}

interface AppContextValue {
  db: DaftariDB | null;
  sec: SecurityState;
  locked: boolean;
  busy: boolean;
  stack: RouteScreen[];
  curScr: RouteScreen;
  ctxCust: string | null;
  dd: AccountData;
  curAcc: Account;
  ix: LedgerIndexes;
  avMap: Record<string, string>;
  isP: boolean;
  darkOn: boolean;
  appearance: { scale: number; density: number };
  setAppearanceValues: (scale: number, density: number) => void;
  t: (key: string) => any;
  toast: ToastState;
  toastMsg: (msg: string, opts?: Partial<Omit<ToastState, 'show'>> & { dur?: number }) => void;
  hideToast: () => void;
  doUndoToast: () => void;
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  ui: UIState;
  setUi: React.Dispatch<React.SetStateAction<UIState>>;
  printData: PrintData;
  triggerPrint: (data: PrintData) => void;
  // Navigation
  tab: (s: string) => void;
  go: (s: string, p?: Record<string, any>) => void;
  back: () => void;
  resetStack: (next: RouteScreen[]) => void;
  // Core mutations
  updateDB: (fn: (draft: DaftariDB) => void) => void;
  updateSec: (fn: (draft: SecurityState) => void) => void;
  setCur: (cur: string) => void;
  setLang: (lang: Lang) => void;
  // Wizard & transactions
  goWiz: (kind: 'debt' | 'pay', preId?: string | null) => void;
  wizConfirm: () => void;
  addOpening: (cid: string, amtMinor: number, note?: string) => void;
  applyReturn: (invId: string, amtMinor: number, note?: string) => boolean;
  saveInvEdit: (invId: string, amtMinor: number, note: string) => boolean;
  quickPaySave: (cid: string, amtMinor: number, method: PaymentMethod) => boolean;
  // Customers
  saveCustomer: (forceDup?: boolean) => void;
  archiveCustomer: (cid: string) => void;
  restoreCustomer: (cid: string) => void;
  togglePin: (cid: string) => void;
  setPhoto: (target: string, url: string | null) => void;
  // Selection
  selExit: () => void;
  selStart: () => void;
  selToggle: (key: string) => void;
  selDay: (dk: string, keys: string[]) => void;
  selAllVisible: (keys: string[]) => void;
  selShare: () => void;
  selDelete: () => void;
  selArchive: () => void;
  cselExit: () => void;
  cselToggle: (cid: string) => void;
  cselAll: (cids: string[]) => void;
  cselPin: () => void;
  cselShare: () => void;
  cselArchive: () => void;
  cselDelete: () => void;
  // Trash
  trashRestore: (id: string) => void;
  trashPurge: () => void;
  // Accounts
  switchAcc: (id: string) => void;
  saveAccEdit: (editId: string, name: string, type: 'grocery' | 'personal', cur: string) => void;
  // Security / Lock
  verifyPin: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  disableLock: () => void;
  lockNow: () => void;
  addFp: () => Promise<void>;
  fpDel: (idx: number) => void;
  fpUnlock: () => Promise<void>;
  // Demo, Backup, Import, Export
  applyDemo: () => void;
  clearDemo: () => void;
  resetAll: () => void;
  downloadBackup: () => Promise<void>;
  restoreBackupFile: (file: File) => Promise<void>;
  restoreBackupObj: (obj: any) => Promise<boolean>;
  importRows: (rows: unknown[][]) => number;
  paperCommit: (drafts: { name: string; amt: number; note: string; ok: boolean }[], dateStr: string) => void;
  ocrPick: () => void;
  exportAll: () => void;
  exportCustCsv: (cid: string) => void;
  shareOneById: (key: string) => void;
  shareCustomerReceipt: (cid: string) => void;
  printCustomer: (cid: string) => void;
  printReport: (r: { a: number; b: number; debt: number; pay: number }, custName: string | null, rows: (string | number)[][]) => void;
  sendWA: (cid: string) => void;
  sendSMS: (cid: string) => void;
  waRemindInv: (invId: string) => void;
  // QR & BT & Contacts
  openQrSend: () => Promise<void>;
  openQrStmt: (cid: string) => Promise<void>;
  qrApply: (payload: string) => Promise<void>;
  connectBT: () => Promise<void>;
  printBT: (text: string) => Promise<void>;
  openContacts: () => void;
  // Voice & Recognition
  startRec: (kind: 'debt' | 'pay', custId?: string | null) => void;
  handleSay: (kind: 'debt' | 'pay', text: string, conf?: number | null) => void;
  endRec: () => void;
  cancelRec: () => void;
  retryRec: () => void;
  recConfirm: (editedCustId?: string | null, editedAmt?: string, editedNote?: string) => void;
  extSay: (text: string) => boolean;
  liveTranscript: string;
  micLevel: number[];
  // Updater
  updater: UpdaterInfo;
  checkUpdates: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

function computeDarkOn(sec: SecurityState): boolean {
  if (sec.darkAuto) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    } catch {
      // ignore
    }
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }
  return !!sec.dark;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<DaftariDB | null>(null);
  const [sec, setSec] = useState<SecurityState>(() => loadSecState());
  const [locked, setLocked] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [stack, setStack] = useState<RouteScreen[]>([{ s: 'home' }]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [printData, setPrintData] = useState<PrintData>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micLevel, setMicLevel] = useState<number[]>(new Array(16).fill(4));
  const [appearance, setAppearanceState] = useState(() => loadAppearance());
  const [updater, setUpdater] = useState<UpdaterInfo>({ state: 'idle', manifest: null, remote: null, lastError: null });

  const [toast, setToast] = useState<ToastState>({ show: false });
  const toastTimerRef = useRef<number | null>(null);

  const [ui, setUi] = useState<UIState>({
    f: { status: 'all', period: 'all', sort: 'recent', near: false, over: false },
    cmax: 60,
    txLimit: 60,
    archQ: '',
    tf: { kind: 'all', period: 'all' },
    tq: '',
    arch: false,
    cq: '',
    sel: { on: false, ids: [] },
    csel: { on: false, ids: [] },
    rp: { mode: 'week', day: '', month: '', from: '', to: '', cust: null },
    wz: null,
    rec: null,
    recPend: false,
    nc: { name: '', phone: '', limit: '', photo: null, edit: null, forceDup: false },
    voskOpen: false,
  });

  const dbRef = useRef<DaftariDB | null>(db);
  dbRef.current = db;
  const secRef = useRef<SecurityState>(sec);
  secRef.current = sec;
  const masterKeyRef = useRef<CryptoKey | null>(masterKey);
  masterKeyRef.current = masterKey;
  const uiRef = useRef<UIState>(ui);
  uiRef.current = ui;

  const afterUnlockRef = useRef<((mk: CryptoKey) => Promise<void>) | null>(null);
  const dedupeRef = useRef<{ k: string; t: number }>({ k: '', t: 0 });
  const lastTouchRef = useRef<number>(Date.now());
  const btCharRef = useRef<any>(null);
  const recEndTimerRef = useRef<number | null>(null);
  const recTickTimerRef = useRef<number | null>(null);
  const srRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micAnimRef = useRef<number | null>(null);

  const dedupe = useCallback((k: string): boolean => {
    const n = Date.now();
    if (dedupeRef.current.k === k && n - dedupeRef.current.t < 700) return true;
    dedupeRef.current = { k, t: n };
    return false;
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast((prev) => ({ ...prev, show: false, undoFn: null }));
  }, []);

  const toastMsg = useCallback(
    (msg: string, opts?: Partial<Omit<ToastState, 'show'>> & { dur?: number }) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const { dur = 3000, ...rest } = opts || {};
      setToast({
        show: true,
        message: msg,
        ...rest,
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, dur);
    },
    []
  );

  const doUndoToast = useCallback(() => {
    setToast((prev) => {
      if (prev.undoFn) {
        try {
          prev.undoFn();
        } catch {
          // ignore
        }
      }
      return { ...prev, show: false, undoFn: null };
    });
  }, []);

  const persistDB = useCallback(
    (nextDb: DaftariDB, nextSec?: SecurityState, nextMk?: CryptoKey | null) => {
      saveDBToStorage(
        nextDb,
        nextSec ?? secRef.current,
        nextMk !== undefined ? nextMk : masterKeyRef.current,
        (msg) => toastMsg(msg)
      );
    },
    [toastMsg]
  );

  const updateDB = useCallback(
    (fn: (draft: DaftariDB) => void) => {
      setDb((prev) => {
        if (!prev) return prev;
        const copy: DaftariDB = JSON.parse(JSON.stringify(prev));
        fn(copy);
        persistDB(copy);
        return copy;
      });
    },
    [persistDB]
  );

  const updateSec = useCallback((fn: (draft: SecurityState) => void) => {
    setSec((prev) => {
      const copy: SecurityState = JSON.parse(JSON.stringify(prev));
      fn(copy);
      saveSecState(copy);
      return copy;
    });
  }, []);

  const setAppearanceValues = useCallback((scale: number, density: number) => {
    const s = clampScale(scale);
    const d = clampDensity(density);
    setAppearanceState({ scale: s, density: d });
    saveAppearance(s, d);
    applyAppearance(s, d);
  }, []);

  // Derived data
  const safeDb = useMemo(() => db || seed(), [db]);
  const curAcc = useMemo(
    () => safeDb.accounts.find((a) => a.id === safeDb.active) || safeDb.accounts[0],
    [safeDb]
  );
  const dd = useMemo(
    () => safeDb.data[safeDb.active] || { customers: [], invoices: [], payments: [], seq: 1 },
    [safeDb]
  );
  const ix = useMemo(() => buildIndexes(dd), [dd]);
  const avMap = useMemo(() => buildAvatarMap(dd.customers || []), [dd.customers]);
  const isP = useMemo(() => isPersonalAccount(safeDb), [safeDb]);
  const darkOn = useMemo(() => computeDarkOn(sec), [sec]);

  const t = useCallback((key: string) => translate(dbRef.current || safeDb, key), [safeDb]);

  const curScr = stack[stack.length - 1] || { s: 'home' };
  const ctxCust = useMemo(() => {
    if (curScr.s === 'profile') return (curScr.p && curScr.p.id) || null;
    if (curScr.s === 'voice' || curScr.s === 'pay') return (curScr.p && curScr.p.cust) || null;
    return null;
  }, [curScr]);

  // Apply lang, dir, theme, privacy
  useEffect(() => {
    const lang = safeDb.lang || 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.lang = lang;
    document.title = lang === 'ar' ? 'دَفتَري' : 'Daftari';
    document.body.classList.toggle('dark', darkOn);
    document.body.classList.toggle('priv', !!sec.priv);
  }, [safeDb.lang, darkOn, sec.priv]);

  // Apply appearance & ResizeObserver for --u
  useEffect(() => {
    applyAppearance(appearance.scale, appearance.density);
    const onResize = () => applyAppearance(appearance.scale, appearance.density);
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    const shell = document.getElementById('phone');
    if (shell && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(shell);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [appearance.scale, appearance.density]);

  // Auto-lock timer
  useEffect(() => {
    const bump = () => {
      lastTouchRef.current = Date.now();
    };
    document.addEventListener('pointerdown', bump, { passive: true });
    document.addEventListener('keydown', bump, { passive: true });
    const id = window.setInterval(() => {
      const s = secRef.current;
      if (s.enabled && !locked && Date.now() - lastTouchRef.current > (s.autoMin || 2) * 60000) {
        setLocked(true);
        setMasterKey(null);
        setStack([{ s: 'home' }]);
      }
    }, 5000);
    return () => {
      document.removeEventListener('pointerdown', bump);
      document.removeEventListener('keydown', bump);
      clearInterval(id);
    };
  }, [locked]);

  // Boot sequence
  useEffect(() => {
    let mounted = true;
    (async () => {
      const initialSec = loadSecState();
      const encRaw = localStorage.getItem(ENC_KEY);
      if (initialSec.enabled && encRaw) {
        if (!mounted) return;
        setLocked(true);
        setDb({ meta: { schemaVersion: 3 }, lang: 'ar', active: 'a1', accounts: [{ id: 'a1', name: 'دَفتَري', type: 'grocery', cur: 'ر.س', minorUnit: 2 }], data: { a1: { customers: [], invoices: [], payments: [], seq: 500 } } });
        afterUnlockRef.current = async (mk: CryptoKey) => {
          try {
            const pack = JSON.parse(localStorage.getItem(ENC_KEY) || 'null');
            if (pack) {
              const dec = await decJSON<DaftariDB>(pack, mk);
              if (dec) {
                setDb(migrate(dec));
              }
            }
          } catch {
            // ignore
          }
          afterUnlockRef.current = null;
          setStack([{ s: 'home' }]);
        };
        return;
      }

      let raw = await Store.load();
      if (raw && raw.__enc) {
        try {
          localStorage.setItem(ENC_KEY, JSON.stringify(raw.__enc));
        } catch {
          // ignore
        }
        raw = null;
      }
      if (!raw) {
        try {
          raw = JSON.parse(localStorage.getItem(PLAIN_KEY) || 'null');
        } catch {
          raw = null;
        }
      }
      if (raw && initialSec.enabled) raw = null;
      const isUntouchedEmpty =
        !raw ||
        (raw.accounts?.length === 1 &&
          raw.data?.[raw.active]?.customers?.length === 0 &&
          raw.data?.[raw.active]?.invoices?.length === 0 &&
          raw.data?.[raw.active]?.payments?.length === 0);
      const userCleared = (() => {
        try {
          return localStorage.getItem('daftari_user_cleared') === '1';
        } catch {
          return false;
        }
      })();
      const initialRaw = isUntouchedEmpty && !userCleared ? demoFixtures() : raw || seed();
      const migrated = migrate(initialRaw);
      if (!mounted) return;
      setDb(migrated);
      Store.persist(migrated, initialSec, null);
    })();

    // Load version.json
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (mounted && m) {
          setUpdater((prev) => ({ ...prev, manifest: m }));
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Navigation
  const tab = useCallback((s: string) => {
    setStack([{ s }]);
    setUi((prev) => ({ ...prev, sel: { on: false, ids: [] }, csel: { on: false, ids: [] } }));
  }, []);

  const go = useCallback((s: string, p?: Record<string, any>) => {
    setStack((prev) => [...prev, { s, p }]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ s: 'home' }]));
  }, []);

  const resetStack = useCallback((next: RouteScreen[]) => {
    setStack(next);
  }, []);

  const openSheet = useCallback((s: SheetState) => setSheet(s), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const triggerPrint = useCallback((data: PrintData) => {
    setPrintData(data);
    setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore
      }
    }, 60);
  }, []);

  // Helpers for snack
  const doneSnack = useCallback(
    (kind: 'debt' | 'pay', id: string, cid: string | null, amt: number) => {
      const acc = dbRef.current?.accounts.find((a) => a.id === dbRef.current?.active) || curAcc;
      const mu = getMU(acc);
      const amountStr = `${fmt(amt, mu)} ${acc.cur}`;
      const currentDb = dbRef.current || safeDb;
      toastMsg('', {
        title: translate(currentDb, kind === 'debt' ? 'debtDone' : 'payDone'),
        amountStr,
        subtitle: translate(currentDb, 'undoAvail'),
        shareId: kind === 'debt' && cid ? id : null,
        undoFn: () => {
          updateDB((draft) => {
            const d = draft.data[draft.active];
            if (kind === 'debt') {
              d.invoices = d.invoices.filter((x) => x.id !== id);
            } else {
              d.payments = d.payments.filter((x) => x.id !== id);
            }
          });
        },
        dur: 3000,
      });
    },
    [curAcc, safeDb, toastMsg, updateDB]
  );

  // Preferences
  const setCur = useCallback(
    (cur: string) => {
      updateDB((draft) => {
        const a = draft.accounts.find((x) => x.id === draft.active) || draft.accounts[0];
        if (a) a.cur = cur;
      });
    },
    [updateDB]
  );

  const setLang = useCallback(
    (lang: Lang) => {
      updateDB((draft) => {
        draft.lang = lang;
      });
    },
    [updateDB]
  );

  // Wizard
  const goWiz = useCallback(
    (kind: 'debt' | 'pay', preId?: string | null) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const d = currentDb.data[currentDb.active];
      const activeCusts = (d.customers || []).filter((c) => !c.archived);
      const personal = isPersonalAccount(currentDb);
      if (!personal && !activeCusts.length) {
        toastMsg(translate(currentDb, 'noCustomers'));
        go('newcust', {});
        return;
      }
      const solo = activeCusts.length === 1 ? activeCusts[0].id : null;
      const chosen = preId || solo;
      setUi((prev) => ({
        ...prev,
        wz: {
          kind,
          step: personal ? 0 : chosen ? 1 : 0,
          custId: chosen,
          amt: '',
          note: '',
          due: '',
          q: '',
          method: 'cash',
        },
      }));
      go('wiz', {});
    },
    [go, toastMsg]
  );

  const wizConfirm = useCallback(() => {
    const wz = uiRef.current.wz;
    const currentDb = dbRef.current;
    if (!wz || !currentDb) return;
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    const mu = getMU(acc);
    const personal = isPersonalAccount(currentDb);
    const c = personal ? null : getCust(d, wz.custId);
    const amt = Money.parse(wz.amt, mu);

    if (dedupe(`wz|${c ? c.id : 'p'}|${amt}`)) return;
    if (!personal && !c) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'chooseFirst'));
      return;
    }
    if (amt <= 0) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'enterAmt'));
      return;
    }

    const now = Date.now();
    if (wz.kind === 'debt') {
      const newId = uid();
      updateDB((draft) => {
        const dd2 = draft.data[draft.active];
        const inv: Invoice = {
          id: newId,
          code: 'A' + dd2.seq++,
          cust: c ? c.id : null,
          ts: now,
          createdAt: now,
          hasTime: true,
          amount: amt,
          note: (wz.note || '').trim(),
          due: null,
          src: 'manual',
        };
        dd2.invoices.push(inv);
      });
      feedback('debt', secRef.current);
      doneSnack('debt', newId, c ? c.id : null, amt);
      speak(`${c ? c.name + '، ' : ''}${translate(currentDb, 'newDebt')} ${amt} ${acc.cur}`, secRef.current, currentDb.lang);
    } else {
      const curIx = buildIndexes(d);
      const alloc = c ? allocatePayment(d, curIx, c.id, amt) : [];
      const newId = uid();
      updateDB((draft) => {
        const dd2 = draft.data[draft.active];
        const pyv: Payment = {
          id: newId,
          cust: c ? c.id : null,
          ts: now,
          createdAt: now,
          hasTime: true,
          amount: amt,
          method: wz.method,
          alloc,
          src: 'manual',
        };
        dd2.payments.push(pyv);
      });
      feedback('pay', secRef.current);
      doneSnack('pay', newId, c ? c.id : null, amt);
      speak(`${c ? c.name + '، ' : ''}${translate(currentDb, 'pay')} ${amt} ${acc.cur}`, secRef.current, currentDb.lang);
    }
    setUi((prev) => ({ ...prev, wz: null }));
    tab('home');
  }, [dedupe, doneSnack, tab, toastMsg, updateDB]);

  const addOpening = useCallback(
    (cid: string, amtMinor: number, note?: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const now = Date.now();
      updateDB((draft) => {
        const dd2 = draft.data[draft.active];
        dd2.invoices.push({
          id: uid(),
          code: 'OPN-' + dd2.seq++,
          cust: cid,
          ts: now,
          createdAt: now,
          hasTime: true,
          amount: amtMinor,
          note: note || translate(currentDb, 'opening'),
          k: 'open',
        });
      });
      feedback('debt', secRef.current);
      toastMsg(`${translate(currentDb, 'opening')} ✓`);
    },
    [toastMsg, updateDB]
  );

  const applyReturn = useCallback(
    (invId: string, amtMinor: number, note?: string): boolean => {
      const currentDb = dbRef.current;
      if (!currentDb) return false;
      const d = currentDb.data[currentDb.active];
      const inv = getInv(d, invId);
      if (!inv) return false;
      const curIx = buildIndexes(d);
      const rem = invRem(curIx, inv);
      if (dedupe(`ret|${invId}|${amtMinor}`)) return false;
      if (amtMinor <= 0) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'warn_noamt'));
        return false;
      }
      if (amtMinor > rem) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'retOver'));
        return false;
      }
      updateDB((draft) => {
        const target = getInv(draft.data[draft.active], invId);
        if (!target) return;
        target.edits = target.edits || [];
        target.edits.push({
          ts: Date.now(),
          from: target.amount,
          to: target.amount - amtMinor,
          note: (note || '').trim() || translate(currentDb, 'ret'),
          kind: 'return',
        });
        target.amount = target.amount - amtMinor;
      });
      feedback('success', secRef.current);
      closeSheet();
      toastMsg(translate(currentDb, 'retDone'));
      return true;
    },
    [closeSheet, dedupe, toastMsg, updateDB]
  );

  const saveInvEdit = useCallback(
    (invId: string, amtMinor: number, note: string): boolean => {
      const currentDb = dbRef.current;
      if (!currentDb) return false;
      if (amtMinor <= 0) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'enterAmt'));
        return false;
      }
      updateDB((draft) => {
        const target = getInv(draft.data[draft.active], invId);
        if (!target) return;
        if (amtMinor !== target.amount) {
          target.edits = target.edits || [];
          target.edits.push({
            ts: Date.now(),
            from: target.amount,
            to: amtMinor,
            note: translate(currentDb, 'editL'),
          });
        }
        target.amount = amtMinor;
        target.note = note.trim();
        target.due = null;
      });
      feedback('success', secRef.current);
      closeSheet();
      toastMsg(translate(currentDb, 'savedName'));
      return true;
    },
    [closeSheet, toastMsg, updateDB]
  );

  const quickPaySave = useCallback(
    (cid: string, amtMinor: number, method: PaymentMethod): boolean => {
      const currentDb = dbRef.current;
      if (!currentDb) return false;
      if (amtMinor <= 0) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'enterAmt'));
        return false;
      }
      const d = currentDb.data[currentDb.active];
      const curIx = buildIndexes(d);
      const alloc = allocatePayment(d, curIx, cid, amtMinor);
      const now = Date.now();
      updateDB((draft) => {
        draft.data[draft.active].payments.push({
          id: uid(),
          cust: cid,
          ts: now,
          createdAt: now,
          hasTime: true,
          amount: amtMinor,
          method,
          alloc,
        });
      });
      feedback('pay', secRef.current);
      closeSheet();
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      toastMsg('', {
        title: translate(currentDb, 'payDone'),
        amountStr: `${fmt(amtMinor, getMU(acc))} ${acc.cur}`,
      });
      return true;
    },
    [closeSheet, toastMsg, updateDB]
  );

  // Customers
  const saveCustomer = useCallback(
    (forceDup = false) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const nc = uiRef.current.nc;
      const nm = (nc.name || '').trim();
      if (!nm) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'nameReq'));
        return;
      }
      const d = currentDb.data[currentDb.active];
      if (!nc.edit && !nc.forceDup && !forceDup) {
        const sims = findSimilarCustomers(d, nm);
        if (sims.length) {
          haptic('select', secRef.current);
          openSheet({ type: 'dupCustomers', sims });
          return;
        }
      }
      if (nc.edit) {
        const editId = nc.edit;
        updateDB((draft) => {
          const target = getCust(draft.data[draft.active], editId);
          if (!target) return;
          target.name = nm;
          target.phone = (nc.phone || '').trim();
          if (nc.photo !== undefined) target.photo = nc.photo;
        });
        feedback('success', secRef.current);
        toastMsg(translate(currentDb, 'savedC'));
        setUi((prev) => ({ ...prev, nc: { name: '', phone: '', limit: '', photo: null, edit: null, forceDup: false } }));
        setStack([{ s: 'profile', p: { id: editId } }]);
        return;
      }

      const newId = uid();
      updateDB((draft) => {
        draft.data[draft.active].customers.push({
          id: newId,
          name: nm,
          phone: (nc.phone || '').trim(),
          photo: nc.photo || null,
          since: String(new Date().getFullYear()),
          archived: false,
          pinned: false,
        });
      });
      feedback('success', secRef.current);
      toastMsg(translate(currentDb, 'savedC'));
      const wasRecPend = uiRef.current.recPend && uiRef.current.rec;
      setUi((prev) => ({
        ...prev,
        nc: { name: '', phone: '', limit: '', photo: null, edit: null, forceDup: false },
        recPend: false,
        rec: wasRecPend && prev.rec ? { ...prev.rec, d: { ...prev.rec.d, custId: newId, name: nm }, cands: [] } : prev.rec,
      }));
      if (wasRecPend && uiRef.current.rec) {
        setStack([{ s: 'rec', p: { kind: uiRef.current.rec.kind } }]);
      } else {
        setStack([{ s: 'profile', p: { id: newId } }]);
      }
    },
    [openSheet, toastMsg, updateDB]
  );

  const archiveCustomer = useCallback(
    (cid: string) => {
      const currentDb = dbRef.current;
      updateDB((draft) => {
        const c = getCust(draft.data[draft.active], cid);
        if (c) c.archived = true;
      });
      feedback('success', secRef.current);
      closeSheet();
      if (currentDb) toastMsg(translate(currentDb, 'archived'));
      setStack([{ s: 'customers' }]);
    },
    [closeSheet, toastMsg, updateDB]
  );

  const restoreCustomer = useCallback(
    (cid: string) => {
      updateDB((draft) => {
        const c = getCust(draft.data[draft.active], cid);
        if (c) c.archived = false;
      });
      feedback('success', secRef.current);
      closeSheet();
    },
    [closeSheet, updateDB]
  );

  const togglePin = useCallback(
    (cid: string) => {
      const currentDb = dbRef.current;
      let pinnedNow = false;
      updateDB((draft) => {
        const c = getCust(draft.data[draft.active], cid);
        if (c) {
          c.pinned = !c.pinned;
          pinnedNow = c.pinned;
        }
      });
      feedback('pin', secRef.current);
      if (currentDb) toastMsg(`${translate(currentDb, pinnedNow ? 'pinAct' : 'unpinAct')} ✓`);
    },
    [toastMsg, updateDB]
  );

  const setPhoto = useCallback(
    (target: string, url: string | null) => {
      if (target === 'nc') {
        setUi((prev) => ({ ...prev, nc: { ...prev.nc, photo: url } }));
      } else {
        updateDB((draft) => {
          const c = getCust(draft.data[draft.active], target);
          if (c) c.photo = url;
        });
      }
      haptic('tap', secRef.current);
      closeSheet();
    },
    [closeSheet, updateDB]
  );

  // Selection actions
  const selExit = useCallback(() => {
    haptic('tap', secRef.current);
    setUi((prev) => ({ ...prev, sel: { on: false, ids: [] } }));
  }, []);
  const selStart = useCallback(() => {
    haptic('select', secRef.current);
    setUi((prev) => ({ ...prev, sel: { on: true, ids: [] } }));
  }, []);
  const selToggle = useCallback((key: string) => {
    haptic('tap', secRef.current);
    setUi((prev) => {
      if (!prev.sel.on) return prev;
      const has = prev.sel.ids.includes(key);
      return { ...prev, sel: { on: true, ids: has ? prev.sel.ids.filter((x) => x !== key) : [...prev.sel.ids, key] } };
    });
  }, []);

  const selDay = useCallback((_dk: string, keys: string[]) => {
    if (!keys.length) return;
    setUi((prev) => {
      if (!prev.sel.on) {
        haptic('select', secRef.current);
        return { ...prev, sel: { on: true, ids: [...keys] } };
      }
      const all = keys.every((k) => prev.sel.ids.includes(k));
      const nextIds = all
        ? prev.sel.ids.filter((k) => !keys.includes(k))
        : [...new Set([...prev.sel.ids, ...keys])];
      haptic('tap', secRef.current);
      return { ...prev, sel: { on: true, ids: nextIds } };
    });
  }, []);

  const selAllVisible = useCallback((keys: string[]) => {
    haptic('tap', secRef.current);
    setUi((prev) => {
      const all = keys.length > 0 && prev.sel.ids.length >= keys.length && keys.every((k) => prev.sel.ids.includes(k));
      return { ...prev, sel: { on: true, ids: all ? [] : keys } };
    });
  }, []);

  const selShare = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = uiRef.current.sel.ids;
    if (!ids.length) {
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    const mu = getMU(acc);
    const lines = ids
      .map((k) => {
        const id = k.substring(2);
        const it = k[0] === 'd' ? getInv(d, id) : getPay(d, id);
        if (!it) return null;
        const c = it.cust ? getCust(d, it.cust) : null;
        if (k[0] === 'd') {
          const inv = it as Invoice;
          return `${c ? c.name + ' — ' : ''}${translate(currentDb, 'newDebt')}: ${fmt(inv.amount, mu)} ${acc.cur}${inv.note ? ' — ' + inv.note : ''} (${new Date(inv.ts).toLocaleDateString('en-GB')})`;
        }
        return `${c ? c.name + ' — ' : ''}${translate(currentDb, 'pay')}: ${fmt(it.amount, mu)} ${acc.cur} (${new Date(it.ts).toLocaleDateString('en-GB')})`;
      })
      .filter(Boolean);
    shareOrCopy(`${acc.name}\n${lines.join('\n')}`, () => toastMsg(translate(currentDb, 'copied')));
  }, [toastMsg]);

  const selDelete = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = uiRef.current.sel.ids;
    if (!ids.length) {
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    const invIds = ids.filter((k) => k[0] === 'd').map((k) => k.substring(2));
    const payIds = ids.filter((k) => k[0] === 'p').map((k) => k.substring(2));
    const n = ids.length;
    const pushedTs = Date.now();
    updateDB((draft) => {
      const d = draft.data[draft.active];
      d.trash = d.trash || [];
      d.invoices.filter((i) => invIds.includes(i.id)).forEach((o) => d.trash!.push({ k: 'd', o, ts: pushedTs }));
      d.payments.filter((p) => payIds.includes(p.id)).forEach((o) => d.trash!.push({ k: 'p', o, ts: pushedTs }));
      d.invoices = d.invoices.filter((i) => !invIds.includes(i.id));
      d.payments = d.payments.filter((p) => !payIds.includes(p.id));
    });
    feedback('delete', secRef.current);
    setUi((prev) => ({ ...prev, sel: { on: false, ids: [] } }));
    const deletedFn = translate(currentDb, 'deletedN');
    const msg = (typeof deletedFn === 'function' ? deletedFn(n) : `${n}`) + ' · ' + translate(currentDb, 'trashT');
    toastMsg(msg, {
      undoFn: () => {
        updateDB((draft) => {
          const d = draft.data[draft.active];
          const tr = d.trash || [];
          const keep: typeof tr = [];
          tr.forEach((e) => {
            if (e.ts === pushedTs && ((e.k === 'd' && invIds.includes(e.o.id)) || (e.k === 'p' && payIds.includes(e.o.id)))) {
              if (e.k === 'd') d.invoices.push(e.o as Invoice);
              else if (e.k === 'p') d.payments.push(e.o as Payment);
            } else {
              keep.push(e);
            }
          });
          d.trash = keep;
        });
      },
    });
  }, [toastMsg, updateDB]);

  const selArchive = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = [...uiRef.current.sel.ids];
    if (!ids.length) {
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    updateDB((draft) => {
      const d = draft.data[draft.active];
      ids.forEach((k) => {
        const id = k.substring(2);
        const it = k[0] === 'd' ? getInv(d, id) : getPay(d, id);
        if (it) it.arch = true;
      });
    });
    feedback('success', secRef.current);
    setUi((prev) => ({ ...prev, sel: { on: false, ids: [] } }));
    const fn = translate(currentDb, 'txArchived');
    toastMsg(typeof fn === 'function' ? fn(ids.length) : `${ids.length}`, {
      undoFn: () => {
        updateDB((draft) => {
          const d = draft.data[draft.active];
          ids.forEach((k) => {
            const id = k.substring(2);
            const it = k[0] === 'd' ? getInv(d, id) : getPay(d, id);
            if (it) it.arch = false;
          });
        });
      },
    });
  }, [toastMsg, updateDB]);

  // Customer multi-select
  const cselExit = useCallback(() => {
    haptic('tap', secRef.current);
    setUi((prev) => ({ ...prev, csel: { on: false, ids: [] } }));
  }, []);
  const cselToggle = useCallback((cid: string) => {
    haptic('tap', secRef.current);
    setUi((prev) => {
      if (!prev.csel.on) return prev;
      const has = prev.csel.ids.includes(cid);
      return { ...prev, csel: { on: true, ids: has ? prev.csel.ids.filter((x) => x !== cid) : [...prev.csel.ids, cid] } };
    });
  }, []);
  const cselAll = useCallback((cids: string[]) => {
    haptic('tap', secRef.current);
    setUi((prev) => {
      const all = cids.length > 0 && prev.csel.ids.length >= cids.length && cids.every((k) => prev.csel.ids.includes(k));
      return { ...prev, csel: { on: true, ids: all ? [] : cids } };
    });
  }, []);
  const cselPin = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = uiRef.current.csel.ids;
    if (!ids.length) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    if (ids.length === 1) {
      togglePin(ids[0]);
    } else {
      updateDB((draft) => {
        const d = draft.data[draft.active];
        const targets = d.customers.filter((c) => ids.includes(c.id));
        const allPinned = targets.length > 0 && targets.every((c) => !!c.pinned);
        targets.forEach((c) => {
          c.pinned = !allPinned;
        });
      });
      feedback('pin', secRef.current);
      toastMsg(translate(currentDb, 'done'));
    }
    setUi((prev) => ({ ...prev, csel: { on: false, ids: [] } }));
  }, [toastMsg, togglePin, updateDB]);
  const cselShare = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = uiRef.current.csel.ids;
    if (!ids.length) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    haptic('tap', secRef.current);
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    const curIx = buildIndexes(d);
    const txt = ids.map((id) => statementText(currentDb, d, curIx, acc, id)).join('\n\n');
    shareOrCopy(txt, () => toastMsg(translate(currentDb, 'copied')));
    setUi((prev) => ({ ...prev, csel: { on: false, ids: [] } }));
  }, [toastMsg]);
  const cselArchive = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = [...uiRef.current.csel.ids];
    if (!ids.length) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    updateDB((draft) => {
      const d = draft.data[draft.active];
      d.customers.forEach((c) => {
        if (ids.includes(c.id)) c.archived = true;
      });
    });
    feedback('success', secRef.current);
    setUi((prev) => ({ ...prev, csel: { on: false, ids: [] } }));
    const fn = translate(currentDb, 'custArchivedN');
    toastMsg(typeof fn === 'function' ? fn(ids.length) : `${ids.length}`, {
      undoFn: () => {
        updateDB((draft) => {
          const d = draft.data[draft.active];
          d.customers.forEach((c) => {
            if (ids.includes(c.id)) c.archived = false;
          });
        });
      },
    });
  }, [toastMsg, updateDB]);
  const cselDelete = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const ids = [...uiRef.current.csel.ids];
    if (!ids.length) {
      haptic('error', secRef.current);
      toastMsg(translate(currentDb, 'selEmpty'));
      return;
    }
    const pushedTs = Date.now();
    updateDB((draft) => {
      const d = draft.data[draft.active];
      d.trash = d.trash || [];
      const removed = d.customers.filter((c) => ids.includes(c.id));
      removed.forEach((c) => d.trash!.push({ k: 'c', o: c, ts: pushedTs }));
      d.customers = d.customers.filter((c) => !ids.includes(c.id));
    });
    feedback('delete', secRef.current);
    setUi((prev) => ({ ...prev, csel: { on: false, ids: [] } }));
    const deletedFn = translate(currentDb, 'deletedN');
    const msg = (typeof deletedFn === 'function' ? deletedFn(ids.length) : `${ids.length}`) + ' · ' + translate(currentDb, 'trashT');
    toastMsg(msg, {
      undoFn: () => {
        updateDB((draft) => {
          const d = draft.data[draft.active];
          const tr = d.trash || [];
          const keep: typeof tr = [];
          tr.forEach((e) => {
            if (e.ts === pushedTs && e.k === 'c' && ids.includes(e.o.id)) {
              d.customers.push(e.o as Customer);
            } else {
              keep.push(e);
            }
          });
          d.trash = keep;
        });
      },
    });
  }, [toastMsg, updateDB]);

  // Trash
  const trashRestore = useCallback(
    (id: string) => {
      const currentDb = dbRef.current;
      updateDB((draft) => {
        const d = draft.data[draft.active];
        const tr = d.trash || [];
        const i = tr.findIndex((e) => e.o.id === id);
        if (i < 0) return;
        const e = tr[i];
        tr.splice(i, 1);
        if (e.k === 'd') d.invoices.push(e.o as Invoice);
        else if (e.k === 'p') d.payments.push(e.o as Payment);
        else d.customers.push(e.o as Customer);
      });
      feedback('success', secRef.current);
      if (currentDb) toastMsg(`${translate(currentDb, 'restore')} ✓`);
    },
    [toastMsg, updateDB]
  );

  const trashPurge = useCallback(() => {
    updateDB((draft) => {
      draft.data[draft.active].trash = [];
    });
    feedback('delete', secRef.current);
    closeSheet();
  }, [closeSheet, updateDB]);

  // Accounts
  const switchAcc = useCallback(
    (id: string) => {
      updateDB((draft) => {
        draft.active = id;
      });
      closeSheet();
      setStack([{ s: 'home' }]);
    },
    [closeSheet, updateDB]
  );

  const saveAccEdit = useCallback(
    (editId: string, name: string, type: 'grocery' | 'personal', cur: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const nm = name.trim();
      if (!nm) {
        toastMsg(translate(currentDb, 'nameReq'));
        return;
      }
      updateDB((draft) => {
        if (editId === 'new') {
          const id = uid();
          draft.accounts.push({ id, name: nm, type, cur, minorUnit: 2 });
          draft.data[id] = { customers: [], invoices: [], payments: [], seq: 1 };
          draft.active = id;
        } else {
          const a = draft.accounts.find((x) => x.id === editId);
          if (a) {
            a.name = nm;
            a.cur = cur;
            a.type = type;
          }
        }
      });
      toastMsg(translate(currentDb, 'savedName'));
      closeSheet();
      setStack([{ s: 'home' }]);
    },
    [closeSheet, toastMsg, updateDB]
  );

  // Security / Lock
  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const s = secRef.current;
      const currentDb = dbRef.current || safeDb;
      if (Date.now() < (s.lockUntil || 0)) {
        feedback('error', secRef.current);
        toastMsg(`⏳ ${Math.ceil(((s.lockUntil || 0) - Date.now()) / 1000)}s`);
        return false;
      }
      const h = await sha256hex(s.salt + pin);
      if (h !== s.pinHash) {
        updateSec((draft) => {
          draft.failN = (draft.failN || 0) + 1;
          if (draft.failN >= 5) {
            draft.lockUntil = Date.now() + 30000;
            draft.failN = 0;
          }
        });
        feedback('error', secRef.current);
        toastMsg(translate(currentDb, 'wrongPin'));
        return false;
      }
      const pk = await deriveKey(pin, s.salt);
      const mk = s.masterWrapPin ? await unwrapKey(s.masterWrapPin, pk) : null;
      if (!mk) {
        feedback('error', secRef.current);
        toastMsg(translate(currentDb, 'wrongPin'));
        return false;
      }
      feedback('success', secRef.current);
      setMasterKey(mk);
      masterKeyRef.current = mk;
      setLocked(false);
      updateSec((draft) => {
        draft.failN = 0;
      });
      if (afterUnlockRef.current) {
        await afterUnlockRef.current(mk);
      } else {
        setStack([{ s: 'home' }]);
      }
      return true;
    },
    [safeDb, toastMsg, updateSec]
  );

  const setPin = useCallback(
    async (pin: string) => {
      if (!/^\d{4}$/.test(pin)) return;
      const salt = uid() + uid();
      const pinHash = await sha256hex(salt + pin);
      const mk = masterKeyRef.current || (await newMaster());
      const pk = await deriveKey(pin, salt);
      const masterWrapPin = await wrapKey(mk, pk);
      setMasterKey(mk);
      masterKeyRef.current = mk;
      const nextSec: SecurityState = {
        ...secRef.current,
        salt,
        pinHash,
        masterWrapPin,
        enabled: true,
      };
      setSec(nextSec);
      saveSecState(nextSec);
      if (dbRef.current) persistDB(dbRef.current, nextSec, mk);
      feedback('success', nextSec);
      toastMsg('🔒 ✓');
      closeSheet();
    },
    [closeSheet, persistDB, toastMsg]
  );

  const disableLock = useCallback(() => {
    setMasterKey(null);
    masterKeyRef.current = null;
    const nextSec: SecurityState = { ...secRef.current, enabled: false };
    setSec(nextSec);
    saveSecState(nextSec);
    if (dbRef.current) persistDB(dbRef.current, nextSec, null);
    haptic('tap', nextSec);
  }, [persistDB]);

  const lockNow = useCallback(() => {
    setLocked(true);
    setMasterKey(null);
    masterKeyRef.current = null;
    setStack([{ s: 'home' }]);
  }, []);

  const addFp = useCallback(async () => {
    const currentDb = dbRef.current || safeDb;
    try {
      if (!window.PublicKeyCredential || !navigator.credentials || !masterKeyRef.current) throw new Error('no-webauthn');
      const chal = crypto.getRandomValues(new Uint8Array(16));
      const first = crypto.getRandomValues(new Uint8Array(32));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: chal,
          rp: { name: 'Daftar' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'owner', displayName: 'Daftar' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          extensions: { prf: { eval: { first } } } as any,
        },
      })) as any;
      const prf = cred.getClientExtensionResults && cred.getClientExtensionResults().prf;
      if (!prf || !prf.results) throw new Error('no-prf');
      const fk = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(prf.results.first).slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      const hex = [...new Uint8Array(cred.rawId)].map((b) => b.toString(16).padStart(2, '0')).join('');
      if ((secRef.current.fps || []).length >= 5) {
        toastMsg('🖐 5');
        return;
      }
      const wrapped = await wrapKey(masterKeyRef.current, fk);
      updateSec((draft) => {
        draft.fps = draft.fps || [];
        draft.fps.push({ id: hex, wrap: wrapped });
        draft.credId = hex;
        draft.fpWrap = draft.fps[0].wrap;
      });
      toastMsg('✓');
    } catch {
      toastMsg(translate(currentDb, 'fpNo'));
    }
  }, [safeDb, toastMsg, updateSec]);

  const fpDel = useCallback(
    (idx: number) => {
      updateSec((draft) => {
        if (!draft.fps) return;
        draft.fps.splice(idx, 1);
        if (!draft.fps.length) {
          draft.credId = null;
          draft.fpWrap = null;
        }
      });
    },
    [updateSec]
  );

  const fpUnlock = useCallback(async () => {
    const currentDb = dbRef.current || safeDb;
    const s = secRef.current;
    try {
      const cred = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(16)),
          allowCredentials: (s.fps || []).map((f) => ({
            type: 'public-key',
            id: new Uint8Array((f.id.match(/../g) || []).map((h) => parseInt(h, 16))),
          })),
          extensions: { prf: {} } as any,
        },
      })) as any;
      const prf = cred.getClientExtensionResults().prf;
      const fk = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(prf.results.first).slice(0, 32),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      const used = [...new Uint8Array(cred.rawId)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const ent = (s.fps || []).find((f) => f.id === used) || (s.fps || [])[0];
      if (!ent) throw new Error('no-ent');
      const mk = await unwrapKey(ent.wrap, fk);
      if (!mk) throw new Error('bad-unwrap');
      setMasterKey(mk);
      masterKeyRef.current = mk;
      setLocked(false);
      if (afterUnlockRef.current) {
        await afterUnlockRef.current(mk);
      } else {
        setStack([{ s: 'home' }]);
      }
    } catch {
      toastMsg(translate(currentDb, 'fpNo'));
    }
  }, [safeDb, toastMsg]);

  // Demo, Backup, Import, Export
  const applyDemo = useCallback(() => {
    try {
      localStorage.removeItem('daftari_user_cleared');
    } catch {
      // ignore
    }
    const next = demoFixtures();
    setDb(next);
    persistDB(next);
    closeSheet();
    setStack([{ s: 'home' }]);
    toastMsg(translate(next, 'demoLoaded'));
  }, [closeSheet, persistDB, toastMsg]);

  const clearDemo = useCallback(() => {
    try {
      localStorage.setItem('daftari_user_cleared', '1');
    } catch {
      // ignore
    }
    const next = seed();
    setDb(next);
    persistDB(next);
    closeSheet();
    setStack([{ s: 'home' }]);
    toastMsg(translate(next, 'demoCleared'));
  }, [closeSheet, persistDB, toastMsg]);

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(PLAIN_KEY);
      localStorage.removeItem(ENC_KEY);
      localStorage.removeItem('v1raw');
      localStorage.setItem('daftari_user_cleared', '1');
    } catch {
      // ignore
    }
    const next = migrate(null);
    setDb(next);
    persistDB(next);
    closeSheet();
    setStack([{ s: 'home' }]);
  }, [closeSheet, persistDB]);

  const downloadBackup = useCallback(async () => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const obj = await createBackupObj(currentDb);
    dl(`dafter-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(obj), 'application/json');
    toastMsg('✓ backup');
  }, [toastMsg]);

  const restoreBackupObj = useCallback(
    async (o: any): Promise<boolean> => {
      const currentDb = dbRef.current || safeDb;
      const err = await verifyBackupObj(o);
      if (err) {
        toastMsg(`⚠ ${err}`);
        return false;
      }
      try {
        const safety = await createBackupObj(currentDb);
        localStorage.setItem('safety-backup', JSON.stringify(safety));
      } catch {
        // ignore
      }
      const next: DaftariDB = {
        meta: { schemaVersion: o.schemaVersion || 2 },
        lang: (o.settings && o.settings.lang) || currentDb.lang,
        active: o.data[currentDb.active] ? currentDb.active : o.accounts[0].id,
        accounts: o.accounts,
        data: o.data,
      };
      const bad = Invariants.check(next);
      if (bad) {
        toastMsg(`⚠ invariants: ${bad}`);
        return false;
      }
      const migrated = migrate(next);
      setDb(migrated);
      persistDB(migrated);
      setStack([{ s: 'home' }]);
      toastMsg(translate(migrated, 'restoredOk'));
      return true;
    },
    [persistDB, safeDb, toastMsg]
  );

  const restoreBackupFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      try {
        await restoreBackupObj(JSON.parse(text));
      } catch {
        toastMsg('⚠ bad-file');
      }
    },
    [restoreBackupObj, toastMsg]
  );

  const importRows = useCallback(
    (rows: unknown[][]): number => {
      const currentDb = dbRef.current;
      if (!currentDb) return 0;
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const mu = getMU(acc);
      const snap = JSON.stringify({ c: d.customers, i: d.invoices });
      const addedCusts: Customer[] = [];
      const addedInvs: Invoice[] = [];
      let seq = d.seq;

      (rows || []).forEach((r) => {
        if (!Array.isArray(r)) return;
        const cells = r.map((x) => (x == null ? '' : String(x).trim())).filter((x) => x !== '');
        if (cells.length < 2) return;
        let nm: string | null = null;
        let amt: number | null = null;
        let ph = '';
        const nt: string[] = [];
        cells.forEach((cell) => {
          if (ph === '' && /^[+0-9][0-9\s-]{8,}$/.test(cell)) {
            ph = cell;
            return;
          }
          if (amt === null && /^[\d.,،\s]+$/.test(cell) && cell.replace(/\D/g, '').length > 0 && cell.replace(/\D/g, '').length <= 7) {
            amt = Money.parse(cell, mu);
            return;
          }
          if (!nm) {
            nm = cell;
            return;
          }
          nt.push(cell);
        });
        if (!nm || amt === null || isNaN(amt) || amt <= 0) return;
        let c = [...d.customers, ...addedCusts].find((x) => x.name === nm && !x.archived);
        if (!c) {
          c = {
            id: uid(),
            name: nm,
            phone: ph,
            since: String(new Date().getFullYear()),
            archived: false,
            pinned: false,
          };
          addedCusts.push(c);
        }
        const now4 = Date.now();
        addedInvs.push({
          id: uid(),
          code: 'A' + seq++,
          cust: c.id,
          ts: now4,
          createdAt: now4,
          hasTime: true,
          amount: amt,
          note: nt.join(' '),
        });
      });

      const n = addedInvs.length;
      if (!n) {
        toastMsg(translate(currentDb, 'noRes'));
        return 0;
      }
      updateDB((draft) => {
        const dd2 = draft.data[draft.active];
        dd2.customers.push(...addedCusts);
        dd2.invoices.push(...addedInvs);
        dd2.seq = seq;
      });
      closeSheet();
      const impFn = translate(currentDb, 'imported');
      toastMsg(typeof impFn === 'function' ? impFn(n) : `${n}`, {
        undoFn: () => {
          updateDB((draft) => {
            const o = JSON.parse(snap);
            draft.data[draft.active].customers = o.c;
            draft.data[draft.active].invoices = o.i;
          });
        },
      });
      return n;
    },
    [closeSheet, toastMsg, updateDB]
  );

  const paperCommit = useCallback(
    (drafts: { name: string; amt: number; note: string; ok: boolean }[], dateStr: string) => {
      const ds = drafts.filter((x) => x.ok);
      const ts = dateStr ? new Date(`${dateStr}T00:00:00`).getTime() : Date.now();
      const created = Date.now();
      updateDB((draft) => {
        const dd2 = draft.data[draft.active];
        ds.forEach((item) => {
          let c = dd2.customers.find((x) => x.name === item.name && !x.archived);
          if (!c) {
            c = {
              id: uid(),
              name: item.name,
              phone: '',
              since: String(new Date(ts).getFullYear()),
              archived: false,
              pinned: false,
            };
            dd2.customers.push(c);
          }
          dd2.invoices.push({
            id: uid(),
            code: 'P' + dd2.seq++,
            cust: c.id,
            ts,
            createdAt: created,
            hasTime: false,
            amount: item.amt,
            note: item.note,
            src: 'paper',
          });
        });
      });
      closeSheet();
      toastMsg(`✓ ${ds.length}`);
    },
    [closeSheet, toastMsg, updateDB]
  );

  const ocrPick = useCallback(async () => {
    const currentDb = dbRef.current || safeDb;
    if (!(window as any).Tesseract) {
      toastMsg(translate(currentDb, 'xlLoading'));
      setBusy(true);
      try {
        const { libLoad } = await import('../core/libLoader');
        await libLoad('lib/tesseract.min.js');
      } catch {
        setBusy(false);
        toastMsg(translate(currentDb, 'ocrNo'));
        return;
      }
      setBusy(false);
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      toastMsg(translate(currentDb, 'ocrRun'));
      (window as any).Tesseract.recognize(f, 'ara+eng', {})
        .then((r: any) => {
          const txt = String((r && r.data && r.data.text) || '');
          const rows = txt.split(/\n+/).map((l) => l.split(/[,،;\t]+/));
          importRows(rows);
        })
        .catch(() => toastMsg(translate(currentDb, 'ocrNo')));
    };
    inp.click();
  }, [importRows, safeDb, toastMsg]);

  const exportAll = useCallback(() => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    exportAllCSV(d, acc);
  }, []);

  const exportCustCsv = useCallback((cid: string) => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    exportCustomerCSV(d, acc, cid);
  }, []);

  const shareOneById = useCallback(
    (key: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const id = key.substring(2);
      const o = key[0] === 'd' ? getInv(d, id) : getPay(d, id);
      if (!o) return;
      const c = o.cust ? getCust(d, o.cust) : null;
      const mu = getMU(acc);
      const txt =
        `${acc.name} — ${c ? c.name + ' · ' : ''}${translate(currentDb, key[0] === 'd' ? 'debt' : 'pay')} ${fmt(o.amount, mu)} ${acc.cur} · ${new Date(o.ts).toLocaleDateString('en-GB')}` +
        (key[0] === 'd' && (o as Invoice).note ? ` · ${(o as Invoice).note}` : '') +
        (key[0] === 'p' ? ` · ${translate(currentDb, (o as Payment).method || 'cash')}` : '');
      shareOrCopy(txt, () => toastMsg(translate(currentDb, 'copied')));
    },
    [toastMsg]
  );

  const shareCustomerReceipt = useCallback(
    (cid: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const txt = statementText(currentDb, d, buildIndexes(d), acc, cid);
      shareOrCopy(txt, () => toastMsg(translate(currentDb, 'copied')));
    },
    [toastMsg]
  );

  const printCustomer = useCallback(
    (cid: string) => {
      triggerPrint({ kind: 'customer', cid });
    },
    [triggerPrint]
  );

  const printReport = useCallback(
    (r: { a: number; b: number; debt: number; pay: number }, custName: string | null, rows: (string | number)[][]) => {
      triggerPrint({ kind: 'report', r, custName, rows });
    },
    [triggerPrint]
  );

  const sendWA = useCallback((cid: string) => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    const curIx = buildIndexes(d);
    const msg = statementText(currentDb, d, curIx, acc, cid);
    const c = getCust(d, cid);
    const tel = (c?.phone || '').replace(/[^0-9]/g, '');
    const a = document.createElement('a');
    a.href = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }, []);

  const sendSMS = useCallback((cid: string) => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const d = currentDb.data[currentDb.active];
    const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
    const curIx = buildIndexes(d);
    const msg = statementText(currentDb, d, curIx, acc, cid);
    const c = getCust(d, cid);
    const tel = (c?.phone || '').replace(/[^0-9+]/g, '');
    window.location.href = `sms:${tel}?body=${encodeURIComponent(msg)}`;
  }, []);

  const waRemindInv = useCallback(
    (invId: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const d = currentDb.data[currentDb.active];
      const inv = getInv(d, invId);
      if (!inv) return;
      const c = getCust(d, inv.cust);
      if (!c || !c.phone) {
        toastMsg(translate(currentDb, 'waNoPhone'));
        return;
      }
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const rem = invRem(buildIndexes(d), inv);
      const mu = getMU(acc);
      const msg =
        currentDb.lang === 'ar'
          ? `السلام عليكم ${c.name}، يذكّركم ${acc.name} بمتبقي ${fmt(rem, mu)} ${acc.cur} — جزاكم الله خيرًا`
          : `Hello ${c.name}, ${acc.name} reminds you of the remaining ${fmt(rem, mu)} ${acc.cur}. Thank you!`;
      const a = document.createElement('a');
      a.href = `https://wa.me/${(c.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    },
    [toastMsg]
  );

  // QR & Bluetooth
  const openQrSend = useCallback(async () => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    try {
      const { libLoad } = await import('../core/libLoader');
      await libLoad('lib/qrcode.js');
    } catch {
      toastMsg('QR');
      return;
    }
    const json = JSON.stringify({ v: 1, db: currentDb });
    let payload = 'J' + json;
    try {
      if ((window as any).CompressionStream) {
        const cs = new (window as any).CompressionStream('gzip');
        const rs = new Blob([json]).stream().pipeThrough(cs);
        const buf = await new Response(rs).arrayBuffer();
        const u = new Uint8Array(buf);
        let b = '';
        for (let i = 0; i < u.length; i += 8192) {
          b += String.fromCharCode(...u.subarray(i, i + 8192));
        }
        const z = btoa(b);
        if (z.length < json.length) payload = 'Z' + z;
      }
    } catch {
      // ignore
    }
    if (payload.length > 2900) {
      toastMsg(translate(currentDb, 'qrBig'));
      return;
    }
    openSheet({ type: 'qrSend', payload });
  }, [openSheet, toastMsg]);

  const openQrStmt = useCallback(
    async (cid: string) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      try {
        const { libLoad } = await import('../core/libLoader');
        await libLoad('lib/qrcode.js');
      } catch {
        toastMsg('QR');
        return;
      }
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const txt = statementText(currentDb, d, buildIndexes(d), acc, cid);
      if (txt.length > 2900) {
        toastMsg(translate(currentDb, 'qrBig'));
        return;
      }
      openSheet({ type: 'qrStmt', cid, text: txt });
    },
    [openSheet, toastMsg]
  );

  const qrApply = useCallback(
    async (payload: string) => {
      const currentDb = dbRef.current || safeDb;
      try {
        let json: string;
        if (payload[0] === 'Z') {
          const bin = atob(payload.slice(1));
          const u = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const ds = new (window as any).DecompressionStream('gzip');
          const rs = new Blob([u]).stream().pipeThrough(ds);
          json = await new Response(rs).text();
        } else {
          json = payload.slice(1);
        }
        const obj = JSON.parse(json);
        if (obj && obj.format === 'dafter-backup') {
          await restoreBackupObj(obj);
          return;
        }
        if (!obj || !obj.db) throw new Error('invalid');
        const next = migrate(obj.db);
        setDb(next);
        persistDB(next);
        setStack([{ s: 'home' }]);
        toastMsg(translate(next, 'qrDone'));
      } catch {
        toastMsg(currentDb.lang === 'ar' ? 'تعذّرت قراءة البيانات' : 'Could not read data');
      }
    },
    [persistDB, restoreBackupObj, safeDb, toastMsg]
  );

  const BT_SERV = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  ];

  const connectBT = useCallback(async () => {
    const currentDb = dbRef.current || safeDb;
    const nav = navigator as any;
    if (!nav.bluetooth) {
      toastMsg(translate(currentDb, 'btNo'));
      return;
    }
    try {
      const dev = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERV });
      const server = await dev.gatt.connect();
      let foundChar: any = null;
      for (const su of BT_SERV) {
        try {
          const svc = await server.getPrimaryService(su);
          const chs = await svc.getCharacteristics();
          foundChar = chs.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          if (foundChar) break;
        } catch {
          // continue
        }
      }
      if (!foundChar) throw new Error('no-char');
      btCharRef.current = foundChar;
      const btName = dev.name || 'BT';
      updateSec((draft) => {
        draft.btName = btName;
      });
      toastMsg(`🖨 ${btName}`);
    } catch {
      toastMsg(translate(currentDb, 'btFail'));
    }
  }, [safeDb, toastMsg, updateSec]);

  const printBT = useCallback(
    async (text: string) => {
      const currentDb = dbRef.current || safeDb;
      const ch = btCharRef.current;
      if (!ch) {
        toastMsg(translate(currentDb, 'btNoDev'));
        return;
      }
      const writeChunks = async (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 100) {
          await ch.writeValue(bytes.slice(i, i + 100));
        }
      };
      try {
        await writeChunks(new Uint8Array([0x1b, 0x40]));
        await writeChunks(new TextEncoder().encode(text + '\n\n\n'));
        await writeChunks(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
        toastMsg('🖨 ✓');
      } catch {
        toastMsg(translate(currentDb, 'btFail'));
      }
    },
    [safeDb, toastMsg]
  );

  const openContacts = useCallback(() => {
    const nav = navigator as any;
    if (nav.contacts && typeof nav.contacts.select === 'function') {
      nav.contacts
        .select(['name', 'tel'], { multiple: false })
        .then((res: any[]) => {
          if (res && res[0]) {
            const c = res[0];
            setUi((prev) => ({
              ...prev,
              nc: {
                ...prev.nc,
                name: (c.name && c.name[0]) || prev.nc.name,
                phone: (c.tel && c.tel[0]) || prev.nc.phone,
              },
            }));
            closeSheet();
          }
        })
        .catch(() => openSheet({ type: 'contactsInfo' }));
      return;
    }
    openSheet({ type: 'contactsInfo' });
  }, [closeSheet, openSheet]);

  // Voice & Recognition
  const stopMicMeter = useCallback(() => {
    if (micAnimRef.current) clearInterval(micAnimRef.current);
    micAnimRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((tr) => tr.stop());
      micStreamRef.current = null;
    }
    if (srRef.current) {
      try {
        srRef.current.abort();
      } catch {
        // ignore
      }
      srRef.current = null;
    }
    setMicLevel(new Array(16).fill(4));
  }, []);

  const startMicMeter = useCallback(() => {
    stopMicMeter();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((st) => {
          micStreamRef.current = st;
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          if (!AC) return;
          micCtxRef.current = micCtxRef.current || new AC();
          const an = micCtxRef.current.createAnalyser();
          an.fftSize = 64;
          micCtxRef.current.createMediaStreamSource(st).connect(an);
          const buf = new Uint8Array(an.frequencyBinCount);
          micAnimRef.current = window.setInterval(() => {
            an.getByteFrequencyData(buf);
            const bars: number[] = [];
            for (let i = 0; i < 16; i++) {
              const v = (buf[i * 2] || 0) / 255;
              bars.push(Math.round(4 + v * 34));
            }
            setMicLevel(bars);
          }, 120);
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }, [stopMicMeter]);

  const endRec = useCallback(() => {
    if (recEndTimerRef.current) clearTimeout(recEndTimerRef.current);
    if (recTickTimerRef.current) clearInterval(recTickTimerRef.current);
    stopMicMeter();
    const currentDb = dbRef.current;
    const r = uiRef.current.rec;
    if (!r || r.st !== 'rec' || !currentDb) return;
    const d = currentDb.data[currentDb.active];
    const personal = isPersonalAccount(currentDb);
    const activeCusts = (d.customers || []).filter((c) => !c.archived);
    if (!personal && !activeCusts.length) {
      setUi((prev) => ({ ...prev, rec: null }));
      toastMsg(translate(currentDb, 'noCustomers'));
      go('newcust', {});
      return;
    }
    feedback(r.d && r.d.say ? 'recStop' : 'error', secRef.current);
    const pre = personal ? null : (r.pre ? getCust(d, r.pre) : null) || (ctxCust ? getCust(d, ctxCust) : null);
    setUi((prev) => {
      if (!prev.rec || prev.rec.st !== 'rec') return prev;
      return {
        ...prev,
        rec: {
          ...prev.rec,
          st: 'edit',
          warn: prev.rec.warn || 'nospeech',
          d:
            prev.rec.kind === 'debt'
              ? { name: pre ? pre.name : '', amt: 0, note: '', due: null, say: '', custId: pre ? pre.id : null }
              : { name: pre ? pre.name : '', amt: 0, method: 'cash', say: '', custId: pre ? pre.id : null },
          cands: pre ? [] : activeCusts.slice(0, 5),
        },
      };
    });
  }, [ctxCust, go, stopMicMeter, toastMsg]);

  const handleSay = useCallback(
    (kind: 'debt' | 'pay', text: string, conf?: number | null) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      const r0 = uiRef.current.rec;
      if (!r0 || !(r0.st === 'rec' || (r0.st === 'edit' && !r0.d.say))) return;
      if (recEndTimerRef.current) clearTimeout(recEndTimerRef.current);
      if (recTickTimerRef.current) clearInterval(recTickTimerRef.current);
      stopMicMeter();

      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const mu = getMU(acc);
      const pr = parseSay(text || '', d, secRef.current, mu);
      let warn: string | null = null;
      if (!text || !String(text).trim()) warn = 'nospeech';
      else if (pr.amt <= 0) warn = 'noamt';
      else if (pr.amt > 1000000 * Math.pow(10, mu)) warn = 'toobig';
      else if ((conf == null ? 1 : conf) < 0.45) warn = 'lowconf';
      if (warn) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'warn_' + warn));
      } else {
        playSound('recStop', secRef.current);
        haptic('recStop', secRef.current);
      }

      setUi((prev) => {
        if (!prev.rec) return prev;
        return {
          ...prev,
          rec: {
            ...prev.rec,
            st: 'edit',
            warn,
            d:
              kind === 'debt'
                ? { name: pr.name, amt: pr.amt, note: pr.note, due: null, say: text, custId: pr.custId }
                : { name: pr.name, amt: pr.amt, method: 'cash', say: text, custId: pr.custId },
          },
        };
      });
    },
    [stopMicMeter, toastMsg]
  );

  const startRec = useCallback(
    (kind: 'debt' | 'pay', custId?: string | null) => {
      const currentDb = dbRef.current;
      if (!currentDb) return;
      feedback('recStart', secRef.current);
      setLiveTranscript('');
      const initialRec: RecState = {
        kind,
        st: 'rec',
        edit: false,
        d: { name: '', amt: 0, note: '', due: null, method: 'cash', say: '', custId: custId || null },
        cands: [],
        pre: custId || null,
        t0: Date.now(),
      };
      setUi((prev) => ({ ...prev, rec: initialRec }));
      go('rec', { kind });

      if (recEndTimerRef.current) clearTimeout(recEndTimerRef.current);
      if (recTickTimerRef.current) clearInterval(recTickTimerRef.current);
      startMicMeter();

      recTickTimerRef.current = window.setInterval(() => {
        const r = uiRef.current.rec;
        if (!r || r.st !== 'rec') return;
        const sc = Math.floor((Date.now() - r.t0) / 1000);
        if (sc >= 30) {
          toastMsg(translate(currentDb, 'recLong'));
          endRec();
        }
      }, 500);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const r = new SR();
          r.lang = currentDb.lang === 'ar' ? 'ar-SA' : 'en-US';
          r.interimResults = true;
          r.maxAlternatives = 1;
          r.onresult = (e: any) => {
            const res = e.results[0][0];
            if (!e.results[0].isFinal) {
              setLiveTranscript(res.transcript || '');
            } else {
              handleSay(kind, res.transcript || '', res.confidence);
            }
          };
          r.onerror = (ev: any) => {
            toastMsg(translate(currentDb, ev && ev.error === 'no-speech' ? 'warn_nospeech' : 'webNo'));
            if (uiRef.current.rec && uiRef.current.rec.st === 'rec') {
              recEndTimerRef.current = window.setTimeout(endRec, 600);
            }
          };
          r.onend = () => {
            if (uiRef.current.rec && uiRef.current.rec.st === 'rec') {
              recEndTimerRef.current = window.setTimeout(endRec, 400);
            }
          };
          srRef.current = r;
          r.start();
          return;
        } catch {
          // fallback timer below
        }
      }
      recEndTimerRef.current = window.setTimeout(endRec, 2600);
    },
    [endRec, go, handleSay, startMicMeter, toastMsg]
  );

  const cancelRec = useCallback(() => {
    if (recEndTimerRef.current) clearTimeout(recEndTimerRef.current);
    if (recTickTimerRef.current) clearInterval(recTickTimerRef.current);
    stopMicMeter();
    haptic('tap', secRef.current);
    setUi((prev) => ({ ...prev, rec: null }));
    back();
  }, [back, stopMicMeter]);

  const retryRec = useCallback(() => {
    const k = uiRef.current.rec ? uiRef.current.rec.kind : 'debt';
    setUi((prev) => ({ ...prev, rec: null }));
    startRec(k);
  }, [startRec]);

  const recConfirm = useCallback(
    (editedCustId?: string | null, editedAmt?: string, editedNote?: string) => {
      const r = uiRef.current.rec;
      const currentDb = dbRef.current;
      if (!r || !currentDb) return;
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const mu = getMU(acc);
      const personal = isPersonalAccount(currentDb);

      const finalCustId = editedCustId !== undefined ? editedCustId : r.d.custId;
      const finalAmt = editedAmt !== undefined ? Money.parse(editedAmt, mu) : r.d.amt;
      const finalNote = editedNote !== undefined ? editedNote : r.d.note || '';

      const c = personal ? null : getCust(d, finalCustId) || getCust(d, ctxCust);
      if ((!c && !personal) || !finalAmt) {
        haptic('error', secRef.current);
        toastMsg(translate(currentDb, 'chooseFirst'));
        return;
      }

      if (r.d.say && finalAmt) {
        updateSec((draft) => {
          const corrs = draft.corrections || (draft.corrections = []);
          const existing = corrs.find((x) => x.t === r.d.say);
          if (existing) {
            existing.a = finalAmt;
            existing.n = (existing.n || 1) + 1;
          } else {
            corrs.push({ t: r.d.say, a: finalAmt, n: 1 });
            if (corrs.length > 200) corrs.shift();
          }
        });
      }

      const now = Date.now();
      if (r.kind === 'debt') {
        const newId = uid();
        updateDB((draft) => {
          const dd2 = draft.data[draft.active];
          dd2.invoices.push({
            id: newId,
            code: 'A' + dd2.seq++,
            cust: c ? c.id : null,
            ts: now,
            createdAt: now,
            hasTime: true,
            amount: finalAmt,
            note: finalNote,
            due: null,
            src: r.src || 'voice',
          });
        });
        feedback('debt', secRef.current);
        speak(`${c ? c.name + '، ' : ''}${translate(currentDb, 'newDebt')} ${finalAmt} ${acc.cur}`, secRef.current, currentDb.lang);
        setUi((prev) => ({ ...prev, rec: null }));
        setStack([c ? { s: 'profile', p: { id: c.id } } : { s: 'home' }]);
        doneSnack('debt', newId, c ? c.id : null, finalAmt);
      } else {
        const curIx = buildIndexes(d);
        const alloc = c ? allocatePayment(d, curIx, c.id, finalAmt) : [];
        const newId = uid();
        updateDB((draft) => {
          const dd2 = draft.data[draft.active];
          dd2.payments.push({
            id: newId,
            cust: c ? c.id : null,
            ts: now,
            createdAt: now,
            hasTime: true,
            amount: finalAmt,
            method: r.d.method || 'cash',
            alloc,
            src: 'voice',
          });
        });
        feedback('pay', secRef.current);
        speak(`${c ? c.name + '، ' : ''}${translate(currentDb, 'pay')} ${finalAmt} ${acc.cur}`, secRef.current, currentDb.lang);
        setUi((prev) => ({ ...prev, rec: null }));
        setStack([c ? { s: 'profile', p: { id: c.id } } : { s: 'home' }]);
        doneSnack('pay', newId, c ? c.id : null, finalAmt);
      }
    },
    [ctxCust, doneSnack, toastMsg, updateDB, updateSec]
  );

  const extSay = useCallback(
    (text: string): boolean => {
      const clean = String(text || '').trim();
      if (!clean) return false;
      const kind: 'debt' | 'pay' = /سداد|سدّد|ادفع|إيداع|ايداع|pay|deposit/i.test(clean) ? 'pay' : 'debt';
      const currentDb = dbRef.current;
      if (!currentDb) return false;
      const d = currentDb.data[currentDb.active];
      const acc = currentDb.accounts.find((a) => a.id === currentDb.active) || currentDb.accounts[0];
      const mu = getMU(acc);
      const pr = parseSay(clean, d, secRef.current, mu);
      let warn: string | null = null;
      if (pr.amt <= 0) warn = 'noamt';
      else if (pr.amt > 1000000 * Math.pow(10, mu)) warn = 'toobig';
      if (warn) toastMsg(translate(currentDb, 'warn_' + warn));

      setUi((prev) => ({
        ...prev,
        rec: {
          kind,
          st: 'edit',
          edit: false,
          warn,
          pre: ctxCust || null,
          t0: Date.now(),
          cands: pr.custId ? [] : (d.customers || []).filter((c) => !c.archived).slice(0, 5),
          d:
            kind === 'debt'
              ? { name: pr.name, amt: pr.amt, note: pr.note, due: null, say: clean, custId: pr.custId }
              : { name: pr.name, amt: pr.amt, method: 'cash', say: clean, custId: pr.custId },
        },
      }));
      go('rec', { kind });
      return true;
    },
    [ctxCust, go, toastMsg]
  );

  // Share-target URL params intake (?t= or ?text=)
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const st = u.searchParams.get('t') || u.searchParams.get('text') || u.searchParams.get('title');
      if (st) {
        window.history.replaceState(null, '', window.location.pathname);
        setTimeout(() => {
          if (extSay(st) && dbRef.current) {
            toastMsg(translate(dbRef.current, 'shareGot'));
          }
        }, 700);
      }
    } catch {
      // ignore
    }
  }, [extSay, toastMsg]);

  const checkUpdates = useCallback(async () => {
    setUpdater((prev) => ({ ...prev, state: 'checking', lastError: null }));
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const remote = await res.json();
      setUpdater((prev) => ({
        ...prev,
        state: 'idle',
        manifest: prev.manifest || remote,
        remote: null,
      }));
    } catch (e: any) {
      setUpdater((prev) => ({ ...prev, state: 'error', lastError: e?.message || 'check-failed' }));
    }
  }, []);

  const value: AppContextValue = {
    db,
    sec,
    locked,
    busy,
    stack,
    curScr,
    ctxCust,
    dd,
    curAcc,
    ix,
    avMap,
    isP,
    darkOn,
    appearance,
    setAppearanceValues,
    t,
    toast,
    toastMsg,
    hideToast,
    doUndoToast,
    sheet,
    openSheet,
    closeSheet,
    ui,
    setUi,
    printData,
    triggerPrint,
    tab,
    go,
    back,
    resetStack,
    updateDB,
    updateSec,
    setCur,
    setLang,
    goWiz,
    wizConfirm,
    addOpening,
    applyReturn,
    saveInvEdit,
    quickPaySave,
    saveCustomer,
    archiveCustomer,
    restoreCustomer,
    togglePin,
    setPhoto,
    selExit,
    selStart,
    selToggle,
    selDay,
    selAllVisible,
    selShare,
    selDelete,
    selArchive,
    cselExit,
    cselToggle,
    cselAll,
    cselPin,
    cselShare,
    cselArchive,
    cselDelete,
    trashRestore,
    trashPurge,
    switchAcc,
    saveAccEdit,
    verifyPin,
    setPin,
    disableLock,
    lockNow,
    addFp,
    fpDel,
    fpUnlock,
    applyDemo,
    clearDemo,
    resetAll,
    downloadBackup,
    restoreBackupFile,
    restoreBackupObj,
    importRows,
    paperCommit,
    ocrPick,
    exportAll,
    exportCustCsv,
    shareOneById,
    shareCustomerReceipt,
    printCustomer,
    printReport,
    sendWA,
    sendSMS,
    waRemindInv,
    openQrSend,
    openQrStmt,
    qrApply,
    connectBT,
    printBT,
    openContacts,
    startRec,
    handleSay,
    endRec,
    cancelRec,
    retryRec,
    recConfirm,
    extSay,
    liveTranscript,
    micLevel,
    updater,
    checkUpdates,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
