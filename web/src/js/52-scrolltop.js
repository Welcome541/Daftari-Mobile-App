/* =====================================================================
 * Daftari · 52-scrolltop.js
 * ---------------------------------------------------------------------
 * Scroll-to-top button + infinite scroll (replaces “عرض المزيد”)
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
window.scrollToTop = function(){
  const sc = (typeof _scroller === 'function' ? _scroller() : document.getElementById('app'));
  if(sc && typeof sc.scrollTo === 'function') sc.scrollTo({top:0, behavior:'smooth'});
  else window.scrollTo({top:0, behavior:'smooth'});
  try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
};
function _setupSTB(){
  const btn=document.getElementById('scrollTopBtn');
  if(!btn) return;
  try{
    const w=btn.querySelector('.icwrap');
    if(w && typeof ic==='function') w.innerHTML=ic('toTop',20);
  }catch(e){}
  btn.classList.remove('show');
  btn.classList.add('hide');
}
_setupSTB();
document.addEventListener('DOMContentLoaded', _setupSTB);
setTimeout(_setupSTB, 320);

let _stLastY = 0;
let _stTick = false;
let _stLock = false;
(function(){
  const _getScroller = ()=> (typeof _scroller === 'function' ? _scroller() : document.getElementById('app'));
  const onScroll = ()=>{
    if(_stTick) return;
    _stTick = true;
    requestAnimationFrame(()=>{
      _stTick = false;
      const sc = _getScroller();
      const y = sc ? sc.scrollTop : (window.scrollY||0);
      const sh = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
      const ch = sc ? sc.clientHeight : (window.innerHeight||0);
      const dy = y - _stLastY;

      // scrollTop button: hidden at top, appears when user has scrolled down a lot and starts scrolling up
      const topBtn = document.getElementById('scrollTopBtn');
      if(topBtn){
        const thShow = 520;
        const thHide = 320;
        if(y < thHide){
          topBtn.classList.remove('show');
          topBtn.classList.add('hide');
        } else if(y > thShow){
          if(dy < -8){
            topBtn.classList.add('show');
            topBtn.classList.remove('hide');
          } else if(dy > 8){
            topBtn.classList.remove('show');
            topBtn.classList.add('hide');
          }
        }
      }

      // infinite scroll: auto-load when near bottom, replaces “عرض المزيد”
      if(!_stLock && sc && (y + ch >= sh - 300)){
        const cur = (typeof curScr === 'function' ? (curScr()||{}).s : null);
        if(cur === 'customers' && !ui.arch){
          try{
            const total = filteredCustomers(true).length;
            const curMax = ui.cmax || 60;
            if(total > curMax){
              _stLock = true;
              ui.cmax = curMax + 60;
              const el=document.getElementById('clist2');
              if(el) el.innerHTML = custListBody();
              setTimeout(()=>{_stLock=false;}, 260);
            }
          }catch(e){}
        } else if(cur === 'home'){
          try{
            const total = window.__txFull || 0;
            let vis=0;
            try{ vis = filteredTx().length; }catch(e){}
            if(total > vis){
              _stLock = true;
              ui.txLimit = (ui.txLimit||60) + 60;
              const el=document.getElementById('txlist');
              if(el) el.innerHTML = feedHtml();
              const tn=document.getElementById('txn');
              if(tn) tn.textContent = total;
              setTimeout(()=>{_stLock=false;}, 260);
            }
          }catch(e){}
        }
      }

      _stLastY = y;
    });
  };
  const sc0 = _getScroller();
  if(sc0) sc0.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('scroll', onScroll, {passive:true});
  // ensure icon after first paint (in case ic not ready at parse time)
  setTimeout(()=>{ try{ const b=document.getElementById('scrollTopBtn'); const w=b&&b.querySelector('.icwrap'); if(w && typeof ic==='function') w.innerHTML=ic('toTop',20);}catch(e){} }, 420);
})();
