const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { environment, stored } = require("./helpers/ledger.cjs");
function setup() {
  const c = environment();
  for (const f of ["recovery", "ledger-edits"])
    c.run(fs.readFileSync("app/src/main/assets/www/js/" + f + ".js", "utf8"));
  return c;
}
async function encrypted(c) {
  await c.run(
    `(async()=>{await Store.persist();const key=await newMaster();const next=LedgerSchema.clone(sec);next.enabled=true;next.salt='salt';next.masterWrapPin=await wrapKey(key,await deriveKey('1234',next.salt));await commitSecurity(next,key);const replacement=seed();replacement.accounts[0].name='replacement';await Backup.restore(replacement,true);locked=true;masterKey=null})()`,
  );
}

test("rescue export is read-only and retains raw corrupted records and cache", async () => {
  const c = setup();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  const value = await c.run("Recovery.rescueObject()");
  assert.equal(value.format, "dafter-rescue");
  assert.equal(JSON.stringify(value.records.db), before);
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.ok(value.legacy.dafter_v3);
});
test("rescue export falls back to readable cache when IndexedDB cannot be read", async () => {
  const c = setup();
  c.cache.set("dafter_v3", "{corrupt");
  c.run("Store.open=async()=>{throw new Error('unavailable')}");
  const value = await c.run("Recovery.rescueObject()");
  assert.equal(value.legacy.dafter_v3, "{corrupt");
  assert.equal(value.errors[0], "indexeddb-unavailable");
});
test("empty rescue export is rejected rather than presenting an empty successful backup", async () => {
  const c = setup();
  await assert.rejects(c.run("Recovery.rescueObject()"), /no-recoverable-data/);
});
test("plaintext safety recovery preserves displaced primary and keeps screen locked", async () => {
  const c = setup();
  await c.run("Store.persist()");
  c.run("const originalName=db.accounts[0].name");
  await c.run(
    "(async()=>{const next=seed();next.accounts[0].name='replacement';await Backup.restore(next,true);locked=true})()",
  );
  await c.run("Recovery.restoreSafety('')");
  assert.equal((await stored(c)).accounts[0].name, c.run("originalName"));
  assert.equal(
    (await stored(c, "recovery-previous")).accounts[0].name,
    "replacement",
  );
  assert.equal(c.run("locked"), true);
  assert.equal(c.run("masterKey"), null);
});
test("encrypted recovery requires correct PIN; failed attempt does not modify primary or safety", async () => {
  const c = setup();
  await encrypted(c);
  const before = JSON.stringify(await stored(c));
  const safety = JSON.stringify(await stored(c, "safety-backup"));
  await assert.rejects(
    c.run("Recovery.restoreSafety('9999')"),
    /incorrect-pin/,
  );
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(JSON.stringify(await stored(c, "safety-backup")), safety);
  await c.run("Recovery.restoreSafety('1234')");
  assert.ok((await stored(c)).__enc);
  assert.equal(JSON.stringify(await stored(c, "recovery-previous")), before);
  assert.equal(c.run("locked"), true);
  assert.equal(c.cache.has("dafter_v3"), false);
});
test("recovery PIN lockout is enforced even for a subsequent correct PIN", async () => {
  const c = setup();
  await encrypted(c);
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      c.run("Recovery.restoreSafety('9999')"),
      /incorrect-pin/,
    );
  await assert.rejects(
    c.run("Recovery.restoreSafety('1234')"),
    /retry-after-lockout/,
  );
});
test("stale plaintext safety cannot bypass an encrypted lock", async () => {
  const c = setup();
  await c.run("Store.persist()");
  await c.run("Backup.restore(seed(),true)");
  c.run("sec.enabled=true;locked=true");
  const before = JSON.stringify(await stored(c));
  await assert.rejects(
    c.run("Recovery.restoreSafety('')"),
    /plaintext-downgrade-blocked/,
  );
  assert.equal(JSON.stringify(await stored(c)), before);
});
test("missing safety copy and unlocked recovery are rejected without modifying primary", async () => {
  const c = setup();
  await c.run("Store.persist()");
  await assert.rejects(c.run("Recovery.restoreSafety('')"), /requires-locked/);
  c.run("locked=true");
  await assert.rejects(c.run("Recovery.restoreSafety('')"), /no-safety-copy/);
});
test("ledger mutation remains invisible until successful commit, including sequence number", async () => {
  const c = setup();
  await c.run("Store.persist()");
  c.run(
    `const before=JSON.stringify(db);const open=Store.open.bind(Store);let release;Store.open=async()=>{await new Promise(r=>release=r);return open()};const pending=LedgerEdits.insert('invoices',{id:'invoice',code:'A500',ts:1,amount:100},true)`,
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(c.run("JSON.stringify(db)===before"), true);
  assert.equal(c.run("LedgerEdits.busy"), true);
  c.run("Store.open=open;release()");
  await c.run("pending");
  assert.equal(c.run("db.data.a1.seq"), 501);
  assert.equal(c.run("db.data.a1.invoices.length"), 1);
});
test("failed financial write preserves UI ledger and sequence and releases busy state", async () => {
  const c = setup();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  c.run(
    `const beforeUI=JSON.stringify(db);const open=Store.open.bind(Store);Store.open=async()=>{throw new Error('quota')}`,
  );
  await assert.rejects(
    c.run(
      "LedgerEdits.insert('invoices',{id:'invoice',code:'A500',ts:1,amount:100},true)",
    ),
    /quota/,
  );
  assert.equal(c.run("JSON.stringify(db)===beforeUI"), true);
  assert.equal(c.run("LedgerEdits.busy"), false);
  c.run("Store.open=open");
  assert.equal(JSON.stringify(await stored(c)), before);
});
test("financial mutation rejects invalid draft before touching disk", async () => {
  const c = setup();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  await assert.rejects(
    c.run("LedgerEdits.commit(d=>{d.seq=-1})"),
    /invalid-money/,
  );
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(c.run("db.data.a1.seq"), 500);
});
test("competing legacy save wins over stale financial mutation", async () => {
  const c = setup();
  await c.run("Store.persist()");
  c.run(
    `const open=Store.open.bind(Store);let release;Store.open=async()=>{await new Promise(r=>release=r);return open()};const pending=LedgerEdits.commit(d=>{d.seq=900})`,
  );
  await new Promise((r) => setImmediate(r));
  c.run(
    "db.accounts[0].name='new edit';const newer=Store.persist();Store.open=open;release()",
  );
  await assert.rejects(c.run("pending"), /data-changed/);
  await c.run("newer");
  assert.equal(c.run("db.data.a1.seq"), 500);
  assert.equal((await stored(c)).accounts[0].name, "new edit");
});
test("duplicate pending financial submit is rejected rather than creating a second entry", async () => {
  const c = setup();
  c.run(
    `const open=Store.open.bind(Store);let release;Store.open=async()=>{await new Promise(r=>release=r);return open()};const pending=LedgerEdits.commit(d=>{d.seq++})`,
  );
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    c.run("LedgerEdits.commit(d=>{d.seq++})"),
    /ledger-busy/,
  );
  c.run("Store.open=open;release()");
  await c.run("pending");
  assert.equal(c.run("db.data.a1.seq"), 501);
});

