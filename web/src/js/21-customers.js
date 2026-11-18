/* =====================================================================
 * Daftari · 21-customers.js
 * ---------------------------------------------------------------------
 * Customer list, filtering, multi-select
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function filteredCustomers(all){const cq=normAr(ui.cq||'');const qd=pdig(ui.cq);
 const f=ui.f;let list=DD().customers.filter(c=>!c.archived);
 if(cq)list=list.filter(c=>normAr(c.name).includes(cq)||(qd.length>=3&&pdig(c.phone).endsWith(qd)));
 if(f.status==='owed')list=list.filter(c=>custOpen(c.id)>0);
 if(f.status==='none')list=list.filter(c=>custOpen(c.id)<=0);
 /* "آخر نشاط" must show the most recent activity first. */
 list.sort((a,b)=>(!!b.pinned-!!a.pinned)||(f.sort==='name'?String(a.name).localeCompare(String(b.name),'ar'):f.sort==='debt'?(custOpen(a.id)-custOpen(b.id)):f.sort==='low'?(custOpen(b.id)-custOpen(a.id)):(lastAct(b.id)-lastAct(a.id))));
 return list;
}
/* The most recent operation of a customer - the reference row shows its
   kind and the clock time, e.g. "فاتورة · 5:33 ص". */
function lastOpOf(id){
 const inv=DD().invoices.filter(i=>i.cust===id&&!i.arch).sort((a,b)=>b.ts-a.ts)[0];
 const pay=DD().payments.filter(p=>p.cust===id&&!p.arch).sort((a,b)=>b.ts-a.ts)[0];
 if(inv&&pay)return inv.ts>=pay.ts?{k:'d',ts:inv.ts,label:t('invoice')}:{k:'p',ts:pay.ts,label:t('pay')+' '+t(pay.method||'cash')};
 if(inv)return {k:'d',ts:inv.ts,label:t('invoice')};
 if(pay)return {k:'p',ts:pay.ts,label:t('pay')+' '+t(pay.method||'cash')};
 return null;
}
/* The row frame follows the reference canvas - see the "Operation row
   frame" block in css/tokens.css for the measured geometry. */
