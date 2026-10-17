/* =====================================================================
 * Daftari · 99-boot.js
 * ---------------------------------------------------------------------
 * Application bootstrap
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
(async function boot(){
 const enc=localStorage.getItem(ENC);
 if(sec.enabled&&enc){locked=true;db={lang:'ar'};render();
  window.__afterUnlock=async()=>{try{const pack=JSON.parse(localStorage.getItem(ENC));const d=await decJSON(pack,masterKey);if(d)db=migrate(d)}catch(e){}window.__afterUnlock=null;stack=[{s:'home'}];render()};
  return;}
 let raw=await Store.load();
 if(raw&&raw.__enc){try{localStorage.setItem(ENC,JSON.stringify(raw.__enc))}catch(e){}raw=null}
 if(!raw){try{raw=JSON.parse(localStorage.getItem(PLAIN)||'null')}catch(e){}}
 if(raw&&sec.enabled&&!masterKey){raw=null}
 db=migrate(raw||seed());Store.persist();render();
})();
