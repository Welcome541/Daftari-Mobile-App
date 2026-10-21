const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { IDBFactory } = require("fake-indexeddb");
const root = "app/src/main/assets/www/js/";
function environment() {
  const values = new Map(),
    messages = [];
  const c = vm.createContext({
    console,
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    indexedDB: new IDBFactory(),
    navigator: { language: "en" },
    localStorage: {
      getItem: (k) => values.get(k) || null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
    toastMsg: (s) => messages.push(s),
    t: (s) => s,
    esc: (s) => s,
    render() {},
    setTimeout,
    clearTimeout,
  });
  c.window = c;
  c.messages = messages;
  c.cache = values;
  for (const file of [
    "ledger-schema.js",
    "storage.js",
    "ledger.js",
    "state.js",
  ])
    vm.runInContext(fs.readFileSync(root + file, "utf8"), c, {
      filename: file,
    });
  vm.runInContext("db=seed();let stack=[];", c);
  c.run = (code) => vm.runInContext(code, c);
  return c;
}
async function stored(c, key = "db") {
  c.testKey = key;
  return c.run(
    "Store.open().then(d=>new Promise((r,j)=>{const tx=d.transaction('kv');const q=tx.objectStore('kv').get(testKey);tx.oncomplete=()=>r(q.result);tx.onabort=()=>j(tx.error)}))",
  );
}

module.exports = { environment, stored };
