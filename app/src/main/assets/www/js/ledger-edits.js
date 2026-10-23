/* Copy-on-write mutations: no financial state or sequence changes before commit. */
const LedgerEdits = (() => {
  let pending = false;
  function savingIndicator() {
    if (typeof document === "undefined" || !document.createElement)
      return () => {};
    const overlay = document.createElement("div");
    overlay.id = "ledgerSaving";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.textContent = "جارٍ حفظ العملية / Saving…";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(10,20,35,.85);color:white;font-size:18px";
    document.body.appendChild(overlay);
    return () => overlay.remove();
  }
  if (typeof document !== "undefined" && document.addEventListener)
    for (const event of ["click", "pointerdown", "keydown"])
      document.addEventListener(
        event,
        (e) => {
          if (pending) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true,
      );

  async function commit(edit) {
    if (pending || locked || Backup.busy || Store.cryptoBusy)
      throw new Error("ledger-busy");
    pending = true;
    let clearIndicator = () => {};
    try {
      clearIndicator = savingIndicator();
      const original = db,
        before = JSON.stringify(db),
        revision = Store.revision;
      const draft = LedgerSchema.clone(db);
      const result = edit(draft.data[draft.active], draft);
      if (result && typeof result.then === "function")
        throw new Error("async-mutation-not-supported");
      LedgerSchema.validate(draft);
      await Store.write(draft, {
        guard: () =>
          !locked &&
          db === original &&
          JSON.stringify(db) === before &&
          Store.revision === revision + 1,
      });
      if (
        db !== original ||
        JSON.stringify(db) !== before ||
        Store.revision !== revision + 1
      )
        throw new Error("data-changed");
      db = draft;
      _IX = null;
      return result;
    } finally {
      pending = false;
      clearIndicator();
    }
  }
  function insert(collection, entry, advanceSequence = false) {
    if (!["invoices", "payments"].includes(collection))
      return Promise.reject(new Error("invalid-collection"));
    return commit((d) => {
      const copy = LedgerSchema.clone(entry);
      d[collection].push(copy);
      if (advanceSequence) d.seq++;
      return copy;
    });
  }
  return Object.freeze({
    commit,
    insert,
    get busy() {
      return pending;
    },
  });
})();
