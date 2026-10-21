const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { IDBFactory } = require("fake-indexeddb");
const root = "app/src/main/assets/www/js/";
const { environment, stored } = require("./helpers/ledger.cjs");

test("schema migration is non-mutating, idempotent and converts trash/edit/limit amounts", () => {
  const c = environment();
  c.run(`db=demoFixtures(); db.meta.schemaVersion=1;
 db.data.a1.customers[0].limit=10.12;
 db.data.a1.invoices[0].edits=[{ts:1,from:2.5,to:1}];
 db.data.a1.trash=[{k:'d',ts:1,o:{id:'trash1',cust:'c1',amount:3.25,ts:1}}];
 const original=JSON.stringify(db); const migrated=migrate(db);`);
  assert.equal(c.run("JSON.stringify(db)===original"), true);
  assert.equal(c.run("migrated.data.a1.trash[0].o.amount"), 325);
  assert.equal(c.run("migrated.data.a1.invoices[0].edits[0].from"), 250);
  assert.equal(c.run("migrated.data.a1.customers[0].limit"), 1012);
  assert.equal(
    c.run("JSON.stringify(migrate(migrated))===JSON.stringify(migrated)"),
    true,
  );
});

test("schema rejects unsafe numbers, poison keys, duplicate IDs, future versions and invalid mappings", () => {
  for (const mutation of [
    "db.data.a1.invoices=[{id:'i1',amount:NaN,ts:1}]",
    "db.data.a1.seq=Number.MAX_SAFE_INTEGER+1",
    "db.meta.schemaVersion=9",
    "db.active='missing'",
    "db.data.a1=[]",
    "db.accounts.push(db.accounts[0])",
    "db.data.a1.customers=[{id:'same',name:'A'},{id:'same',name:'B'}]",
  ]) {
    const c = environment();
    c.run(mutation);
    assert.throws(() => c.run("migrate(db)"));
  }
  const c = environment();
  assert.throws(
    () => c.run(`LedgerSchema.migrate(JSON.parse('{"__proto__":{}}'))`),
    /unsafe-key/,
  );
});

test("zero invoices and trash references are valid; irrecoverable legacy references are diagnostic", () => {
  const c = environment();
  c.run(
    `db.data.a1.trash=[{k:'c',ts:1,o:{id:'c',name:'C'}}];db.data.a1.invoices=[{id:'i',cust:'c',ts:1,amount:0}]`,
  );
  assert.equal(c.run("LedgerSchema.validate(db).length"), 0);
  c.run("db.data.a1.trash=[]");
  assert.equal(c.run("LedgerSchema.validate(db)[0]"), "missing-customer");
});

test("allocations reject excess totals and cross-customer payment links", () => {
  const c = environment();
  c.run(`db=demoFixtures();db.data.a1.payments[0].alloc[0].amt=999999`);
  assert.throws(() => c.run("migrate(db)"), /overallocated-payment/);
  c.run(`db=demoFixtures();db.data.a1.payments[0].cust='c2'`);
  assert.throws(() => c.run("migrate(db)"), /cross-customer-allocation/);
});

