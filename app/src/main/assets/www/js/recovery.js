/* Recovery is deliberately separate from normal ledger mutations. It can run
 * while locked, but cannot install encrypted data without authenticating it. */
const Recovery = (() => {
  let busy = false;
  const keys = ["db", "safety-backup", "recovery-previous"];
  async function readRecords() {
    const connection = await Store.open();
    return new Promise((resolve, reject) => {
      const tx = connection.transaction("kv", "readonly");
      const result = {};
      for (const key of keys) {
        const request = tx.objectStore("kv").get(key);
        request.onsuccess = () => {
          result[key] = request.result;
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error("recovery-read-failed"));
    });
  }
  async function rescueObject() {
    await Store.tail;
    const result = {
      format: "dafter-rescue",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      records: {},
      legacy: {},
      errors: [],
    };
    try {
      result.records = await readRecords();
    } catch (_) {
      result.errors.push("indexeddb-unavailable");
    }
    for (const key of [PLAIN, ENC, SECK, "v1raw", "safety-backup"]) {
      try {
        result.legacy[key] = localStorage.getItem(key);
      } catch (_) {
        result.errors.push("legacy-cache-unavailable");
        break;
      }
    }
    if (
      !Object.values(result.records).some((v) => v != null) &&
      !Object.values(result.legacy).some((v) => v != null)
    )
      throw new Error("no-recoverable-data");
    return result;
  }
  async function restoreSafety(pin) {
    if (busy || !locked) throw new Error("recovery-requires-locked-screen");
    if (Date.now() < (sec.lockUntil || 0))
      throw new Error("retry-after-lockout");
    busy = true;
    const run = async () => {
      const records = await readRecords();
      const safety = records["safety-backup"];
      if (!safety) throw new Error("no-safety-copy");
      const settings = safety.__security || sec;
      let value = safety,
        key = null;
      if (safety.__enc) {
        if (!settings.enabled || !settings.salt || !settings.masterWrapPin)
          throw new Error("missing-encryption-settings");
        const wrappingKey = await deriveKey(String(pin || ""), settings.salt);
        key = await unwrapKey(settings.masterWrapPin, wrappingKey);
        if (!key) {
          sec.failN = (sec.failN || 0) + 1;
          if (sec.failN >= 5) {
            sec.lockUntil = Date.now() + 30000;
            sec.failN = 0;
          }
          saveSec();
          throw new Error("incorrect-pin");
        }
        value = await decJSON(safety.__enc, key);
        if (!value) throw new Error("invalid-encrypted-safety-copy");
      } else if (
        sec.enabled ||
        (records.db && records.db.__enc) ||
        settings.enabled
      ) {
        // Never use a stale plaintext backup to bypass an existing encrypted lock.
        throw new Error("plaintext-downgrade-blocked");
      }
      const next = LedgerSchema.migrate(value);
      const target = key ? { __enc: await encJSON(next, key) } : next;
      target.__security = cryptoSettings(settings);
      let previous = records.db;
      if (key && previous && !previous.__enc)
        previous = {
          __enc: await encJSON(previous, key),
          __security: cryptoSettings(settings),
        };
      const connection = await Store.open();
      await new Promise((resolve, reject) => {
        const tx = connection.transaction("kv", "readwrite"),
          kv = tx.objectStore("kv");
        let checked = 0,
          changed = false;
        for (const name of ["db", "safety-backup"]) {
          const q = kv.get(name);
          q.onsuccess = () => {
            if (JSON.stringify(q.result) !== JSON.stringify(records[name]))
              changed = true;
            if (++checked !== 2) return;
            if (changed || !locked) {
              tx.abort();
              return;
            }
            try {
              if (previous !== undefined) kv.put(previous, "recovery-previous");
              kv.put(target, "db");
            } catch (_) {
              tx.abort();
            }
          };
        }
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(tx.error || new Error("recovery-write-failed"));
      });
      // Record is authoritative even if cache maintenance fails. Keep the UI
      // locked until a fresh boot; do not reuse an old in-memory ledger/key.
      sec = Object.assign({}, sec, target.__security, {
        failN: 0,
        lockUntil: 0,
      });
      saveSec();
      db = { lang: next.lang };
      masterKey = null;
      window.__afterUnlock = async () => {
        locked = true;
        masterKey = null;
        location.reload();
      };
      for (const name of [PLAIN, ENC, "v1raw", "safety-backup"]) {
        try {
          localStorage.removeItem(name);
        } catch (_) {}
      }
      return true;
    };
    const operation = Store.tail.then(run);
    Store.tail = operation.catch(() => {});
    try {
      return await operation;
    } finally {
      busy = false;
    }
  }
  function show() {
    if (!locked) return;
    const root = document.getElementById("app");
    root.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "pad";
    panel.dir = "rtl";
    const title = document.createElement("h2");
    title.textContent = "استعادة الدفتر / Ledger recovery";
    const detail = document.createElement("p");
    detail.textContent =
      "لم تُستبدل البيانات المحفوظة / Stored data was not replaced. نزّل نسخة إنقاذ أولًا؛ قد تحتوي بيانات شخصية غير مشفرة. ملف الإنقاذ للتشخيص وليس ملف الاستيراد العادي.";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const pin = document.createElement("input");
    pin.type = "password";
    pin.inputMode = "numeric";
    pin.maxLength = 4;
    pin.autocomplete = "off";
    pin.placeholder = "PIN للنسخة المشفرة";
    pin.setAttribute("aria-label", "رمز النسخة المشفرة / Backup PIN");
    const exportButton = document.createElement("button");
    exportButton.className = "btn btn-line";
    exportButton.textContent = "تنزيل نسخة إنقاذ / Export rescue";
    const restoreButton = document.createElement("button");
    restoreButton.className = "btn btn-navy";
    restoreButton.textContent = "استعادة نسخة الأمان / Restore safety copy";
    const retryButton = document.createElement("button");
    retryButton.className = "btn btn-line";
    retryButton.textContent = "إعادة فتح التطبيق / Reopen";
    let running = false;
    async function perform(work) {
      if (running) return;
      running = true;
      exportButton.disabled =
        restoreButton.disabled =
        retryButton.disabled =
          true;
      try {
        await work();
      } catch (e) {
        status.textContent = "تعذّرت العملية / Failed: " + e.message;
      } finally {
        pin.value = "";
        running = false;
        exportButton.disabled =
          restoreButton.disabled =
          retryButton.disabled =
            false;
      }
    }
    exportButton.addEventListener("click", () => {
      if (
        !confirm(
          "قد يتضمن الملف بيانات مالية وشخصية غير مشفرة. احفظه في مكان آمن. / This file may contain unencrypted personal data. Continue?",
        )
      )
        return;
      perform(async () => {
        const value = await rescueObject();
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(value)], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "dafter-rescue-" + Date.now() + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent =
          "تم طلب التنزيل؛ تحقّق من حفظ الملف / Download requested; verify the saved file.";
      });
    });
    restoreButton.addEventListener("click", () => {
      if (
        !confirm(
          "استبدال الدفتر بنسخة الأمان؟ سيُحفظ السجل الحالي للإنقاذ. / Replace the ledger with its safety copy?",
        )
      )
        return;
      perform(async () => {
        await restoreSafety(pin.value);
        status.textContent =
          "تم حفظ نسخة الأمان. أعد فتح التطبيق لقراءتها / Safety copy committed. Reopen to load it.";
        pin.disabled = true;
      });
    });
    retryButton.addEventListener("click", () => location.reload());
    panel.append(
      title,
      detail,
      exportButton,
      pin,
      restoreButton,
      retryButton,
      status,
    );
    root.appendChild(panel);
  }
  return Object.freeze({ readRecords, rescueObject, restoreSafety, show });
})();
