/* ================= storage + security ================= */
const PLAIN = "dafter_v3",
  SECK = "dafter_v3_sec",
  ENC = "dafter_v3_enc";
const MIN = 6e4,
  H = 36e5,
  D = 864e5;
const uid = () => Math.random().toString(36).slice(2, 9);
let db = null,
  sec = {
    enabled: false,
    salt: "",
    pinHash: "",
    autoMin: 2,
    sound: true,
    vib: true,
    credId: null,
    fpWrap: null,
    fps: [],
    dark: false,
    speak: false,
    vosk: false,
    btName: "",
  },
  sessionKey = null,
  masterKey = null,
  locked = false;
try {
  sec = Object.assign(
    sec,
    JSON.parse(localStorage.getItem(SECK) || "null") || {},
  );
} catch (e) {}
if (!sec.fps) sec.fps = [];
if (sec.credId && sec.fpWrap && !sec.fps.length)
  sec.fps = [{ id: sec.credId, wrap: sec.fpWrap }];
const saveSec = () => {
  try {
    localStorage.setItem(SECK, JSON.stringify(sec));
  } catch (e) {}
};
function storageFailure() {
  toastMsg(
    db && db.lang === "ar"
      ? "⚠ تعذّر الحفظ؛ لم تُستبدل النسخة المحفوظة."
      : "⚠ Save failed; the stored copy was not replaced.",
  );
}
function save() {
  _IX = null;
  const pending = Store.persist();
  // Existing synchronous UI callers may ignore the Promise; callers needing a
  // durability guarantee must await it. Attach a handler without hiding rejection.
  pending.catch(storageFailure);
  return pending;
}
/* crypto */
const te = new TextEncoder(),
  td = new TextDecoder();
async function sha256hex(s) {
  if (!globalThis.crypto || !crypto.subtle)
    throw new Error("crypto-unavailable");
  const b = await crypto.subtle.digest("SHA-256", te.encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
// Compatibility only: never generate new backups or PIN hashes with this checksum.
function legacyChecksum(s) {
  let out = "";
  for (let r = 0; r < 4; r++) {
    let h = (0x811c9dc5 ^ (r * 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}
async function deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey(
    "raw",
    te.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: te.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function newMaster() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}
async function wrapKey(mk, withKey) {
  const raw = await crypto.subtle.exportKey("raw", mk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, withKey, raw);
  return { iv: [...iv], ct: [...new Uint8Array(ct)] };
}
async function unwrapKey(pack, withKey) {
  try {
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(pack.iv) },
      withKey,
      new Uint8Array(pack.ct),
    );
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
      "encrypt",
      "decrypt",
    ]);
  } catch (e) {
    return null;
  }
}
async function encJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    te.encode(JSON.stringify(obj)),
  );
  return { iv: [...iv], ct: [...new Uint8Array(ct)] };
}
async function decJSON(pack, key) {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(pack.iv) },
      key,
      new Uint8Array(pack.ct),
    );
    return JSON.parse(td.decode(pt));
  } catch (e) {
    return null;
  }
}

