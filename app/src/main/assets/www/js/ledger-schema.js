/* Pure, non-destructive ledger validation and v1 -> v2 migration. */
const LedgerSchema = (() => {
  const fail = (code) => {
    throw new Error(code);
  };
  const object = (x) =>
    x !== null && typeof x === "object" && !Array.isArray(x);
  const record = (x) => {
    if (!object(x)) fail("invalid-record");
  };
  const list = (x) => {
    if (!Array.isArray(x)) fail("invalid-list");
    return x;
  };
  const id = (x) => {
    if (
      typeof x !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(x) ||
      ["__proto__", "constructor", "prototype"].includes(x)
    )
      fail("invalid-id");
  };
  const amount = (x, positive = false) => {
    if (!Number.isSafeInteger(x) || x < (positive ? 1 : 0))
      fail("invalid-money");
  };
  const stamp = (x) => {
    if (!Number.isSafeInteger(x) || x < 0 || x > 8640000000000000)
      fail("invalid-date");
  };
  function clone(x) {
    // Reject poison keys and non-JSON values before stringify can silently turn NaN into null.
    const seen = new Set();
    function visit(v, depth) {
      if (depth > 40) fail("too-deep");
      if (v === null || typeof v === "string" || typeof v === "boolean") return;
      if (typeof v === "number") {
        if (!Number.isFinite(v)) fail("invalid-number");
        return;
      }
      if (typeof v !== "object" || seen.has(v)) fail("invalid-json");
      seen.add(v);
      for (const k of Object.keys(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          fail("unsafe-key");
        // Optional fields assigned undefined by the UI are omitted like JSON.stringify.
        if (v[k] !== undefined) visit(v[k], depth + 1);
      }
      seen.delete(v);
    }
    visit(x, 0);
    return JSON.parse(JSON.stringify(x));
  }
  function validate(x) {
    record(x);
    record(x.meta);
    if (x.meta.schemaVersion !== 2) fail("unsupported-schema");
    if (!["ar", "en"].includes(x.lang)) fail("invalid-language");
    const accounts = list(x.accounts);
    if (!accounts.length) fail("no-accounts");
    record(x.data);
    const aids = new Set();
    const warnings = [];
    for (const a of accounts) {
      record(a);
      id(a.id);
      if (aids.has(a.id)) fail("duplicate-account");
      aids.add(a.id);
      for (const k of ["name", "type", "cur"])
        if (typeof a[k] !== "string" || !a[k]) fail("invalid-account");
      if (a.minorUnit !== undefined && a.minorUnit !== 2)
        fail("unsupported-minor-unit");
      const d = x.data[a.id];
      record(d);
      amount(d.seq);
      const ids = new Set(),
        customers = new Map(),
        invoices = new Map(),
        payments = [];
      const rows = [
        ...list(d.customers).map((o) => ["c", o]),
        ...list(d.invoices).map((o) => ["d", o]),
        ...list(d.payments).map((o) => ["p", o]),
      ];
      if (d.trash !== undefined)
        for (const e of list(d.trash)) {
          record(e);
          stamp(e.ts);
          if (!["c", "d", "p"].includes(e.k)) fail("invalid-trash");
          rows.push([e.k, e.o]);
        }
      for (const [kind, o] of rows) {
        record(o);
        id(o.id);
        if (ids.has(o.id)) fail("duplicate-id");
        ids.add(o.id);
        if (kind === "c") {
          if (typeof o.name !== "string") fail("invalid-customer");
          if (o.limit !== undefined) amount(o.limit);
          customers.set(o.id, o);
          continue;
        }
        amount(o.amount, kind === "p");
        stamp(o.ts);
        if (o.cust != null && o.cust !== "") id(o.cust);
        if (kind === "d") {
          invoices.set(o.id, o);
          if (o.due != null) stamp(o.due);
          if (o.edits !== undefined)
            for (const e of list(o.edits)) {
              record(e);
              stamp(e.ts);
              amount(e.from);
              amount(e.to);
            }
        } else {
          let total = 0;
          const refs = new Set();
          for (const al of list(o.alloc || [])) {
            record(al);
            id(al.inv);
            amount(al.amt, true);
            if (refs.has(al.inv)) fail("duplicate-allocation");
            refs.add(al.inv);
            total += al.amt;
            if (!Number.isSafeInteger(total) || total > o.amount)
              fail("overallocated-payment");
          }
          payments.push(o);
        }
      }
      // Older releases permanently purged referenced rows. Preserve those ledgers,
      // but expose diagnostics rather than inventing customers/invoices or dropping money.
      for (const o of [...invoices.values(), ...payments])
        if (a.type !== "personal" && !customers.has(o.cust))
          warnings.push("missing-customer");
      for (const p of payments)
        for (const al of p.alloc || []) {
          const inv = invoices.get(al.inv);
          if (!inv) warnings.push("missing-invoice");
          else if ((p.cust || "") !== (inv.cust || ""))
            fail("cross-customer-allocation");
        }
    }
    if (Object.keys(x.data).some((k) => !aids.has(k)) || !aids.has(x.active))
      fail("invalid-account-mapping");
    return [...new Set(warnings)];
  }
  function migrate(input) {
    let x = clone(input);
    record(x);
    if (!x.accounts && Array.isArray(x.customers)) {
      x = {
        meta: { schemaVersion: 1 },
        lang: x.lang || "ar",
        active: "a1",
        accounts: [
          {
            id: "a1",
            name: x.accName || "دفتري",
            type: "grocery",
            cur: x.cur || "ر.س",
            minorUnit: 2,
          },
        ],
        data: {
          a1: {
            customers: x.customers,
            invoices: x.invoices || [],
            payments: x.payments || [],
            seq: x.seq == null ? 500 : x.seq,
            trash: x.trash || [],
          },
        },
      };
    }
    const version =
      x.meta && x.meta.schemaVersion !== undefined ? x.meta.schemaVersion : 1;
    if (version !== 1 && version !== 2) fail("unsupported-schema");
    if (version === 1) {
      const convert = (n) => {
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
          fail("invalid-legacy-money");
        const r = Math.round(n * 100);
        amount(r);
        return r;
      };
      record(x.data);
      for (const d of Object.values(x.data)) {
        record(d);
        const rows = [
          ...list(d.customers).map((o) => ["c", o]),
          ...list(d.invoices).map((o) => ["d", o]),
          ...list(d.payments).map((o) => ["p", o]),
          ...(d.trash || []).map((e) => [e.k, e.o]),
        ];
        for (const [kind, o] of rows) {
          record(o);
          if (kind === "c") {
            if (o.limit !== undefined) o.limit = convert(o.limit);
          } else {
            o.amount = convert(o.amount);
            if (kind === "d")
              for (const e of o.edits || []) {
                e.from = convert(e.from);
                e.to = convert(e.to);
              }
            else for (const al of o.alloc || []) al.amt = convert(al.amt);
          }
        }
      }
    }
    x.meta = Object.assign({}, x.meta, { schemaVersion: 2 });
    for (const a of list(x.accounts))
      if (a.minorUnit === undefined) a.minorUnit = 2;
    delete x.__security;
    validate(x);
    return x;
  }
  return Object.freeze({ clone, validate, migrate });
})();
