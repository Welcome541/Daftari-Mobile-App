/* Administrative edits share the same durable copy-on-write boundary as money. */
const LedgerAdmin = (() => {
  const collections = { c: "customers", d: "invoices", p: "payments" };
  async function change(accountId, edit) {
    let before, after;
    const value = await LedgerEdits.commit((_, draft) => {
      const d = draft.data[accountId];
      if (!d) throw new Error("missing-account");
      before = JSON.stringify(d);
      const result = edit(d);
      after = JSON.stringify(d);
      return result;
    });
    return {
      value,
      undo: () =>
        LedgerEdits.commit((_, draft) => {
          if (JSON.stringify(draft.data[accountId]) !== after)
            throw new Error("undo-conflict");
          draft.data[accountId] = JSON.parse(before);
        }),
    };
  }
  function customer(accountId, id, patch) {
    if (
      Object.keys(patch).some(
        (k) => !["archived", "pinned", "photo"].includes(k),
      )
    )
      return Promise.reject(new Error("invalid-customer-patch"));
    return change(accountId, (d) => {
      const c = d.customers.find((x) => x.id === id);
      if (!c) throw new Error("missing-customer");
      Object.assign(c, patch);
      return c.pinned;
    });
  }
  function remove(accountId, keys) {
    const selected = new Set(keys);
    return change(accountId, (d) => {
      let count = 0;
      d.trash = d.trash || [];
      for (const [kind, name] of Object.entries(collections))
        d[name] = d[name].filter((o) => {
          if (!selected.has(kind + ":" + o.id)) return true;
          d.trash.push({ k: kind, o, ts: Date.now() });
          count++;
          return false;
        });
      return count;
    });
  }
  function restore(accountId, id) {
    return change(accountId, (d) => {
      const tr = d.trash || [],
        index = tr.findIndex((e) => e.o.id === id);
      if (index < 0) throw new Error("missing-trash-entry");
      const e = tr[index];
      d[collections[e.k]].push(e.o);
      tr.splice(index, 1);
    });
  }
  function archive(accountId, keys) {
    const selected = new Set(keys);
    return change(accountId, (d) => {
      let count = 0;
      for (const kind of ["d", "p"])
        for (const o of d[collections[kind]])
          if (selected.has(kind + ":" + o.id) && !o.arch) {
            o.arch = true;
            count++;
          }
      return count;
    });
  }
  function purge(accountId) {
    return change(accountId, (d) => {
      // Retain the transitive dependency closure of live rows. Unreferenced trash
      // can be removed, but a live payment must not lose its invoice/customer.
      const trash = d.trash || [],
        byKey = new Map(trash.map((e) => [e.k + ":" + e.o.id, e]));
      const keep = new Set(),
        queue = [...d.invoices, ...d.payments];
      for (let n = 0; n < queue.length; n++) {
        const o = queue[n],
          refs = [];
        if (o.cust) refs.push("c:" + o.cust);
        for (const a of o.alloc || []) refs.push("d:" + a.inv);
        for (const key of refs)
          if (byKey.has(key) && !keep.has(key)) {
            keep.add(key);
            queue.push(byKey.get(key).o);
          }
      }
      d.trash = trash.filter((e) => keep.has(e.k + ":" + e.o.id));
      return {
        removed: trash.length - d.trash.length,
        retained: d.trash.length,
      };
    });
  }
  return Object.freeze({ change, customer, remove, restore, archive, purge });
})();
