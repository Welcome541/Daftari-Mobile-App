/* =====================================================================
 * Daftari · 47-pullrefresh.js
 * ---------------------------------------------------------------------
 * Pull-to-refresh
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
let ptrY=null;
const _scroller=()=>document.getElementById('app');
document.getElementById('phone').addEventListener('touchstart',e=>{const y=(_scroller()?.scrollTop??window.scrollY);if(y<=2&&curScr().s==='home')ptrY=e.touches[0].clientY},{passive:true});
document.getElementById('phone').addEventListener('touchmove',e=>{if(ptrY===null)return;const dy=e.touches[0].clientY-ptrY;const el=document.getElementById('ptr');document.getElementById('ptrT').textContent=t('pull');el.classList.toggle('on',dy>70)},{passive:true});
document.getElementById('phone').addEventListener('touchend',()=>{const el=document.getElementById('ptr');if(el.classList.contains('on')){document.getElementById('ptrT').textContent=t('refreshed');setTimeout(()=>el.classList.remove('on'),700);render()}ptrY=null;setTimeout(()=>el.classList.remove('on'),900)},{passive:true});
let lastY=0;
window.addEventListener('load',()=>{try{if((curScr()||{}).s==='reports')drawCharts()}catch(e){}});
// fab hide on scroll: listen to #app (new fixed-phone layout) and fallback to window
(function(){const onScroll=()=>{const f=document.getElementById('fabAdd');const y=_scroller()?.scrollTop ?? window.scrollY;if(y>lastY+6)f.classList.add('hid');else if(y<lastY-6)f.classList.remove('hid');lastY=y};_scroller()?.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('scroll',onScroll,{passive:true});})();