function custRow(c,showPhone){
 const open=custOpen(c.id),credit=custCredit(c.id);
 const amt=open>0
  ?'<span class="orow-amt red"><span class="num">'+fmt(open)+'</span><span class="cur">'+CUR()+'</span></span>'
  :credit>0
  ?'<span class="orow-amt green"><span class="num">'+fmt(-credit)+'</span><span class="cur">'+CUR()+'</span></span>'
  :'<span class="orow-amt gray"><span class="num">'+fmt(0)+'</span><span class="cur">'+CUR()+'</span></span>';
 const sel=ui.csel&&ui.csel.on,isSel=sel&&ui.csel.ids.includes(c.id);
 const box=sel?'<span class="orow-sel'+(isSel?' on':'')+'">'+(isSel?ic('checkb',15):'')+'</span>':'';
 const op=lastOpOf(c.id);
 const needPhone = (()=>{try{return c.phone && findSimilarCustomers(c.name,c.id).length>0;}catch(e){return false}})();
 const phoneChip = needPhone ? '<span class="orow-phone num">'+esc(c.phone)+'</span>' : '';
 const metaInner = op ? esc(op.label) : esc(t('noOps'));
 const meta='<div class="orow-meta"><span class="tx">'+metaInner+'</span></div>';
 return '<div class="card litem orow'+(isSel?' sel':'')+'" '+(sel?'onclick="cselToggle(\''+c.id+'\')"':'onclick="clOpen(\''+c.id+'\')" onpointerdown="clDownP(event,\''+c.id+'\')" onpointerup="clUpC()" onpointerleave="clUpC()" ontouchstart="clDownT(event,\''+c.id+'\')" ontouchend="clUpC()" ontouchmove="clMoveC(event)" oncontextmenu="return false"')+' role="button" tabindex="0">'+box+
 avat(c.name,'var(--row-av)',c.id)+'<div class="orow-mid"><div class="orow-name"><span>'+esc(c.name)+'</span>'+phoneChip+'</div>'+meta+'</div>'
 +(c.pinned?'<span class="orow-pin" aria-label="'+esc(t('pinned'))+'">'+ic('pinf',13)+'</span>':'')+
 '<div class="orow-side">'+amt+'</div></div>';
}
let clKey='';
const clLP={t:null,x:0,y:0};
window.selLongPressC=k=>{if(ui.csel&&ui.csel.on)return;try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}lxKey=k;lxFired=Date.now();ui.csel={on:true,ids:[k]};render()};
function clDownT(e,k){if(ui.csel&&ui.csel.on)return;const p=e.touches[0];if(!p)return;clLP.x=p.clientX;clLP.y=p.clientY;clearTimeout(clLP.t);clLP.t=setTimeout(()=>{clLP.t=null;selLongPressC(k)},400)}
function clDownP(e,k){if(ui.csel&&ui.csel.on)return;if(Date.now()-touchSeen<800)return;if(e.pointerType==='touch')return;clLP.x=e.clientX;clLP.y=e.clientY;clearTimeout(clLP.t);clLP.t=setTimeout(()=>{clLP.t=null;selLongPressC(k)},400)}
function clMoveC(e){if(!clLP.t)return;const p=(e.touches&&e.touches[0])||e;if(Math.abs(p.clientX-clLP.x)+Math.abs(p.clientY-clLP.y)>10){clearTimeout(clLP.t);clLP.t=null}}
function clUpC(){clearTimeout(clLP.t);clLP.t=null}
function clOpen(id){if(Date.now()-lxFired<900)return;go('profile',{id:id})}
window.cselToggle=k=>{if(!ui.csel||!ui.csel.on)return;if(Date.now()-lxFired<900&&k===lxKey)return;const a=ui.csel.ids;const i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.push(k);render()};
window.cselExit=()=>{ui.csel={on:false,ids:[]};render()};
window.cselAll=()=>{const ids=filteredCustomers(true).map(c=>c.id);const all=ids.length&&ui.csel.ids.length>=ids.length&&ids.every(k=>ui.csel.ids.includes(k));ui.csel.ids=all?[]:ids;render()};
function cselPin(){if(!ui.csel||ui.csel.ids.length!==1)return;const c=cust(ui.csel.ids[0]);if(!c)return;c.pinned=!c.pinned;save();ui.csel={on:false,ids:[]};render();toastMsg(c.pinned?t('pinAct')+' ✓':t('unpinAct')+' ✓')}
function cselEdit(){if(!ui.csel||ui.csel.ids.length!==1)return;const c=cust(ui.csel.ids[0]);if(!c)return;ui.csel={on:false,ids:[]};ui.nc={name:c.name,phone:c.phone||'',limit:c.limit||'',photo:c.photo||null,edit:c.id,forceDup:false};go('newcust',{})}
function cselShare(){if(!ui.csel||!ui.csel.ids.length){toastMsg(t('selEmpty'));return}
 const txt=ui.csel.ids.map(id=>statementText(id)).join('\n\n');
 if(navigator.share){navigator.share({text:txt}).catch(()=>{})}else if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toastMsg(t('copied'))).catch(()=>toastMsg(t('copied')))}else toastMsg(t('copied'));
 ui.csel={on:false,ids:[]};render()}
function cselStop(){if(!ui.csel||ui.csel.ids.length!==1)return;const id=ui.csel.ids[0];ui.csel={on:false,ids:[]};render();confirmArchive(id)}
function cselDelete(){if(!ui.csel||!ui.csel.ids.length){toastMsg(t('selEmpty'));return}
 const d=DD();const tr=(d.trash||(d.trash=[]));const ids=ui.csel.ids.slice();const n=ids.length;const pushed=[];
 ids.forEach(id=>{const ix=d.customers.findIndex(c=>c.id===id);if(ix<0)return;const e={k:'c',o:d.customers[ix],ts:Date.now()};tr.push(e);pushed.push(e);d.customers.splice(ix,1)});
 save();try{if(navigator.vibrate)navigator.vibrate(45)}catch(e){}
 ui.csel={on:false,ids:[]};render();
 toastMsg(t('deletedN')(n)+' · '+t('trashT'),()=>{const tr2=DD().trash;pushed.forEach(e=>{const ix=tr2.indexOf(e);if(ix>=0)tr2.splice(ix,1);DD().customers.push(e.o)});save();render()});}
