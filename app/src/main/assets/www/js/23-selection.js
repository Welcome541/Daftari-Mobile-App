/* =====================================================================
 * Daftari · 23-selection.js
 * ---------------------------------------------------------------------
 * Selection gestures, clipboard, bulk actions
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const VIS_SEL='button,[onclick],a,input,select,textarea,[role="button"]';
function locCodeFor(x,y){const SC=Object.keys(SCREENS);let n=SC.indexOf(curScr().s)+1;try{if(document.getElementById('sheetWrap').classList.contains('open'))n+=100}catch(e){}
 const cx=Math.max(0,Math.min(99,Math.round(x/(window.innerWidth||390)*100))),cy=Math.max(0,Math.min(99,Math.round(y/(window.innerHeight||844)*100)));
 let e=0;try{const el=document.elementFromPoint(x,y);const c=el&&el.closest?el.closest(VIS_SEL):null;if(c)e=[...document.querySelectorAll(VIS_SEL)].indexOf(c)+1}catch(err){}
 return n+'-'+cx+'-'+cy+'-'+e}
function legacyCopy(s){const ta=document.createElement('textarea');ta.value=s;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove()}
window.copyLocCode=(x,y)=>{const code=locCodeFor(x,y);const done=()=>toastMsg(t('locCopied')(code));
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(done).catch(()=>{legacyCopy(code);done()})}else{legacyCopy(code);done()}}catch(err){legacyCopy(code);done()}
 try{if(navigator.vibrate)navigator.vibrate([30,60,30])}catch(err){}return code};
let locT=null,locX=0,locY=0;
function locDown(x,y){locX=x;locY=y;const t0=Date.now();clearTimeout(locT);locT=setTimeout(()=>{locT=null;if(ui.rec)return;
 if(ui.sel&&ui.sel.on){if(lxFired>=t0){selExit()}else return}
 if(ui.csel&&ui.csel.on){if(lxFired>=t0){cselExit()}else return}
 copyLocCode(locX,locY)},3000)}
function locMove(x,y){if(!locT)return;if(Math.abs(x-locX)+Math.abs(y-locY)>12){clearTimeout(locT);locT=null}}
function locUp(){clearTimeout(locT);locT=null}
document.addEventListener('touchstart',e=>{const p=e.touches[0];if(p)locDown(p.clientX,p.clientY)},{passive:true});
document.addEventListener('touchmove',e=>{const p=e.touches[0];if(p)locMove(p.clientX,p.clientY)},{passive:true});
document.addEventListener('touchend',locUp,{passive:true});
document.addEventListener('touchcancel',locUp,{passive:true});
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;locDown(e.clientX,e.clientY)});
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;locMove(e.clientX,e.clientY)});
document.addEventListener('pointerup',locUp);
document.addEventListener('pointercancel',locUp);
function txOpen(kind,inv,cid){if(Date.now()-lxFired<900)return;if(cid)go('profile',{id:cid,focus:(kind==='debt'?'d:':'p:')+(inv||'')});else if(kind==='debt'&&inv)go('invoice',{id:inv})}
function selXlsx(){if(!ui.sel||!ui.sel.on||!ui.sel.ids.length){toastMsg(t('selEmpty'));return}if(typeof XLSX==='undefined'){toastMsg('Excel');return}
 const rows=[[t('date'),t('time'),t('cust'),t('type'),CUR(),t('remind')]];
 ui.sel.ids.map(selFind).filter(Boolean).sort((a,b)=>b.ts-a.ts).forEach(o=>{const c=o.cust?cust(o.cust):null;rows.push([dateStr(o.ts),timeStr(o.ts),c?c.name:'',t(o.kind==='debt'?'debt':'pay'),fmt(o.amount),o.kind==='debt'?(o.note||''):(o.method||'')])});
 try{const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'sel');XLSX.writeFile(wb,'dafter-selection.xlsx');toastMsg(t('done'))}catch(e){toastMsg('Excel')}}
function openHomeMenu(){openSheet('<h3>'+t('menu')+'</h3>'
 +'<button class="srow" onclick="closeSheet();selStart()"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('checkc',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('sel')+'</span></span>'+ic('fwd',17)+'</button>'
 +'<button class="srow" onclick="closeSheet();exportAll()"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('excel',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('exportAll')+'</span></span>'+ic('fwd',17)+'</button>'
)}
window.selAllVisible=()=>{const keys=filteredTx().map(x=>x.key);const all=keys.length&&ui.sel.ids.length>=keys.length&&keys.every(k=>ui.sel.ids.includes(k));ui.sel.ids=all?[]:keys;render()};
function selDelete(){if(!ui.sel||!ui.sel.on||!ui.sel.ids.length){toastMsg(t('selEmpty'));return}
 const d=DD();const tr=(d.trash||(d.trash=[]));
 const invIds=ui.sel.ids.filter(k=>k[0]==='d').map(k=>k.substring(2));
 const payIds=ui.sel.ids.filter(k=>k[0]==='p').map(k=>k.substring(2));
 const n=ui.sel.ids.length;
 const pushed=[];
 d.invoices.filter(i=>invIds.includes(i.id)).forEach(o=>{const e={k:'d',o:o,ts:Date.now()};tr.push(e);pushed.push(e)});
 d.payments.filter(p=>payIds.includes(p.id)).forEach(o=>{const e={k:'p',o:o,ts:Date.now()};tr.push(e);pushed.push(e)});
 d.invoices=d.invoices.filter(i=>!invIds.includes(i.id));
 d.payments=d.payments.filter(p=>!payIds.includes(p.id));
 save();try{if(navigator.vibrate)navigator.vibrate(45)}catch(e){}
 ui.sel={on:false,ids:[]};render();
 toastMsg(t('deletedN')(n)+' · '+t('trashT'),()=>{const tr2=DD().trash;pushed.forEach(e=>{const ix=tr2.indexOf(e);if(ix>=0)tr2.splice(ix,1);(e.k==='d'?DD().invoices:DD().payments).push(e.o)});save();render()});}
