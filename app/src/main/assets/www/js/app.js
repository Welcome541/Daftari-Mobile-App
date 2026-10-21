// Entry-page bindings; feature templates will migrate away from inline handlers separately.
document.getElementById("fabAdd").addEventListener("click", function () {
  ui.nc = { name: "", phone: "", edit: null };
  go("newcust", {});
});
document.getElementById("sheetBackdrop").addEventListener("click", function () {
  closeSheet();
});

/* ================= boot ================= */
function bootFailure() {
  locked = true;
  masterKey = null;
  db = { lang: "ar" };
  const root = document.getElementById("app");
  root.textContent =
    "تعذّر تحميل الدفتر بأمان. لم يتم استبدال البيانات المحفوظة. أعد فتح التطبيق بعد معالجة مشكلة التخزين. / Unable to load safely. Stored data was not replaced.";
  if (typeof Recovery !== "undefined") Recovery.show();
}
(async function boot() {
  try {
    let raw = await Store.load();
    if (raw && raw.__security) sec = Object.assign(sec, raw.__security);
    if (!raw) {
      const enc = localStorage.getItem(ENC);
      const plain = localStorage.getItem(PLAIN);
      if (enc) raw = { __enc: JSON.parse(enc) };
      else if (plain) raw = JSON.parse(plain);
    }
    if (raw && raw.__enc && !sec.enabled)
      throw new Error("missing-encryption-settings");
    if (sec.enabled) {
      if (!raw) throw new Error("missing-encrypted-data");
      locked = true;
      db = { lang: "ar" };
      window.__afterUnlock = async () => {
        try {
          const value = raw.__enc ? await decJSON(raw.__enc, masterKey) : raw;
          if (!value) throw new Error("decrypt-failed");
          const next = migrate(value);
          db = next;
          locked = false;
          await Store.persist();
          window.__afterUnlock = null;
          stack = [{ s: "home" }];
          render();
        } catch (e) {
          locked = true;
          masterKey = null;
          db = { lang: "ar" };
          render();
          toastMsg("⚠ تعذّر فتح البيانات / Unable to open stored data");
        }
      };
      render();
      return;
    }
    db = raw === null ? seed() : migrate(raw);
    await Store.persist();
    render();
  } catch (e) {
    bootFailure();
  }
})();