test("queued writes snapshot at call time and cannot overtake delayed encryption", async () => {
  const c = environment();
  await c.run(`(async()=>{masterKey=await newMaster();sec.enabled=true})()`);
  c.run(
    `const realEncrypt=encJSON;let release;let calls=0;encJSON=async(o,k)=>{if(++calls===1)await new Promise(r=>release=r);return realEncrypt(o,k)};db.accounts[0].name='first';const first=Store.persist();db.accounts[0].name='second';const second=Store.persist();db.accounts[0].name='unsaved';`,
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(c.run("calls"), 1);
  c.run("release()");
  await c.run("Promise.all([first,second])");
  const record = await stored(c);
  assert.ok(record.__enc);
  c.pack = record.__enc;
  assert.equal(
    await c.run("decJSON(pack,masterKey).then(x=>x.accounts[0].name)"),
    "second",
  );
  assert.equal(c.cache.has("dafter_v3"), false);
});

test("encryption failure and absent key do not overwrite the prior copy or fall back to plaintext", async () => {
  const c = environment();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  const cache = c.cache.get("dafter_v3");
  await c.run(
    `(async()=>{masterKey=await newMaster();sec.enabled=true;encJSON=async()=>{throw new Error('encrypt-failed')}})()`,
  );
  await assert.rejects(c.run("Store.persist()"), /encrypt-failed/);
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(c.cache.get("dafter_v3"), cache);
  c.run("masterKey=null");
  await assert.rejects(c.run("Store.persist()"), /storage-locked/);
  assert.equal(JSON.stringify(await stored(c)), before);
});

test("failed transaction leaves primary/cache unchanged and queue accepts a subsequent write", async () => {
  const c = environment();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  c.run(
    `const openReal=Store.open.bind(Store);Store.open=async()=>({transaction(){throw new Error('disk-full')}});db.accounts[0].name='failed'`,
  );
  await assert.rejects(c.run("Store.persist()"), /disk-full/);
  c.run("Store.open=openReal");
  assert.equal(JSON.stringify(await stored(c)), before);
  c.run("db.accounts[0].name='next'");
  await c.run("Store.persist()");
  assert.equal((await stored(c)).accounts[0].name, "next");
});

test("restore waits for durable commit and saves previous ledger atomically", async () => {
  const c = environment();
  await c.run("Store.persist()");
  c.run(
    `const oldName=db.accounts[0].name;const next=seed();next.accounts[0].name='restored';const realOpen=Store.open.bind(Store);let release;Store.open=async()=>{await new Promise(r=>release=r);return realOpen()};const result=Backup.restore(next,true)`,
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(c.run("db.accounts[0].name===oldName"), true);
  assert.equal(c.messages.includes("restoredOk"), false);
  // Release the read used to prepare the safety record, then subsequent opens.
  c.run("Store.open=realOpen;release()");
  assert.equal(await c.run("result"), true);
  assert.equal((await stored(c)).accounts[0].name, "restored");
  assert.equal(
    (await stored(c, "safety-backup")).accounts[0].name,
    c.run("oldName"),
  );
  c.run("db.accounts[0].name='later'");
  await c.run("Store.persist()");
  assert.ok(await stored(c, "safety-backup"));
});

test("restore failure retains UI state and previous primary/safety records", async () => {
  const c = environment();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  c.run(
    `const openReal=Store.open.bind(Store);const beforeUI=JSON.stringify(db);const next=seed();next.accounts[0].name='not-installed';Store.open=async()=>{throw new Error('storage-failed')}`,
  );
  assert.equal(await c.run("Backup.restore(next,true)"), false);
  assert.equal(c.run("JSON.stringify(db)===beforeUI"), true);
  assert.equal(c.messages.includes("restoredOk"), false);
  c.run("Store.open=openReal");
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(await stored(c, "safety-backup"), undefined);
});

test("backup v2 checks semantic field consistency; v1 weak checksums remain readable", async () => {
  const c = environment();
  c.backup = await c.run("Backup.obj()");
  assert.equal(c.backup.checksum.length, 64);
  c.backup.schemaVersion = 1;
  assert.equal(await c.run("Backup.verify(backup)"), "checksum-mismatch");
  c.run(
    `const v1={format:'dafter-backup',formatVersion:1,schemaVersion:2,accounts:db.accounts,data:db.data,settings:{lang:db.lang},active:db.active};v1.checksum=legacyChecksum(Backup.payload(v1))`,
  );
  assert.equal(await c.run("Backup.verify(v1)"), "");
});

test("new checksum generation fails closed without WebCrypto", async () => {
  const c = environment();
  c.crypto = {};
  await assert.rejects(c.run("Backup.obj()"), /crypto-unavailable/);
});

test("security config is committed with ciphertext; enabling removes old safety/plaintext caches", async () => {
  const c = environment();
  await c.run("Store.persist()");
  await c.run(`Backup.restore(seed(),true)`);
  c.cache.set("v1raw", "old");
  c.cache.set("safety-backup", "old");
  await c.run(
    `(async()=>{const k=await newMaster();const next=LedgerSchema.clone(sec);next.enabled=true;next.pinHash='test';await commitSecurity(next,k)})()`,
  );
  const record = await stored(c);
  assert.ok(record.__enc);
  assert.equal(record.__security.pinHash, "test");
  assert.equal(await stored(c, "safety-backup"), undefined);
  for (const key of ["dafter_v3", "v1raw", "safety-backup"])
    assert.equal(c.cache.has(key), false);
  await c.run("Backup.restore(seed(),true)");
  assert.ok((await stored(c, "safety-backup")).__enc);
  await c.run("Store.persist()");
  assert.ok((await stored(c, "safety-backup")).__enc);
});

test("PIN configuration remains unchanged if encryption fails", async () => {
  const c = environment();
  await c.run("Store.persist()");
  await assert.rejects(
    c.run(
      `(async()=>{const k=await newMaster();const next=LedgerSchema.clone(sec);next.enabled=true;encJSON=async()=>{throw new Error('encrypt-failed')};await commitSecurity(next,k)})()`,
    ),
    /encrypt-failed/,
  );
  assert.equal(c.run("sec.enabled"), false);
  assert.equal(c.run("masterKey"), null);
  assert.equal((await stored(c)).__security.enabled, false);
});

test("concurrent user save cancels stale restore before its commit", async () => {
  const c = environment();
  await c.run("Store.persist()");
  await c.run(`(async()=>{masterKey=await newMaster();sec.enabled=true})()`);
  c.run(
    `const encryptReal=encJSON;let release;let calls=0;encJSON=async(o,k)=>{if(++calls===1)await new Promise(r=>release=r);return encryptReal(o,k)};const next=seed();next.accounts[0].name='restore';const restore=Backup.restore(next,true)`,
  );
  await new Promise((r) => setImmediate(r));
  c.run(
    "db.accounts[0].name='user-edit';const newer=Store.persist();release()",
  );
  assert.equal(await c.run("restore"), false);
  await c.run("newer");
  assert.equal(c.run("db.accounts[0].name"), "user-edit");
  c.pack = (await stored(c)).__enc;
  assert.equal(
    await c.run("decJSON(pack,masterKey).then(x=>x.accounts[0].name)"),
    "user-edit",
  );
});

async function bootApp(c) {
  const nodes = new Map();
  c.document = {
    getElementById(id) {
      if (!nodes.has(id))
        nodes.set(id, { textContent: "", addEventListener() {} });
      return nodes.get(id);
    },
  };
  c.ui = {};
  c.go = () => {};
  c.closeSheet = () => {};
  const source = fs
    .readFileSync(root + "app.js", "utf8")
    .replace(
      /\(async function boot\(\)\s*\{/,
      "window.bootPromise=(async function boot(){",
    );
  vm.runInContext(source, c);
  await c.bootPromise;
  return nodes;
}

test("encrypted IDB-only boot locks and decrypts without seeding over saved data", async () => {
  const c = environment();
  await c.run(
    `(async()=>{masterKey=await newMaster();sec.enabled=true;db.accounts[0].name='private';await Store.persist()})()`,
  );
  c.run("const goodKey=masterKey;masterKey=null;sec.enabled=false;db=null");
  c.cache.clear();
  await bootApp(c);
  assert.equal(c.run("locked"), true);
  assert.equal(c.run("sec.enabled"), true);
  assert.ok((await stored(c)).__enc);
  c.run("masterKey=goodKey;locked=false");
  await c.run("window.__afterUnlock()");
  assert.equal(c.run("db.accounts[0].name"), "private");
  assert.equal(c.run("locked"), false);
});

test("decrypt failure keeps lock and encrypted record; retry remains available", async () => {
  const c = environment();
  await c.run(
    `(async()=>{masterKey=await newMaster();sec.enabled=true;await Store.persist()})()`,
  );
  const before = JSON.stringify(await stored(c));
  await bootApp(c);
  await c.run(
    "(async()=>{masterKey=await newMaster();locked=false;await window.__afterUnlock()})()",
  );
  assert.equal(c.run("locked"), true);
  assert.equal(c.run("masterKey"), null);
  assert.equal(c.run("typeof window.__afterUnlock"), "function");
  assert.equal(JSON.stringify(await stored(c)), before);
});

test("storage-read failure blocks boot rather than silently initializing a new ledger", async () => {
  const c = environment();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  c.run(
    "const loadReal=Store.load.bind(Store);Store.load=async()=>{throw new Error('read-failed')};db=null",
  );
  const nodes = await bootApp(c);
  assert.match(nodes.get("app").textContent, /not replaced/);
  assert.equal(c.run("locked"), true);
  assert.equal(JSON.stringify(await stored(c)), before);
});

test("invalid stored schema blocks boot without migrating or replacing the raw record", async () => {
  const c = environment();
  await c.run("Store.persist()");
  await c.run(
    `Store.open().then(d=>new Promise((r,j)=>{const tx=d.transaction('kv','readwrite');tx.objectStore('kv').put({meta:{schemaVersion:99}},'db');tx.oncomplete=r;tx.onabort=()=>j(tx.error)}))`,
  );
  await bootApp(c);
  assert.equal((await stored(c)).meta.schemaVersion, 99);
  assert.equal(c.run("locked"), true);
});

test("transaction abort rolls back safety and replacement together", async () => {
  const c = environment();
  await c.run("Store.persist()");
  const before = JSON.stringify(await stored(c));
  c.run(
    `const realOpen=Store.open.bind(Store);Store.open=async()=>{const d=await realOpen();return {transaction(...args){const tx=d.transaction(...args);if(args[1]==='readwrite'){const getStore=tx.objectStore.bind(tx);tx.objectStore=(name)=>{const kv=getStore(name);const put=kv.put.bind(kv);kv.put=(value,key)=>{const req=put(value,key);if(key==='db')req.onsuccess=()=>tx.abort();return req};return kv}}return tx}}}`,
  );
  assert.equal(await c.run("Backup.restore(seed(),true)"), false);
  c.run("Store.open=realOpen");
  assert.equal(JSON.stringify(await stored(c)), before);
  assert.equal(await stored(c, "safety-backup"), undefined);
  assert.equal(c.messages.includes("restoredOk"), false);
});

test("master key can be rewrapped for PIN rotation after unlocking", async () => {
  const c = environment();
  await c.run(
    `(async()=>{const k=await newMaster();const first=await deriveKey('1234','salt');const wrapped=await wrapKey(k,first);const unlocked=await unwrapKey(wrapped,first);const second=await deriveKey('5678','salt2');const rotated=await wrapKey(unlocked,second);const recovered=await unwrapKey(rotated,second);const encrypted=await encJSON({test:'ok'},k);if((await decJSON(encrypted,recovered)).test!=='ok')throw new Error('rotation-failed')})()`,
  );
});

test("new write during guarded transaction aborts restore and preserves the newer edit", async () => {
  const c = environment();
  await c.run("Store.persist()");
  c.run(`const realOpen=Store.open.bind(Store);let injected=false;let newer;
    Store.open=async()=>{const d=await realOpen();return {transaction(...args){const tx=d.transaction(...args);if(args[1]==='readwrite'&&!injected){const getStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const kv=getStore(name);const put=kv.put.bind(kv);kv.put=(value,key)=>{const req=put(value,key);if(key==='db')req.onsuccess=()=>{injected=true;db.accounts[0].name='new edit';newer=Store.persist()};return req};return kv}}return tx}}}`);
  assert.equal(await c.run("Backup.restore(seed(),true)"), false);
  await c.run("newer");
  c.run("Store.open=realOpen");
  assert.equal((await stored(c)).accounts[0].name, "new edit");
  assert.equal(await stored(c, "safety-backup"), undefined);
});

test("cache quota failure does not invalidate authoritative encrypted commit or its settings", async () => {
  const c = environment();
  await c.run("Store.persist()");
  c.run("localStorage.setItem=()=>{throw new Error('quota')}");
  await c.run(
    `(async()=>{const next=LedgerSchema.clone(sec);next.enabled=true;next.pinHash='committed';await commitSecurity(next,await newMaster())})()`,
  );
  assert.ok((await stored(c)).__enc);
  assert.equal((await stored(c)).__security.pinHash, "committed");
  assert.equal(c.cache.has("dafter_v3"), false);
  c.run('sec.enabled=false;sec.pinHash="stale";masterKey=null');
  await bootApp(c);
  assert.equal(c.run("locked"), true);
  assert.equal(c.run("sec.pinHash"), "committed");
});

test("legacy QR restore uses validated backup transaction rather than direct DB assignment", () => {
  const source = fs.readFileSync(root + "screens.js", "utf8");
  assert.match(source, /await Backup\.restore\(obj\.db,true\)/);
  assert.doesNotMatch(source, /db=migrate\(obj\.db\)/);
});
