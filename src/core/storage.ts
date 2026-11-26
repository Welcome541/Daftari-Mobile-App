import type { DaftariDB, SecurityState } from '../types/daftari';
import { ENC_KEY, PLAIN_KEY, decJSON, encJSON, sha256hex } from './crypto';
import { Invariants } from './ledger';
import { translate } from './i18n';

export const Store = {
  dbp: null as Promise<IDBDatabase> | null,
  open(): Promise<IDBDatabase> {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise((res, rej) => {
      try {
        if (!window.indexedDB) return rej('noidb');
        const q = indexedDB.open('dafter-db', 1);
        q.onupgradeneeded = () => {
          q.result.createObjectStore('kv');
        };
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      } catch (e) {
        rej(e);
      }
    });
    return this.dbp;
  },
  async load(): Promise<any> {
    try {
      const d = await this.open();
      return await new Promise((res, rej) => {
        const q = d.transaction('kv', 'readonly').objectStore('kv').get('db');
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
    } catch {
      return null;
    }
  },
  persist(db: DaftariDB | null, sec: SecurityState, masterKey: CryptoKey | null): void {
    if (!db) return;
    const write = (o: unknown) =>
      this.open()
        .then(
          (d) =>
            new Promise<void>((res, rej) => {
              const tx = d.transaction('kv', 'readwrite');
              try {
                tx.objectStore('kv').put(o, 'db');
              } catch (e) {
                return rej(e);
              }
              tx.oncomplete = () => res();
              tx.onerror = () => rej(tx.error);
            })
        )
        .catch(() => {});

    if (sec.enabled && masterKey) {
      encJSON(db, masterKey)
        .then((p) => write({ __enc: p }))
        .catch(() => write(JSON.parse(JSON.stringify(db))));
    } else {
      write(JSON.parse(JSON.stringify(db)));
    }
  },
};

try {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
} catch {
  // ignore
}

export function saveDBToStorage(
  db: DaftariDB,
  sec: SecurityState,
  masterKey: CryptoKey | null,
  onToast: (msg: string) => void
): void {
  if (sec.enabled && masterKey) {
    encJSON(db, masterKey).then((p) => {
      try {
        localStorage.setItem(ENC_KEY, JSON.stringify(p));
        localStorage.removeItem(PLAIN_KEY);
      } catch {
        onToast(translate(db, 'quota'));
      }
    });
  } else {
    try {
      localStorage.setItem(PLAIN_KEY, JSON.stringify(db));
      localStorage.removeItem(ENC_KEY);
    } catch {
      onToast(translate(db, 'quota'));
    }
  }
  Store.persist(db, sec, masterKey);
  try {
    let tot = 0;
    for (const k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
        tot += (localStorage[k] || '').length * 2;
      }
    }
    if (tot > 4 * 1024 * 1024 && !(window as any).__qw) {
      (window as any).__qw = 1;
      setTimeout(() => onToast('⚠ ' + translate(db, 'quotaWarn')), 60);
    }
  } catch {
    // ignore
  }
}

export async function createBackupObj(db: DaftariDB) {
  const o: any = {
    format: 'dafter-backup',
    formatVersion: 1,
    schemaVersion: (db.meta || {}).schemaVersion || 2,
    exportedAt: new Date().toISOString(),
    accounts: db.accounts,
    data: db.data,
    settings: { lang: db.lang },
    active: db.active,
  };
  o.checksum = await sha256hex(JSON.stringify({ a: o.accounts, d: o.data, s: o.settings }));
  return o;
}

export async function verifyBackupObj(o: any): Promise<string> {
  if (!o || o.format !== 'dafter-backup' || !o.checksum) return 'bad-format';
  const c = await sha256hex(JSON.stringify({ a: o.accounts, d: o.data, s: o.settings }));
  if (c !== o.checksum) return 'checksum-mismatch';
  return Invariants.check({ accounts: o.accounts, data: o.data });
}

export { decJSON };
