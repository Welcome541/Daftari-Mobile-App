const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { environment, stored } = require("./helpers/ledger.cjs");
function setup() {
  const c = environment();
  for (const file of ["ledger-edits", "ledger-admin"])
    c.run(
      fs.readFileSync("app/src/main/assets/www/js/" + file + ".js", "utf8"),
    );
  c.run("db=demoFixtures()");
  return c;
}
for (const [name, operation] of [
  ["customer", "LedgerAdmin.customer('a1','c1',{archived:true})"],
  ["delete", "LedgerAdmin.remove('a1',['c:c1','d:i1'])"],
  ["restore", "LedgerAdmin.restore('a1','i1')"],
  ["archive", "LedgerAdmin.archive('a1',['d:i2','p:p2'])"],
  ["purge", "LedgerAdmin.purge('a1')"],
]) {
  test(
    name + " failure leaves memory and stored account unchanged",
    async () => {
      const c = setup();
      await c.run("LedgerAdmin.remove('a1',['d:i1'])");
      const disk = JSON.stringify(await stored(c));
      const memory = c.run("JSON.stringify(db)");
      c.run(
        "const originalOpen=Store.open.bind(Store);Store.open=async()=>{throw new Error('quota')}",
      );
      await assert.rejects(c.run(operation), /quota/);
      assert.equal(c.run("JSON.stringify(db)"), memory);
      c.run("Store.open=originalOpen");
      assert.equal(JSON.stringify(await stored(c)), disk);
      assert.equal(c.run("LedgerEdits.busy"), false);
    },
  );
}
test("deletion/undo uses record IDs and remains bound to original account", async () => {
  const c = setup();
  c.run(
    `db.accounts.push({id:'a2',name:'Second',type:'personal',cur:'$',minorUnit:2});db.data.a2={customers:[],invoices:[],payments:[],seq:1}`,
  );
  c.change = await c.run(
    "LedgerAdmin.remove('a1',['c:c1','d:i1','p:p1','d:i1'])",
  );
  assert.equal(c.change.value, 3);
  await c.run("LedgerEdits.commit((_,draft)=>{draft.active='a2'})");
  await c.change.undo();
  assert.equal(c.run("db.data.a1.invoices.some(x=>x.id==='i1')"), true);
  assert.equal(c.run("db.data.a2.invoices.length"), 0);
  assert.equal(c.run("db.active"), "a2");
  assert.equal(c.run("db.data.a1.trash"), undefined);
});
test("stale delete undo rejects newer edits without erasing them", async () => {
  const c = setup();
  c.change = await c.run("LedgerAdmin.remove('a1',['d:i1'])");
  await c.run("LedgerAdmin.customer('a1','c1',{pinned:false})");
  const before = c.run("JSON.stringify(db)");
  await assert.rejects(c.change.undo(), /undo-conflict/);
  assert.equal(c.run("JSON.stringify(db)"), before);
});
test("restoring same trash entry twice cannot duplicate a row", async () => {
  const c = setup();
  await c.run("LedgerAdmin.remove('a1',['d:i1'])");
  await c.run("LedgerAdmin.restore('a1','i1')");
  await assert.rejects(
    c.run("LedgerAdmin.restore('a1','i1')"),
    /missing-trash-entry/,
  );
  assert.equal(c.run("db.data.a1.invoices.filter(x=>x.id==='i1').length"), 1);
});
test("archive undo preserves rows that were already archived", async () => {
  const c = setup();
  c.run("db.data.a1.invoices[0].arch=true");
  c.change = await c.run("LedgerAdmin.archive('a1',['d:i1','d:i2'])");
  assert.equal(c.change.value, 1);
  await c.change.undo();
  assert.equal(c.run("db.data.a1.invoices[0].arch"), true);
  assert.equal(c.run("db.data.a1.invoices[1].arch"), undefined);
});
test("purge retains transitive customer/invoice dependencies of live payments", async () => {
  const c = setup();
  c.run(
    `db=seed();db.data.a1.payments=[{id:'p',cust:'c',ts:1,amount:100,alloc:[{inv:'i',amt:100}]}];db.data.a1.trash=[{k:'c',ts:1,o:{id:'c',name:'C'}},{k:'d',ts:1,o:{id:'i',cust:'c',ts:1,amount:100}},{k:'c',ts:1,o:{id:'unused',name:'Unused'}}]`,
  );
  const result = await c.run("LedgerAdmin.purge('a1')");
  assert.equal(result.value.removed, 1);
  assert.equal(result.value.retained, 2);
  assert.equal(c.run("LedgerSchema.validate(db).length"), 0);
  await c.run("LedgerAdmin.remove('a1',['p:p'])");
  const emptied = await c.run("LedgerAdmin.purge('a1')");
  assert.equal(emptied.value.retained, 0);
  assert.equal(c.run("db.data.a1.trash.length"), 0);
});
test("invalid customer patch cannot modify financial or identity fields", async () => {
  const c = setup();
  await assert.rejects(
    c.run("LedgerAdmin.customer('a1','c1',{id:'changed'})"),
    /invalid-customer-patch/,
  );
  assert.equal(c.run("db.data.a1.customers[0].id"), "c1");
});
test("missing account/customer rejects before any mutation", async () => {
  const c = setup();
  const before = c.run("JSON.stringify(db)");
  await assert.rejects(
    c.run("LedgerAdmin.remove('missing',['d:i1'])"),
    /missing-account/,
  );
  await assert.rejects(
    c.run("LedgerAdmin.customer('a1','missing',{pinned:true})"),
    /missing-customer/,
  );
  assert.equal(c.run("JSON.stringify(db)"), before);
});
