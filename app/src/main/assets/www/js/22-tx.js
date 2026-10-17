/* =====================================================================
 * Daftari · 22-tx.js
 * ---------------------------------------------------------------------
 * Transaction feed model + rows
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function txAll(){const d=DD();const arr=[];d.invoices.forEach(i=>{if(i.arch)return;arr.push({kind:'debt',ts:i.ts,cust:i.cust,amt:i.amount,note:i.note,inv:i.id,key:'d:'+i.id})});d.payments.forEach(p=>{if(p.arch)return;arr.push({kind:'pay',ts:p.ts,cust:p.cust,amt:p.amount,note:t(p.method),inv:null,key:'p:'+p.id})});return arr}
function filteredTx(){let L=txAll();const f=ui.tf;
 if(f.kind==='debt')L=L.filter(x=>x.kind==='debt');if(f.kind==='pay')L=L.filter(x=>x.kind==='pay');
 if(f.period==='today')L=L.filter(x=>isToday(x.ts));if(f.period==='week')L=L.filter(x=>Date.now()-x.ts<7*D);if(f.period==='month')L=L.filter(x=>Date.now()-x.ts<30*D);
 if(ui.tq){const q=normAr(ui.tq);L=L.filter(x=>{const c=cust(x.cust);return (c&&normAr(c.name).includes(q))||normAr(x.note||'').includes(q)});}
 L=L.sort((x,y)=>y.ts-x.ts);window.__txFull=L.length;return L.slice(0,ui.txLimit||60)}
function txRow(x){const c=x.cust?cust(x.cust):null;if(!c&&!isP())return '';const nm=c?c.name:t(x.kind==='debt'?'expense':'deposit');const av=c?avat(c.name,44):'<span class="av" style="width:44px;height:44px;background:'+(x.kind==='debt'?'var(--red-bg);color:var(--red)':'var(--green-bg);color:var(--green)')+'">'+ic(x.kind==='debt'?'receipt':'banknote',18)+'</span>';
 const sel=ui.sel&&ui.sel.on,isSel=sel&&ui.sel.ids.includes(x.key);
 const box=sel?'<span style="width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;border:2px solid '+(isSel?'var(--navy);background:var(--navy);color:#fff':'var(--line)')+'">'+(isSel?ic('check',13):'')+'</span>':'';
 return '<div class="card litem'+(isSel?' sel':'')+'" '+(sel?'onclick="selToggle(\''+x.key+'\')"':'onclick="txOpen(\''+x.kind+'\',\''+(x.inv||'')+'\',\''+(c?c.id:'')+'\')" onpointerdown="txDownP(event,\''+x.key+'\')" onpointerup="txUpC()" onpointerleave="txUpC()" ontouchstart="txDownT(event,\''+x.key+'\')" ontouchend="txUpC()" ontouchmove="txMoveC(event)" oncontextmenu="return false" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\')this.click()"')+'>'+box+av+'<div class="sp"><b>'+esc(nm)+(x.kind==='debt'&&isOverdue(DD().invoices.find(i=>i.id===x.inv)||{})?' <span class="chip b-open" style="padding:2px 8px;font-size:10.5px"><span class="dot"></span>'+t('overdue')+'</span>':'')+'</b><div class="soft" style="font-size:13px;margin-top:2px">'+(x.inv&&invEdited(x.inv)?'<span class="chip" style="background:var(--amber-bg);color:var(--amber);padding:2px 8px;font-size:10.5px;margin-inline-end:6px">'+ic('edit',11)+' '+t('edited')+' · '+dateStr(lastEdit(x.inv).ts)+'</span> ':'')+(x.kind==='debt'?ic('receipt',12):ic('banknote',12))+' '+esc(x.note||'')+'</div><div class="muted" style="font-size:11.5px;margin-top:3px">'+ic('clock',11)+' '+timeStr(x.ts)+' · '+dateStr(x.ts)+'</div></div><div style="text-align:end"><span class="amt '+(x.kind==='debt'?'red':'green')+'"><span class="num">'+fmt(x.amt)+'</span> '+CUR()+'</span></div></div>'}
window.selToggle=k=>{if(!ui.sel||!ui.sel.on)return;if(Date.now()-lxFired<900&&k===lxKey)return;const a=ui.sel.ids;const i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.push(k);render()};
window.selExit=()=>{ui.sel={on:false,ids:[]};render()};
window.selStart=()=>{ui.sel={on:true,ids:[]};render()};
let lxFired=0,lxKey='';
const txLP={t:null,x:0,y:0};
window.selLongPress=k=>{if(ui.sel&&ui.sel.on)return;try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}lxKey=k;lxFired=Date.now();ui.sel={on:true,ids:[k]};render()};
function txDownT(e,k){if(ui.sel&&ui.sel.on)return;const p=e.touches[0];if(!p)return;txLP.x=p.clientX;txLP.y=p.clientY;clearTimeout(txLP.t);txLP.t=setTimeout(()=>{txLP.t=null;selLongPress(k)},400)}
function txDownP(e,k){if(ui.sel&&ui.sel.on)return;if(Date.now()-touchSeen<800)return;if(e.pointerType==='touch')return;txLP.x=e.clientX;txLP.y=e.clientY;clearTimeout(txLP.t);txLP.t=setTimeout(()=>{txLP.t=null;selLongPress(k)},400)}
function txMoveC(e){if(!txLP.t)return;const p=(e.touches&&e.touches[0])||e;if(Math.abs(p.clientX-txLP.x)+Math.abs(p.clientY-txLP.y)>10){clearTimeout(txLP.t);txLP.t=null}}
function txUpC(){clearTimeout(txLP.t);txLP.t=null}