/* The customers selection bar - the same card as the feed one, with
   the count of the selected customers on its first line. */
function custSelBar(){const one=ui.csel.ids.length===1;const c=one?cust(ui.csel.ids[0]):null;
 const B=(oc,icon,label,cls,al)=>'<button class="btn '+(cls||'btn-soft')+' selin" style="flex:1;min-width:0;font-size:12.5px;white-space:nowrap;gap:6px" onclick="'+oc+'"'+(al?' aria-label="'+al+'"':'')+'>'+ic(icon,17)+(label?'<span>'+label+'</span>':'')+'</button>';
 return '<div class="selbar">'
 +'<div class="selbar-top"><span class="selbar-n">'+t('selN')+' <span class="num">'+ui.csel.ids.length+'</span></span><span class="sp"></span>'
 +'<button class="btn btn-line selin" style="flex:none;padding:0 14px;font-size:13.5px" onclick="cselExit()">'+ic('x',16)+t('cancel')+'</button></div>'
 +'<div class="selbar-acts">'
 +(one?'':B('cselAll()','checkc',t('selAllS')))
 +(one?B('cselPin()','pin','',null,c&&c.pinned?t('unpinAct'):t('pinAct'))+B('cselEdit()','edit','',null,t('editL')):'')
 +B('cselShare()','share','',null,t('share'))
 +(one?B('cselStop()','archive','',null,t('stopC')):'')
 +B('cselDelete()','trash','','btn-red',t('del'))
 +'</div></div>'}
function cFCount(){const f=ui.f;return (f.sort&&f.sort!=='recent'?1:0)}
/* The three-dot button opens the customers menu: pin a customer, or
   sort the list. It keeps the count badge when a sort is active. */
function custMenuBtn(){const n=cFCount();
 return '<button class="hbtn" id="cfbtn" style="height:46px;width:46px;padding:0;justify-content:center;position:relative" aria-label="'+esc(t('custMenu'))+'" onclick="openCustListMenu()">'+ic('dots',19)+(n?'<span class="notif-badge"><span class="num">'+n+'</span></span>':'')+'</button>'}
