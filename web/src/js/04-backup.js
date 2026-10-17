/* =====================================================================
 * Daftari · 04-backup.js
 * ---------------------------------------------------------------------
 * Versioned backup / restore with checksum
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const Backup={async obj(){const o={format:'dafter-backup',formatVersion:1,schemaVersion:(db.meta||{}).schemaVersion||2,exportedAt:new Date().toISOString(),accounts:db.accounts,data:db.data,settings:{lang:db.lang},active:db.active};o.checksum=await sha256hex(JSON.stringify({a:o.accounts,d:o.data,s:o.settings}));return o},
 async verify(o){if(!o||o.format!=='dafter-backup'||!o.checksum)return 'bad-format';const c=await sha256hex(JSON.stringify({a:o.accounts,d:o.data,s:o.settings}));if(c!==o.checksum)return 'checksum-mismatch';return Invariants.check({accounts:o.accounts,data:o.data})},
 async restore(o){const err=await this.verify(o);if(err){toastMsg('⚠ '+err);return false}
  let safety=null;try{safety=await this.obj();localStorage.setItem('safety-backup',JSON.stringify(safety))}catch(e){}
  const old=db;db={meta:{schemaVersion:o.schemaVersion||2},lang:(o.settings&&o.settings.lang)||db.lang,active:old.active,accounts:o.accounts,data:o.data};
  if(!db.data[db.active])db.active=db.accounts[0].id;
  const bad=Invariants.check(db);if(bad){db=old;try{if(safety)localStorage.setItem('safety-backup',JSON.stringify(safety))}catch(e){}toastMsg('⚠ invariants: '+bad);return false}
  save();stack=[{s:'home'}];render();toastMsg(t('restoredOk'));return true},
 download(){this.obj().then(o=>{dl('dafter-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(o),'application/json');toastMsg('✓ backup')})},
 pick(inp){const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{await this.restore(JSON.parse(r.result))}catch(e){toastMsg('⚠ bad-file')}};r.readAsText(f)}};
