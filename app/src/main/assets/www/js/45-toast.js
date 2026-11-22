/* =====================================================================
 * Daftari · 45-toast.js
 * ---------------------------------------------------------------------
 * Toast / snackbar
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
let lastTouch=Date.now();
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>lastTouch=Date.now(),{passive:true}));
setInterval(()=>{if(sec.enabled&&!locked&&Date.now()-lastTouch>sec.autoMin*60000){locked=true;masterKey=null;pinBuf='';stack=[{s:'home'}];render()}},5000);
let toastTimer=null,undoAct=null;
function toastMsg(html,fn,shareId,dur){undoAct=fn||null;const el=document.getElementById('toast');el.innerHTML='<span style="flex:1;line-height:1.5">'+html+'</span>'+(shareId?'<button class="tb" style="border-color:#9fd0ff;color:#9fd0ff;padding:7px 10px" aria-label="'+t('shareLbl')+'" onclick="hideToast();shareReceipt(\''+shareId+'\')">'+ic('share',14)+'</button>':'')+(fn?'<button class="tb" onclick="doUndoAct()">'+ic('undo',14)+t('undo')+'</button>':'');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),dur||3000)}
function hideToast(){clearTimeout(toastTimer);document.getElementById('toast').classList.remove('show');undoAct=null}
function doneSnack(kind,id,cid,amt){toastMsg('<b>'+(kind==='debt'?t('debtDone'):t('payDone'))+'</b> · '+money(amt)+'<br><span style="font-size:11.5px;opacity:.8">'+t('undoAvail')+'</span>',()=>{if(kind==='debt'){DD().invoices=DD().invoices.filter(x=>x.id!==id)}else{DD().payments=DD().payments.filter(x=>x.id!==id)}save();render()},kind==='debt'&&cid?id:null,3000)}
function doUndoAct(){if(undoAct){try{undoAct()}catch(e){}undoAct=null}document.getElementById('toast').classList.remove('show')}