function refreshCustMenuBtn(){const b=document.getElementById('cfbtn');if(b)b.outerHTML=custMenuBtn()}
function fChips(){const f=ui.f,out=[];
 if(f.status==='owed')out.push(['owed',t('owedF')]);if(f.status==='none')out.push(['none',t('noDebtF')]);
 if(!out.length)return '';
 return '<div class="pad" id="fchips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+out.map(k=>'<button class="chip" style="border:1px solid var(--line);background:var(--card);font-weight:700;padding:5px 10px" onclick="clearFCond(\''+k[0]+'\')">'+k[1]+' \u00d7</button>').join('')+'</div>'}
function clearFCond(k){ui.f.status='all';ui.cmax=60;render()}
function setQuick(k){ui.f.status=k;ui.cmax=60;render()}
function openCustNavMenu(){openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('menu')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
+'<button class="srow" onclick="closeSheet();ui.arch=true;ui.archQ=\'\';render()"><span class="sic2">'+ic('archive',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('archListT')+'</span></span>'+ic('fwd',17)+'</button>'
+'<button class="srow" onclick="closeSheet();openPaper()"><span class="sic2">'+ic('cam',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('paperGo')+'</span></span>'+ic('fwd',17)+'</button>')}
/* The customers menu - what the three-dot button opens. */
function openCustListMenu(){
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('custMenu')+'</h3><span class="sp"></span>'
 +'<button class="hbtn" onclick="closeSheet()" aria-label="'+esc(t('close'))+'">'+ic('x',17)+'</button></div>'
 +'<button class="srow" onclick="closeSheet();openCustPinSheet()"><span class="sic2" style="background:var(--amber-bg);color:var(--amber)">'+ic('pin',19)+'</span>'
 +'<span class="sp" style="text-align:start"><span class="t">'+t('pinCust')+'</span><span class="d">'+t('pinPickHint')+'</span></span>'+ic('fwd',17)+'</button>'
 +'<button class="srow" onclick="closeSheet();openCustSort()"><span class="sic2">'+ic('sliders',19)+'</span>'
 +'<span class="sp" style="text-align:start"><span class="t">'+t('sortBy')+'</span></span>'+ic('fwd',17)+'</button>');
}
/* Pick a customer to pin - the pinned one wears the gold corner. */
function openCustPinSheet(){
 const cs=DD().customers.filter(c=>!c.archived).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('pinCust')+'</h3><span class="sp"></span>'
 +'<button class="hbtn" onclick="closeSheet()" aria-label="'+esc(t('close'))+'">'+ic('x',17)+'</button></div>'
 +'<div class="muted" style="font-size:12.5px;margin-bottom:12px;line-height:1.8">'+t('pinPickHint')+'</div>'
 +(cs.length?cs.map(c=>'<button class="srow" onclick="pinToggle(\''+c.id+'\')">'+avat(c.name,44,c.id)
   +'<span class="sp" style="text-align:start"><span class="t">'+esc(c.name)+'</span>'
   +'<span class="d">'+esc(c.pinned?t('pinned'):t('pinU'))+'</span></span>'
   +(c.pinned?'<span class="sic2" style="background:var(--amber-bg);color:var(--amber)">'+ic('pin',19)+'</span>':ic('fwd',17))+'</button>').join('')
  :'<div class="muted" style="text-align:center;padding:26px 0">'+esc(t('noCustomers'))+'</div>'));
}
function pinToggle(id){const c=cust(id);if(!c)return;c.pinned=!c.pinned;save();render();closeSheet();toastMsg((c.pinned?t('pinAct'):t('unpinAct'))+' ✓')}
function openCustSort(){renderCustSheet();document.getElementById('sheetWrap').classList.add('open')}
function custCounts(){const cs=DD().customers.filter(c=>!c.archived);const cnt={all:cs.length,open:0,part:0,paid:0};
 cs.forEach(c=>{const o=custOpen(c.id),p=custPaid(c.id);if(o>0){cnt.open++;if(p>0)cnt.part++}else if(custPurch(c.id)>0)cnt.paid++});return cnt}
function renderCustSheet(){const f=ui.f;const cs=DD().customers.filter(c=>!c.archived);
 const segs=(cur,items,fn)=>'<div class="seg">'+items.map(k=>'<button class="'+(cur===k[0]?'on':'')+'" onclick="'+fn+'(\''+k[0]+'\')">'+k[1]+'</button>').join('')+'</div>';
 const chip=(on,k,lb)=>'<button class="chip" style="border:1px solid var(--line);'+(on?'background:var(--navy);color:#fff;font-weight:700':'background:var(--card)')+';padding:8px 12px" onclick="toggleFLim(\''+k+'\')">'+lb+'</button>';
 const n=filteredCustomers(true).length;
 document.getElementById('sheet').innerHTML='<div class="grab"></div><div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('sortBy')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()" aria-label="'+esc(t('close'))+'">'+ic('x',17)+'</button></div>'


 +'<div class="lb" style="margin:0 0 7px">'+t('sort')+'</div>'+segs(f.sort,[['recent',t('sRecent')],['debt',t('sDebt')],['low',t('sortLowF')],['name',t('sortNameF')]],'setCSo')
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="ui.f.sort=\'recent\';ui.cmax=60;render();renderCustSheet()">'+t('clearF')+'</button><button class="btn btn-navy" style="flex:1.4" onclick="closeSheet()">'+t('showN')(n)+'</button></div>';}
function setCSt(k){ui.f.status=k;ui.cmax=60;render();renderCustSheet()}
function toggleFLim(k){ui.f[k]=!ui.f[k];ui.cmax=60;render();renderCustSheet()}
function setCSo(k){ui.f.sort=k;ui.cmax=60;render();renderCustSheet()}
window.refreshList=keep=>{if(!keep){render();return}const el=document.getElementById('clist2');if(el)el.innerHTML=custListBody();refreshCustMenuBtn()};