test("recovery transaction abort leaves primary, safety and displaced-copy state unchanged", async () => {
  const c = setup();
  await c.run("Store.persist()");
  await c.run("Backup.restore(seed(),true)");
  const before = JSON.stringify(await stored(c));
  const safety = JSON.stringify(await stored(c, "safety-backup"));
  c.run(
    `locked=true;const open=Store.open.bind(Store);Store.open=async()=>{const d=await open();return {transaction(...args){const tx=d.transaction(...args);if(args[1]==='readwrite'){const getStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const kv=getStore(name);const put=kv.put.bind(kv);kv.put=(value,key)=>{const request=put(value,key);if(key==='db')request.onsuccess=()=>tx.abort();return request};return kv}}return tx}}}`,
  );
  await assert.rejects(
    c.run("Recovery.restoreSafety('')"),
    /recovery-write-failed/,
  );
  c.run("Store.open=open");
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(JSON.stringify(await stored(c, "safety-backup")), safety);
  assert.equal(await stored(c, "recovery-previous"), undefined);
});

test("invalid safety copy is rejected without replacing the current record", async () => {
  const c = setup();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  await c.run(
    `Store.open().then(d=>new Promise((resolve,reject)=>{const tx=d.transaction('kv','readwrite');tx.objectStore('kv').put({meta:{schemaVersion:99}},'safety-backup');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)}))`,
  );
  c.run("locked=true");
  await assert.rejects(
    c.run("Recovery.restoreSafety('')"),
    /unsupported-schema/,
  );
  assert.equal(JSON.stringify(await stored(c)), before);
});

test("enabling encryption removes an older plaintext displaced recovery record", async () => {
  const c = setup();
  await c.run("Store.persist()");
  await c.run("Backup.restore(seed(),true)");
  c.run("locked=true");
  await c.run("Recovery.restoreSafety('')");
  assert.ok(await stored(c, "recovery-previous"));
  await c.run(
    `(async()=>{locked=false;db=seed();const next=LedgerSchema.clone(sec);next.enabled=true;await commitSecurity(next,await newMaster())})()`,
  );
  assert.equal(await stored(c, "recovery-previous"), undefined);
  assert.ok((await stored(c)).__enc);
});