/* IndexedDB is authoritative. localStorage is a best-effort legacy mirror. */
const securityFields = [
  "enabled",
  "salt",
  "pinHash",
  "masterWrapPin",
  "fps",
  "credId",
  "fpWrap",
];
function cryptoSettings(settings) {
  const out = {};
  for (const k of securityFields)
    out[k] = settings[k] === undefined ? null : settings[k];
  return LedgerSchema.clone(out);
}
const Store = {
  dbp: null,
  tail: Promise.resolve(),
  revision: 0,
  open() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise((resolve, reject) => {
      try {
        const q = indexedDB.open("dafter-db", 1);
        q.onupgradeneeded = () => q.result.createObjectStore("kv");
        q.onerror = () => reject(q.error);
        q.onblocked = () => reject(new Error("storage-blocked"));
        q.onsuccess = () => {
          q.result.onversionchange = () => {
            q.result.close();
            this.dbp = null;
          };
          resolve(q.result);
        };
      } catch (e) {
        reject(e);
      }
    });
    this.dbp.catch(() => {
      this.dbp = null;
    });
    return this.dbp;
  },
  async load() {
    const d = await this.open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction("kv", "readonly");
      const q = tx.objectStore("kv").get("db");
      tx.oncomplete = () => resolve(q.result == null ? null : q.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error("storage-read-failed"));
    });
  },
  persist() {
    return this.write(db);
  },
  write(value, options = {}) {
    if (this.guardedTx) {
      try {
        this.guardedTx.abort();
      } catch (e) {}
    }
    let snapshot, settings, key;
    try {
      if (!value || locked) throw new Error("storage-locked");
      snapshot = LedgerSchema.clone(value);
      LedgerSchema.validate(snapshot);
      settings = LedgerSchema.clone(options.security || sec);
      key = options.key === undefined ? masterKey : options.key;
      if (settings.enabled && !key) throw new Error("storage-locked");
    } catch (e) {
      return Promise.reject(e);
    }
    const revision = ++this.revision;
    const job = async () => {
      const record = settings.enabled
        ? { __enc: await encJSON(snapshot, key) }
        : snapshot;
      record.__security = cryptoSettings(settings);
      let safety = null;
      if (options.safety) {
        safety = await this.load();
        if (safety && settings.enabled && !safety.__enc)
          safety = {
            __enc: await encJSON(safety, key),
            __security: cryptoSettings(settings),
          };
      }
      const d = await this.open();
      if (options.guard && !options.guard()) throw new Error("data-changed");
      await new Promise((resolve, reject) => {
        const tx = d.transaction("kv", "readwrite");
        const kv = tx.objectStore("kv");
        if (options.guard) this.guardedTx = tx;
        const clear = () => {
          if (this.guardedTx === tx) this.guardedTx = null;
        };
        tx.oncomplete = () => {
          clear();
          resolve();
        };
        tx.onabort = tx.onerror = () => {
          clear();
          reject(tx.error || new Error("storage-write-failed"));
        };
        // Safety and replacement share one transaction. The safety copy keeps its
        // original encryption; it is never written to plaintext localStorage.
        try {
          if (options.clearSafety) {
            kv.delete("safety-backup");
            kv.delete("recovery-previous");
          }
          if (safety) kv.put(safety, "safety-backup");
          kv.put(record, "db");
        } catch (e) {
          tx.abort();
          reject(e);
        }
      });
      try {
        if (settings.enabled) {
          localStorage.setItem(ENC, JSON.stringify(record.__enc));
          localStorage.removeItem(PLAIN);
          localStorage.removeItem("v1raw");
          localStorage.removeItem("safety-backup");
        } else {
          localStorage.setItem(PLAIN, JSON.stringify(snapshot));
          localStorage.removeItem(ENC);
        }
        // Mirror the committed crypto configuration, never an uncommitted PIN change.
        localStorage.setItem(
          SECK,
          JSON.stringify(Object.assign({}, sec, record.__security)),
        );
      } catch (e) {
        if (settings.enabled) {
          try {
            localStorage.removeItem(PLAIN);
            localStorage.removeItem("v1raw");
            localStorage.removeItem("safety-backup");
          } catch (_) {}
        }
        console.warn("Ledger committed; legacy cache unavailable");
      }
      return { revision, record };
    };
    const pending = this.tail.then(job);
    this.tail = pending.catch(() => {});
    return pending;
  },
};
async function commitSecurity(next, key) {
  if (Store.cryptoBusy || locked) throw new Error("storage-busy");
  Store.cryptoBusy = true;
  try {
    const before = JSON.stringify(db),
      revision = Store.revision;
    await Store.write(db, {
      security: next,
      key,
      clearSafety: true,
      guard: () =>
        !locked &&
        Store.revision === revision + 1 &&
        JSON.stringify(db) === before,
    });
    sec = next;
    masterKey = key;
    saveSec();
  } finally {
    Store.cryptoBusy = false;
  }
}
try {
  if (navigator.storage && navigator.storage.persist)
    navigator.storage.persist().catch(() => {});
} catch (e) {}
/* Version 2 covers all semantic fields; v1 checksums remain readable. */
const Backup = {
  busy: false,
  payload(o) {
    if (o.formatVersion === 1)
      return JSON.stringify({ a: o.accounts, d: o.data, s: o.settings });
    return JSON.stringify({
      format: o.format,
      formatVersion: o.formatVersion,
      schemaVersion: o.schemaVersion,
      exportedAt: o.exportedAt,
      accounts: o.accounts,
      data: o.data,
      settings: o.settings,
      active: o.active,
    });
  },
  async obj() {
    if (locked || !db) throw new Error("storage-locked");
    const x = LedgerSchema.migrate(db);
    const o = {
      format: "dafter-backup",
      formatVersion: 2,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      accounts: x.accounts,
      data: x.data,
      settings: { lang: x.lang },
      active: x.active,
    };
    o.checksum = await sha256hex(this.payload(o));
    return o;
  },
  async decode(input) {
    const o = LedgerSchema.clone(input);
    if (
      !o ||
      o.format !== "dafter-backup" ||
      ![1, 2].includes(o.formatVersion) ||
      typeof o.checksum !== "string"
    )
      throw new Error("bad-format");
    if (
      (o.formatVersion === 1 && o.checksum.length === 32
        ? legacyChecksum(this.payload(o))
        : await sha256hex(this.payload(o))) !== o.checksum
    )
      throw new Error("checksum-mismatch");
    return LedgerSchema.migrate({
      meta: { schemaVersion: o.schemaVersion },
      accounts: o.accounts,
      data: o.data,
      lang: o.settings && o.settings.lang,
      active: o.active || (o.formatVersion === 1 && o.accounts[0].id),
    });
  },
  async verify(o) {
    try {
      await this.decode(o);
      return "";
    } catch (e) {
      return e.message;
    }
  },
  async restore(input, legacy = false) {
    if (this.busy || locked) return false;
    this.busy = true;
    const old = db,
      before = JSON.stringify(db),
      revision = Store.revision;
    try {
      const next = legacy
        ? LedgerSchema.migrate(input)
        : await this.decode(input);
      if (
        locked ||
        db !== old ||
        JSON.stringify(db) !== before ||
        Store.revision !== revision
      )
        throw new Error("data-changed");
      await Store.write(next, {
        safety: true,
        guard: () =>
          !locked &&
          db === old &&
          JSON.stringify(db) === before &&
          Store.revision === revision + 1,
      });
      // A synchronous legacy caller may mutate while the IDB transaction commits.
      // Its queued save is newer; never install stale restored state over that edit.
      if (
        db !== old ||
        JSON.stringify(db) !== before ||
        Store.revision !== revision + 1
      )
        throw new Error("data-changed");
      db = next;
      _IX = null;
      stack = [{ s: "home" }];
      render();
      const warnings = LedgerSchema.validate(next);
      toastMsg(
        t("restoredOk") +
          (warnings.length
            ? " · ⚠ " +
              (db.lang === "ar"
                ? "توجد روابط قديمة مفقودة"
                : "Some legacy references are missing")
            : ""),
      );
      return true;
    } catch (e) {
      toastMsg("⚠ " + esc(e.message || "restore-failed"));
      return false;
    } finally {
      this.busy = false;
    }
  },
  download() {
    return this.obj()
      .then((o) => {
        dl(
          "dafter-backup-" + new Date().toISOString().slice(0, 10) + ".json",
          JSON.stringify(o),
          "application/json",
        );
        toastMsg("✓ backup");
      })
      .catch(storageFailure);
  },
  pick(inp) {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 32 * 1024 * 1024) {
      toastMsg("⚠ backup-too-large");
      return;
    }
    const r = new FileReader();
    r.onerror = () => toastMsg("⚠ bad-file");
    r.onload = async () => {
      try {
        await this.restore(JSON.parse(r.result));
      } catch (e) {
        toastMsg("⚠ bad-file");
      }
    };
    r.readAsText(f);
  },
};
