/* =====================================================================
 * Daftari · 03-storage.js
 * ---------------------------------------------------------------------
 * IndexedDB store (primary) + localStorage cache
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const Store={dbp:null,open(){if(this.dbp)return this.dbp;this.dbp=new Promise((res,rej)=>{try{if(!window.indexedDB)return rej('noidb');const q=indexedDB.open('dafter-db',1);q.onupgradeneeded=()=>{q.result.createObjectStore('kv')};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}});return this.dbp},
 async load(){try{const d=await this.open();return await new Promise((res,rej)=>{const q=d.transaction('kv','readonly').objectStore('kv').get('db');q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}catch(e){return null}},
 persist(){if(!db)return;const write=o=>this.open().then(d=>new Promise((res,rej)=>{const tx=d.transaction('kv','readwrite');try{tx.objectStore('kv').put(o,'db')}catch(e){return rej(e)}tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})).catch(()=>{});
 if(sec.enabled&&masterKey){encJSON(db,masterKey).then(p=>write({__enc:p})).catch(()=>write(JSON.parse(JSON.stringify(db))))}else write(JSON.parse(JSON.stringify(db)))}};
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
