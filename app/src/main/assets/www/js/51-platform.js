/* =====================================================================
 * Daftari · 51-platform.js
 * ---------------------------------------------------------------------
 * Platform wiring: share-target intake, load hooks
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
window.addEventListener('load',()=>{try{if(db&&!locked&&(curScr()||{}).s==='reports')render()}catch(e){}});
try{const __u=new URL(location.href);const __st=__u.searchParams.get('t')||__u.searchParams.get('text')||__u.searchParams.get('title');if(__st){try{sessionStorage.setItem('daftariShare',__st)}catch(e){}history.replaceState(null,'',location.pathname)}setTimeout(()=>{try{const st=sessionStorage.getItem('daftariShare');if(st){sessionStorage.removeItem('daftariShare');window.__shR=extSay(st)?(toastMsg(t('shareGot')),1):0}}catch(e){window.__shE=String(e&&e.message)}},900)}catch(e){}
try{if(false&&'serviceWorker' in navigator&&!location.protocol.startsWith('file')){navigator.serviceWorker.register('sw.js').catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__cc){window.__cc=1;location.reload()}});navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.update()))}}catch(e){}
