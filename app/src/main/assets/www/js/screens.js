/* ================= screens ================= */
const accInit=()=>{const n=(curAcc()&&curAcc().name||'').trim();return n?n.charAt(0).toUpperCase():'د'};
function accChip(){const a=curAcc();return '<button class="hbtn accchip" aria-label="'+t('switchAcc')+'" style="gap:8px" onclick="openAccSheet()">'+(a.type==='grocery'?ic('store',18):ic('user',18))+'<span class="accn" style="font-weight:800;font-size:14px">'+esc(a.name)+'</span>'+ic('chevD',15)+'</button>'}
function headerBar(title,sub,backFn,menuFn,extra){
 const backAttribute=backFn&&typeof backFn==='object'?'data-action="'+esc(backFn.action)+'"':'onclick="'+backFn+'"';
 return '<div class="hdr">'+(backFn?'<button class="hbtn" aria-label="'+t('back')+'" '+backAttribute+'>'+ic('back',20)+'</button>':'<span style="width:10px"></span>')+
 '<div class="sp" style="text-align:center"><h1>'+title+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'+
 (menuFn?'<button class="hbtn" aria-label="'+t('menu')+'" onclick="'+menuFn+'">'+ic('dots',20)+'</button>':(extra||'<span style="width:10px"></span>'))+'</div>';
}
const todayExp=()=>DD().invoices.filter(i=>isToday(i.ts)).reduce((x,i)=>x+i.amount,0);
function statsCards(){const p=isP();const d0=new Date();d0.setHours(0,0,0,0);const a=d0.getTime(),b=a+86400000;
const td=Ledger.todayDebt(DD(),a,b),tp=Ledger.todayPay(DD(),a,b);
return '<div class="stats pad" id="stats1"><div class="stat red" role="button" tabindex="0" onclick="ui.tf={kind:\'debt\',period:\'today\'};refreshHome()"><div class="t">'+ic('receipt',15)+(p?t('expToday'):t('todayDebt'))+'</div><div class="v">'+money(td)+'</div></div><div class="stat green" role="button" tabindex="0" onclick="ui.tf={kind:\'pay\',period:\'today\'};refreshHome()"><div class="t">'+ic('banknote',15)+(p?t('depToday'):t('sToday'))+'</div><div class="v">'+money(tp)+'</div></div></div>'}
const pdig=s0=>{let x=(s0||'').replace(/\D/g,'');if(x.startsWith('966'))x=x.slice(3);return x};
const custOverAmt=id=>DD().invoices.filter(i=>i.cust===id&&isOverdue(i)).reduce((x,i)=>x+invRem(i),0);
const custOverSince=id=>DD().invoices.filter(i=>i.cust===id&&isOverdue(i)).reduce((m,i)=>(!m||i.due<m)?i.due:m,0);
const NEARLIM=0.1;
const limitState=c=>{if(!c.limit)return 'ok';const o=custOpen(c.id);if(o>c.limit)return 'over';if(o>0&&(c.limit-o)<=c.limit*NEARLIM)return 'near';return 'ok'};
const lastOpTxt=ts=>(!ts?t('noOps'):(Date.now()-ts>14*D?dateStr(ts):rel(ts)));
function filteredCustomers(all){const cq=normAr(ui.cq||'');const qd=pdig(ui.cq);
 const f=ui.f;let list=DD().customers.filter(c=>!c.archived);
 if(cq)list=list.filter(c=>normAr(c.name).includes(cq)||(qd.length>=3&&pdig(c.phone).endsWith(qd)));
 if(f.status==='owed')list=list.filter(c=>custOpen(c.id)>0);
 if(f.status==='none')list=list.filter(c=>custOpen(c.id)<=0);
 list.sort((a,b)=>(!!b.pinned-!!a.pinned)||(f.sort==='name'?String(a.name).localeCompare(String(b.name),'ar'):f.sort==='debt'?(custOpen(a.id)-custOpen(b.id)):f.sort==='low'?(custOpen(b.id)-custOpen(a.id)):(lastAct(a.id)-lastAct(b.id))));
 return list;
}
function custRow(c,showPhone){
 const open=custOpen(c.id);
 const amt=open>0?'<span class="amt red"><span class="num">'+fmt(open)+'</span> '+CUR()+'</span>':'<span class="amt gray"><span class="num">0.00</span> '+CUR()+'</span>';
 const sel=ui.csel&&ui.csel.on,isSel=sel&&ui.csel.ids.includes(c.id);
 const box=sel?'<span style="width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;border:2px solid '+(isSel?'var(--navy);background:var(--navy);color:#fff':'var(--line)')+'">'+(isSel?ic('check',13):'')+'</span>':'';
 return '<div class="card litem'+(isSel?' sel':'')+'" '+(sel?'onclick="cselToggle(\''+c.id+'\')"':'onclick="clOpen(\''+c.id+'\')" onpointerdown="clDownP(event,\''+c.id+'\')" onpointerup="clUpC()" onpointerleave="clUpC()" ontouchstart="clDownT(event,\''+c.id+'\')" ontouchend="clUpC()" ontouchmove="clMoveC(event)" oncontextmenu="return false"')+' role="button" tabindex="0">'+box+
 avat(c.name,46)+'<div class="sp"><div class="row" style="gap:6px"><b>'+esc(c.name)+'</b>'+(c.pinned?ic('pin',13).replace('class="ic"','class="ic" style="color:#c9a06c"'):'')+'</div>'+(showPhone&&c.phone?'<div class="muted num" style="font-size:12.5px">'+esc(c.phone)+'</div>':'')+'<div class="muted" style="font-size:12px">'+t('lastOp')+': '+lastOpTxt(lastAct(c.id))+'</div></div>'+
 '<div style="text-align:end">'+amt+'</div></div>';
}
let clKey='';const clLP={t:null,x:0,y:0};
window.selLongPressC=k=>{if(ui.csel&&ui.csel.on)return;try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}lxKey=k;lxFired=Date.now();ui.csel={on:true,ids:[k]};render()};
function clDownT(e,k){if(ui.csel&&ui.csel.on)return;const p=e.touches[0];if(!p)return;clLP.x=p.clientX;clLP.y=p.clientY;clearTimeout(clLP.t);clLP.t=setTimeout(()=>{clLP.t=null;selLongPressC(k)},400)}
function clDownP(e,k){if(ui.csel&&ui.csel.on)return;if(Date.now()-touchSeen<800)return;if(e.pointerType==='touch')return;clLP.x=e.clientX;clLP.y=e.clientY;clearTimeout(clLP.t);clLP.t=setTimeout(()=>{clLP.t=null;selLongPressC(k)},400)}
function clMoveC(e){if(!clLP.t)return;const p=(e.touches&&e.touches[0])||e;if(Math.abs(p.clientX-clLP.x)+Math.abs(p.clientY-clLP.y)>10){clearTimeout(clLP.t);clLP.t=null}}
function clUpC(){clearTimeout(clLP.t);clLP.t=null}
function clOpen(id){if(Date.now()-lxFired<900)return;go('profile',{id:id})}
window.cselToggle=k=>{if(!ui.csel||!ui.csel.on)return;if(Date.now()-lxFired<900&&k===lxKey)return;const a=ui.csel.ids;const i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.push(k);render()};
window.cselExit=()=>{ui.csel={on:false,ids:[]};render()};
window.cselAll=()=>{const ids=filteredCustomers(true).map(c=>c.id);const all=ids.length&&ui.csel.ids.length>=ids.length&&ids.every(k=>ui.csel.ids.includes(k));ui.csel.ids=all?[]:ids;render()};
function cselEdit(){if(!ui.csel||ui.csel.ids.length!==1)return;const c=cust(ui.csel.ids[0]);if(!c)return;ui.csel={on:false,ids:[]};ui.nc={name:c.name,phone:c.phone||'',limit:c.limit||'',photo:c.photo||null,edit:c.id,forceDup:false};go('newcust',{})}
function cselShare(){if(!ui.csel||!ui.csel.ids.length){toastMsg(t('selEmpty'));return}
 const txt=ui.csel.ids.map(id=>statementText(id)).join('\n\n');
 if(navigator.share){navigator.share({text:txt}).catch(()=>{})}else if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toastMsg(t('copied'))).catch(()=>toastMsg(t('copied')))}else toastMsg(t('copied'));
 ui.csel={on:false,ids:[]};render()}
function cselStop(){if(!ui.csel||ui.csel.ids.length!==1)return;const id=ui.csel.ids[0];ui.csel={on:false,ids:[]};render();confirmArchive(id)}
function custSelBar(){const one=ui.csel.ids.length===1;const c=one?cust(ui.csel.ids[0]):null;
 const B=(oc,icon,label,cls,al)=>'<button class="btn '+(cls||'btn-soft')+' selin" style="flex:1;min-width:0;font-size:12.5px;white-space:nowrap;gap:6px" onclick="'+oc+'"'+(al?' aria-label="'+al+'"':'')+'>'+ic(icon,17)+(label?'<span>'+label+'</span>':'')+'</button>';
 return B('cselExit()','x',t('cancel'),'btn-line')
 +(one?'':B('cselAll()','checkc',t('selAllS')))
 +(one?B('cselPin()','pin','',null,c&&c.pinned?t('unpinAct'):t('pinAct'))+B('cselEdit()','edit','',null,t('editL')):'')
 +B('cselShare()','share','',null,t('share'))
 +(one?B('cselStop()','archive','',null,t('stopC')):'')
 +B('cselDelete()','trash','','btn-red',t('del'))}
/* customer status chips (customers tab) */
function cFCount(){const f=ui.f;return (f.sort&&f.sort!=='recent'?1:0)}
function custFilterBtn(){const n=cFCount();
 return '<button class="hbtn" id="cfbtn" style="height:46px;gap:7px;font-weight:700" onclick="openCustFilter()">'+ic('sliders',17)+t('filter')+(n?'<span class="num" style="background:var(--red);color:#fff;border-radius:999px;min-width:19px;height:19px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;padding:0 5px">'+n+'</span>':'')+'</button>'}
function refreshCFilterBtn(){const b=document.getElementById('cfbtn');if(b)b.outerHTML=custFilterBtn()}
function fChips(){const f=ui.f,out=[];
 if(f.status==='owed')out.push(['owed',t('owedF')]);if(f.status==='none')out.push(['none',t('noDebtF')]);
 if(!out.length)return '';
 return '<div class="pad" id="fchips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+out.map(k=>'<button class="chip" style="border:1px solid var(--line);background:var(--card);font-weight:700;padding:5px 10px" onclick="clearFCond(\''+k[0]+'\')">'+k[1]+' \u00d7</button>').join('')+'</div>'}
function clearFCond(k){ui.f.status='all';ui.cmax=60;render()}
function setQuick(k){ui.f.status=k;ui.cmax=60;render()}
function openCustNavMenu(){openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('menu')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
+'<button class="srow" onclick="closeSheet();ui.arch=true;ui.archQ=\'\';render()"><span class="sic2">'+ic('archive',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('archListT')+'</span></span>'+ic('fwd',17)+'</button>'
+'<button class="srow" onclick="closeSheet();openPaper()"><span class="sic2">'+ic('cam',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('paperGo')+'</span></span>'+ic('fwd',17)+'</button>')}
function openCustFilter(){renderCustSheet();document.getElementById('sheetWrap').classList.add('open')}
function custCounts(){const cs=DD().customers.filter(c=>!c.archived);const cnt={all:cs.length,open:0,part:0,paid:0};
 cs.forEach(c=>{const o=custOpen(c.id),p=custPaid(c.id);if(o>0){cnt.open++;if(p>0)cnt.part++}else if(custPurch(c.id)>0)cnt.paid++});return cnt}
function renderCustSheet(){const f=ui.f;const cs=DD().customers.filter(c=>!c.archived);
 const segs=(cur,items,fn)=>'<div class="seg">'+items.map(k=>'<button class="'+(cur===k[0]?'on':'')+'" onclick="'+fn+'(\''+k[0]+'\')">'+k[1]+'</button>').join('')+'</div>';
 const chip=(on,k,lb)=>'<button class="chip" style="border:1px solid var(--line);'+(on?'background:var(--navy);color:#fff;font-weight:700':'background:var(--card)')+';padding:8px 12px" onclick="toggleFLim(\''+k+'\')">'+lb+'</button>';
 const n=filteredCustomers(true).length;
 document.getElementById('sheet').innerHTML='<div class="grab"></div><div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('filter')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'


 +'<div class="lb" style="margin:0 0 7px">'+t('sort')+'</div>'+segs(f.sort,[['recent',t('sRecent')],['debt',t('sDebt')],['low',t('sortLowF')],['name',t('sortNameF')]],'setCSo')
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="ui.f.sort=\'recent\';ui.cmax=60;render();renderCustSheet()">'+t('clearF')+'</button><button class="btn btn-navy" style="flex:1.4" onclick="closeSheet()">'+t('showN')(n)+'</button></div>';}
function setCSt(k){ui.f.status=k;ui.cmax=60;render();renderCustSheet()}
function toggleFLim(k){ui.f[k]=!ui.f[k];ui.cmax=60;render();renderCustSheet()}
function setCSo(k){ui.f.sort=k;ui.cmax=60;render();renderCustSheet()}
window.refreshList=keep=>{if(!keep){render();return}const el=document.getElementById('clist2');if(el)el.innerHTML=custListBody();refreshCFilterBtn()};
/* transactions feed (home) */
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
/* home multi-select (file-manager style) */
window.selToggle=k=>{if(!ui.sel||!ui.sel.on)return;if(Date.now()-lxFired<900&&k===lxKey)return;const a=ui.sel.ids;const i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.push(k);render()};
window.selExit=()=>{ui.sel={on:false,ids:[]};render()};
window.selStart=()=>{ui.sel={on:true,ids:[]};render()};
let lxFired=0,lxKey='';const txLP={t:null,x:0,y:0};
window.selLongPress=k=>{if(ui.sel&&ui.sel.on)return;try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}lxKey=k;lxFired=Date.now();ui.sel={on:true,ids:[k]};render()};
function txDownT(e,k){if(ui.sel&&ui.sel.on)return;const p=e.touches[0];if(!p)return;txLP.x=p.clientX;txLP.y=p.clientY;clearTimeout(txLP.t);txLP.t=setTimeout(()=>{txLP.t=null;selLongPress(k)},400)}
function txDownP(e,k){if(ui.sel&&ui.sel.on)return;if(Date.now()-touchSeen<800)return;if(e.pointerType==='touch')return;txLP.x=e.clientX;txLP.y=e.clientY;clearTimeout(txLP.t);txLP.t=setTimeout(()=>{txLP.t=null;selLongPress(k)},400)}
function txMoveC(e){if(!txLP.t)return;const p=(e.touches&&e.touches[0])||e;if(Math.abs(p.clientX-txLP.x)+Math.abs(p.clientY-txLP.y)>10){clearTimeout(txLP.t);txLP.t=null}}
function txUpC(){clearTimeout(txLP.t);txLP.t=null}
/* ---- 3s long-press anywhere: copy a numeric location code (screen-x%-y%-element#) ---- */
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
document.addEventListener('touchend',locUp,{passive:true});document.addEventListener('touchcancel',locUp,{passive:true});
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;locDown(e.clientX,e.clientY)});
document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;locMove(e.clientX,e.clientY)});
document.addEventListener('pointerup',locUp);document.addEventListener('pointercancel',locUp);
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
function waRemind(invId){const i=DD().invoices.find(x=>x.id===invId);if(!i)return;const c=cust(i.cust);if(!c||!c.phone){toastMsg(t('waNoPhone'));return}
 const msg=(db.lang==='ar'?'السلام عليكم '+c.name+'، يذكّركم '+curAcc().name+' بمتبقي '+fmt(invRem(i.id))+' '+CUR()+(i.due?' (استحقاق '+dateStr(i.due)+')':'')+' — جزاكم الله خيرًا':'Hello '+c.name+', '+curAcc().name+' reminds you of the remaining '+fmt(invRem(i.id))+' '+CUR()+'. Thank you!');
 window.open('https://wa.me/'+(c.phone||'').replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));}
let btDev=null,btChar=null;
const BT_SERV=['000018f0-0000-1000-8000-00805f9b34fb','0000ff00-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2','49535343-fe7d-4ae5-8fa9-9fafd205e455'];
async function connectBT(){if(!navigator.bluetooth){toastMsg(t('btNo'));return}
 try{const dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_SERV});
  btDev=dev;const server=await dev.gatt.connect();
  for(const su of BT_SERV){try{const svc=await server.getPrimaryService(su);const chs=await svc.getCharacteristics();btChar=chs.find(c=>c.properties.write||c.properties.writeWithoutResponse);if(btChar)break}catch(e){}}
  if(!btChar)throw 0;sec.btName=dev.name||'BT';saveSec();render();toastMsg('🖨 '+esc(sec.btName))}catch(e){toastMsg(t('btFail'))}}
async function btWrite(bytes){if(!btChar)throw 0;for(let i=0;i<bytes.length;i+=100)await btChar.writeValue(bytes.slice(i,i+100))}
async function printBT(text){if(!btChar){toastMsg(t('btNoDev'));return}
 try{await btWrite(new Uint8Array([0x1b,0x40]));await btWrite(new TextEncoder().encode(text+'\n\n\n'));await btWrite(new Uint8Array([0x1d,0x56,0x42,0x00]));toastMsg('🖨 ✓')}catch(e){toastMsg(t('btFail'))}}
function btStatement(id){const c=cust(id);const L=[curAcc().name+' · '+t('appName'),t('cust')+': '+c.name,'----------------------------'];
 custInvoices(id).forEach(i=>L.push(i.code+'  '+fmt(i.amount)+(i.edits&&i.edits.length?'  ('+t('edited')+' '+new Date(i.edits[i.edits.length-1].ts).toLocaleDateString('en-GB')+')':'')+'  '+new Date(i.ts).toLocaleDateString('en-GB')));
 L.push('----------------------------',t('remaining')+': '+fmt(custOpen(id))+' '+CUR());return L.join('\n')}
function qrB64(u){let b='';for(let i=0;i<u.length;i+=8192)b+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(b)}
async function openQrSend(){if(typeof qrcode==='undefined'){toastMsg('QR');return}
 const json=JSON.stringify({v:1,db});let payload='J'+json;
 try{if(window.CompressionStream){const cs=new CompressionStream('gzip');const rs=new Blob([json]).stream().pipeThrough(cs);const buf=await new Response(rs).arrayBuffer();const z=qrB64(new Uint8Array(buf));if(z.length<json.length)payload='Z'+z}}catch(e){}
 if(payload.length>2900){toastMsg(t('qrBig'));return}
 const q=qrcode(0,'L');q.addData(payload,'Byte');q.make();
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('qrSend')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="padding:16px;background:#fff;display:flex;justify-content:center" dir="ltr">'+q.createSvgTag({scalable:true})+'</div><div class="muted" style="text-align:center;margin-top:10px">'+t('qrHint')+'</div>')}
async function qrDecompress(b64){const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const ds=new DecompressionStream('gzip');const rs=new Blob([u]).stream().pipeThrough(ds);return await new Response(rs).text()}
function stopQr(){clearInterval(window.__qrTimer);if(window.__qrStream){window.__qrStream.getTracks().forEach(t=>t.stop());window.__qrStream=null}}
async function openQrStmt(id){if(typeof qrcode==='undefined'){toastMsg('QR');return}
 const txt=statementText(id);if(txt.length>2900){toastMsg(t('qrBig'));return}
 const q=qrcode(0,'L');q.addData(txt,'Byte');q.make();
 openSheet('<h3>'+t('qrStmt')+' — '+esc(cust(id).name)+'</h3><div style="display:flex;justify-content:center;padding:14px 0"><div style="background:#fff;padding:12px;border-radius:14px;width:max-content">'+q.createImgTag(4,0).replace('<img ','<img style="width:220px;height:220px" ')+'</div></div><div class="muted" style="text-align:center;line-height:1.8;font-size:12.5px">'+t('qrStmtHint')+'</div><div class="transcript" style="margin-top:12px;max-height:130px;overflow:auto;white-space:pre-line;text-align:start">'+esc(txt)+'</div>');}
function openQrRecv(){if(typeof jsQR==='undefined'){toastMsg('QR');return}
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('qrRecv')+'</h3><span class="sp"></span><button class="hbtn" onclick="stopQr();closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="overflow:hidden"><video id="qrVid" autoplay playsinline muted style="width:100%;display:block"></video></div><div class="muted" style="text-align:center;margin:10px 0">'+t('qrScan')+'</div>');
 if(!navigator.mediaDevices){toastMsg(t('qrCam'));return}
 navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(st=>{window.__qrStream=st;const v=document.getElementById('qrVid');if(!v){st.getTracks().forEach(t=>t.stop());return}v.srcObject=st;const cv=document.createElement('canvas');const cx=cv.getContext('2d');
  window.__qrTimer=setInterval(()=>{if(!v.videoWidth)return;cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);const res=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);
   if(res&&res.data){stopQr();closeSheet();qrApply(res.data)}},400);
 }).catch(()=>{stopQr();toastMsg(t('qrCam'))})}
async function qrApply(payload){try{const json=payload[0]==='Z'?await qrDecompress(payload.slice(1)):payload.slice(1);const obj=JSON.parse(json);if(obj&&obj.format==='dafter-backup'){await Backup.restore(obj);return}
 if(!obj||!obj.db)throw 0;
 await Backup.restore(obj.db,true)}catch(e){toastMsg(db.lang==='ar'?'تعذّرت قراءة البيانات':'Could not read data')}}
function selFind(k){const d=DD();const id=k.substring(2);return k[0]==='d'?d.invoices.find(x=>x.id===id):d.payments.find(x=>x.id===id)}
function fallbackCopy(text){try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toastMsg(t('copied'))}catch(e){toastMsg(esc(text.slice(0,80)))}}
function selShare(){if(!ui.sel||!ui.sel.on||!ui.sel.ids.length){toastMsg(t('selEmpty'));return}
 const lines=ui.sel.ids.map(k=>{const it=selFind(k);if(!it)return null;const c=it.cust?cust(it.cust):null;
  if(k[0]==='d')return (c?c.name+' — ':'')+t('newDebt')+': '+fmt(it.amount)+' '+CUR()+(it.note?' — '+it.note:'')+' ('+dateStr(it.ts)+')';
  return (c?c.name+' — ':'')+t('pay')+': '+fmt(it.amount)+' '+CUR()+' ('+dateStr(it.ts)+')';}).filter(Boolean);
 const text=curAcc().name+'\n'+lines.join('\n');
 if(navigator.share){navigator.share({text}).catch(()=>{})}
 else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>toastMsg(t('copied'))).catch(()=>fallbackCopy(text))}
 else fallbackCopy(text);}
function hfBadge(){const n=(ui.tf.kind!=='all'?1:0)+(ui.tf.period!=='month'?1:0);return n?'<span class="num" style="position:absolute;top:5px;inset-inline-end:5px;background:var(--red);color:#fff;border-radius:999px;font-size:10px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-weight:900">'+n+'</span>':''}
function openHomeFilter(){filteredTx();const tx=txAll();const seg=(cur,items,fn)=>'<div class="seg">'+items.map(k=>'<button class="'+(cur===k[0]?'on':'')+'" onclick="'+fn+'(\''+k[0]+'\')">'+k[1]+'</button>').join('')+'</div>';
 openSheet('<div class="grab"></div><div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('hfTitle')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<div class="lb" style="margin-top:0">'+t('hfKind')+'</div>'+seg(ui.tf.kind,[['all',t('all')+' · '+tx.length],['debt',t('debtsF')+' · '+tx.filter(x=>x.kind==='debt').length],['pay',t('paysF')+' · '+tx.filter(x=>x.kind==='pay').length]],'setHF')
 +'<div class="lb" style="margin:12px 0 7px">'+t('hfPeriod')+'</div>'+seg(ui.tf.period,[['today',t('pToday')+' · '+tx.filter(x=>isToday(x.ts)).length],['week',t('pWeek')+' · '+tx.filter(x=>Date.now()-x.ts<7*D).length],['month',t('pMonth')+' · '+tx.filter(x=>Date.now()-x.ts<30*D).length]],'setHP')
 +'<div class="muted" style="margin-top:12px;text-align:center;font-size:12px;font-weight:700"><span class="num">'+window.__txFull+'</span> '+t('hfShow')+'</div>'
 +((ui.tf.kind!=='all'||ui.tf.period!=='month')?'<button class="btn btn-line" style="margin-top:10px" onclick="ui.tf={kind:\'all\',period:\'month\'};ui.txLimit=60;closeSheet();render()">'+ic('x',15)+' '+t('clearF')+'</button>':''))}
function setHF(k){ui.tf.kind=k;ui.txLimit=60;closeSheet();render()}
function setHP(k){ui.tf.period=ui.tf.period===k?'month':k;ui.txLimit=60;closeSheet();render()}
window.refreshHome=()=>{const el=document.getElementById('txlist');if(el)el.innerHTML=feedHtml();const tn=document.getElementById('txn');if(tn)tn.textContent=window.__txFull;const pc=document.getElementById('pchips');if(pc)pc.innerHTML=pChipsHtml();const s1=document.getElementById('stats1');if(s1)s1.outerHTML=statsCards()};
function toggleDebt(){if(ui.tf.kind==='debt'){ui.tf={kind:'all',period:'today'}}else{ui.tf={kind:'debt',period:'month'}}refreshHome()}
function togglePay(){if(ui.tf.kind==='pay'){ui.tf={kind:'all',period:'today'}}else{ui.tf={kind:'pay',period:'month'}}refreshHome()}
function dayLabel(ts){const d=new Date(ts),n0=new Date();const a=new Date(d);a.setHours(0,0,0,0);const b=new Date(n0);b.setHours(0,0,0,0);const diff=Math.round((b-a)/864e5);
 if(diff<=0)return t('today');if(diff===1)return t('yest');
 return d.toLocaleDateString(db.lang==='ar'?'ar':'en-GB',{weekday:'long'})+' · '+d.getDate()+'/'+(d.getMonth()+1)}
function feedHtml(){const L=filteredTx();
 if(!L.length){const any=DD().invoices.length+DD().payments.length;
 if(any&&ui.tf.period==='today')return '<div class="muted" style="text-align:center;padding:24px 16px">'+t('noToday')+'<div style="margin-top:10px"><button class="btn btn-line" style="width:auto;padding:10px 18px;font-size:13.5px" onclick="ui.tf={kind:\'all\',period:\'all\'};ui.txLimit=60;refreshHome()">'+t('showAll')+'</button></div></div>';
 return '<div class="muted" style="text-align:center;padding:28px 16px">'+(any?t('noRes'):ic('mic',26)+'<div style="margin-top:10px;font-weight:700;line-height:1.7">'+t('emptyHome')+'</div>')+'</div>'}
 let out='',last='';L.forEach(x=>{const dl=dayLabel(x.ts);if(dl!==last){out+='<div class="lb" style="margin:2px 4px 2px;font-size:12px">'+dl+'</div>';last=dl}out+=txRow(x)});
 if(window.__txFull>L.length)out+='<div style="text-align:center;margin-top:10px"><button class="btn btn-line" style="width:auto;padding:10px 22px;font-size:13px" onclick="ui.txLimit='+L.length+'+60;refreshHome()">'+ic('chevD',15)+' '+t('showMore')+' (<span class="num">'+(window.__txFull-L.length)+'</span>)</button></div>';
 return out}
const privBtn=()=>'<button class="hbtn" onclick="sec.priv=!sec.priv;saveSec();render()" aria-label="'+t('hideAmt')+'">'+ic(sec.priv?'eyeoff':'eye',18)+'</button>';
const S_home=()=>{
 filteredTx();const n=window.__txFull;
 const selMode=ui.sel&&ui.sel.on;
 const hdr=selMode?'<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1 style="font-size:17px"><span class="num">'+ui.sel.ids.length+'</span> '+t('selN')+'</h1></div><div style="width:42px"></div></div>'
 :'<div class="hdr"><div class="logo-ic" style="font-size:18px;font-weight:900">'+esc(accInit())+'</div><div class="sp"><h1 style="font-size:21px">'+esc(curAcc().name)+'</h1></div>'+accChip()+'</div>';
 return hdr
 +'<div style="height:6px"></div>'+statsCards()
 +'<div class="pad search" style="margin-top:12px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('searchTx')+'" value="'+esc(ui.tq)+'" oninput="ui.tq=this.value;debTx()"></div>'+
 '<button class="hbtn" style="height:46px;position:relative" onclick="openHomeFilter()" aria-label="'+t('filter')+'">'+ic('sliders',18)+hfBadge()+'</button>'+
 '</div>'
 +'<div class="pad" style="margin:12px 20px 4px;font-weight:800;font-size:16.5px;display:flex;align-items:center;gap:8px">'+t('lastOps')+' <span class="chip" style="background:#efece6;color:var(--soft)"><span class="num" id="txn">'+n+'</span></span></div>'
 +'<div class="pad list" id="txlist" style="padding-bottom:14px">'+feedHtml()+'</div>';
};
function selBarHtml(){return '<button class="btn btn-line selin" style="flex:1.1;font-size:14.5px;white-space:nowrap" onclick="selExit()">'+ic('x',16)+t('cancel')+'</button><button class="btn btn-soft selin" style="flex:1.3;font-size:14.5px;white-space:nowrap" onclick="selAllVisible()">'+ic('checkc',16)+t('selAllS')+'</button><button class="btn btn-soft selin" style="flex:.9" onclick="selShare()" aria-label="'+t('share')+'">'+ic('share',18)+'</button><button class="btn btn-soft selin" style="flex:.9" onclick="selXlsx()" aria-label="'+t('repXlsx')+'">'+ic('excel',18)+'</button><button class="btn btn-red selin" style="flex:.9" onclick="selDelete()" aria-label="'+t('del')+'">'+ic('trash',18)+'</button>'}
const S_customers=()=>{
 if(isP())return '<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1>'+t('customers')+'</h1></div>'+accChip()+'</div><div class="pad"><div class="card" style="padding:30px 22px;text-align:center"><span class="av" style="width:70px;height:70px;margin:0 auto;background:var(--green-bg);color:var(--green)">'+ic('user',30)+'</span><div style="font-weight:800;margin-top:12px;font-size:17px">'+t('personal')+'</div><div class="muted" style="margin-top:8px;line-height:1.8">'+t('personalMsg')+'</div>'+lpBtn('debt','btn-red','mic',t('recDebt')).slice(0,-10)+' style="margin-top:16px"></button></div></div>';
 if(ui.arch)return headerBar(t('archListT'),null,'ui.arch=false;render()')+'<div class="pad list" id="clist2" style="margin-top:12px;padding-bottom:14px">'+archListBody()+'</div>';
 return '<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1>'+t('customers')+'</h1></div><div style="width:42px"></div></div>'
 +'<div class="pad" style="margin-top:4px;display:flex;align-items:center;gap:8px">'+accChip()+archBtn()+'<span class="sp"></span><button class="btn btn-soft" style="width:auto;padding:9px 13px;font-size:13px;font-weight:800" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button></div>'
 +'<div class="pad search" style="margin-top:10px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('searchC')+'" value="'+esc(ui.cq)+'" oninput="ui.cq=this.value;ui.cmax=60;debList()"></div>'+custFilterBtn()+'</div>'
 +fChips()

 +'<div class="pad list" id="clist2" style="margin-top:12px;padding-bottom:14px">'+custListBody()+'</div>';
};
function archCount(){return DD().customers.filter(c=>c.archived).length}
function archBtn(){const n=archCount();if(!n)return '';return '<button class="hbtn" style="height:42px;gap:6px" onclick="ui.arch=true;ui.archQ=\'\';render()" aria-label="'+t('archListT')+'">'+ic('archive',18)+'<span class="num" style="background:var(--amber);color:#fff;border-radius:999px;font-size:10.5px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:900">'+n+'</span></button>'}
function archListBody(){const q=normAr(ui.archQ||'');let list=DD().customers.filter(c=>c.archived);if(q)list=list.filter(c=>normAr(c.name).includes(q));
 return '<div class="inp card" style="margin-bottom:10px">'+ic('search',17)+'<input placeholder="'+t('searchC')+'" value="'+esc(ui.archQ||'')+'" oninput="ui.archQ=this.value;debList()"></div>'
 +(list.length?list.map(c=>'<div class="card litem" onclick="go(\'profile\',{id:\''+c.id+'\'})">'+avat(c.name,46)+'<div class="sp"><b>'+esc(c.name)+'</b><div class="muted">'+t('lastOp')+': '+lastOpTxt(lastAct(c.id))+'</div></div><button class="btn btn-soft" style="width:auto;padding:9px 14px;font-size:13px" onclick="event.stopPropagation();confirmRestore(\''+c.id+'\')">'+ic('undo',15)+t('restore')+'</button></div>').join(''):'<div class="muted" style="text-align:center;padding:28px 0">'+t('noArch')+'</div>')}
function custListBody(){const list=filteredCustomers(true);
 if(!list.length){
  const cs=DD().customers.filter(c=>!c.archived);
  if(!cs.length)return '<div class="card" style="padding:30px 22px;text-align:center"><span class="av" style="width:70px;height:70px;margin:0 auto;background:var(--navy-bg);color:var(--navy)">'+ic('users',30)+'</span><div style="font-weight:800;margin-top:12px;font-size:17px">'+t('noCustomers')+'</div><div class="muted" style="margin-top:8px;line-height:1.8">'+t('addFirstD')+'</div><button class="btn btn-navy" style="margin-top:14px" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button><div class="muted" style="margin-top:18px">'+t('paperQ')+'</div><button class="btn btn-line" style="margin-top:8px" onclick="openPaper()">'+ic('cam',16)+t('paperGo')+'</button></div>';
  if((ui.cq||'').trim())return '<div class="card" style="padding:26px 20px;text-align:center"><div style="font-weight:800">'+t('noResC')(esc(ui.cq.trim()))+'</div><button class="btn btn-navy" style="margin-top:14px" onclick="ui.nc={name:ui.cq.trim(),phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addX')(esc(ui.cq.trim()))+'</button></div>';
  return '<div class="muted" style="text-align:center;padding:28px 0">'+t('noRes')+'</div>'}
 const max=ui.cmax||60,vis=list.slice(0,max);
 let h=vis.map(c=>custRow(c,true)).join('');
 if(list.length>max)h+='<button class="btn btn-line" style="margin-top:10px" onclick="ui.cmax=(ui.cmax||60)+60;document.getElementById(\'clist2\').innerHTML=custListBody()">'+t('showMore')+' ('+(list.length-max)+')</button>';
 else if(list.length<6&&!(ui.cq||'').trim()&&cFCount()===0)h+='<div style="text-align:center;margin-top:16px"><button class="btn btn-line" style="width:auto;padding:10px 18px" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button></div>';
 return h}
function repBody(){const rp=ui.rp=ui.rp||{mode:'week',day:'',month:'',from:'',to:'',cust:null};const r=repData();
 const seg='<div class="seg">'+[['day',t('repDay')],['week',t('repWeek')],['month',t('repMonth')],['range',t('repRange')]].map(k=>'<button class="'+(rp.mode===k[0]?'on':'')+'" onclick="ui.rp.mode=\''+k[0]+'\';render()">'+k[1]+'</button>').join('')+'</div>';
 let inp='';
 if(rp.mode==='day'||rp.mode==='week')inp='<label class="lb">'+(rp.mode==='day'?t('repPickDay'):t('repWeekStart'))+'</label><input class="inp num" type="date" value="'+esc(rp.day)+'" oninput="ui.rp.day=this.value;render()">';
 else if(rp.mode==='month')inp='<label class="lb">'+t('repPickMonth')+'</label><input class="inp num" type="month" value="'+esc(rp.month)+'" oninput="ui.rp.month=this.value;render()">';
 else inp='<div class="row" style="gap:8px"><div style="flex:1;min-width:0"><label class="lb">'+t('repFrom')+'</label><input class="inp num" style="min-width:0;font-size:13px" type="date" value="'+esc(rp.from)+'" oninput="ui.rp.from=this.value;render()"></div><div style="flex:1;min-width:0"><label class="lb">'+t('repTo')+'</label><input class="inp num" style="min-width:0;font-size:13px" type="date" value="'+esc(rp.to)+'" oninput="ui.rp.to=this.value;render()"></div></div>';
 const cc=rp.cust?cust(rp.cust):null;
 return '<div class="pad" style="margin-top:8px">'+seg+'<div class="card" style="padding:12px 14px;margin-top:10px">'+inp
 +'<div class="row" style="margin-top:12px"><span class="lb" style="margin:0">'+t('cust')+'</span><span class="sp"></span><button class="chip" style="border:1.5px solid var(--navy);color:var(--navy);background:var(--card);font-weight:800;padding:7px 12px" onclick="openRepCust()">'+(cc?esc(cc.name):t('repCustAll'))+' '+ic('chevD',14)+'</button></div></div>'
 +'<div class="pad stats" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div class="stat red"><div class="t">'+t('repDebtSum')+'</div><div class="v">'+fmt(r.debt)+'</div></div><div class="stat green"><div class="t">'+t('repPaySum')+'</div><div class="v">'+fmt(r.pay)+'</div></div><div class="stat" style="background:var(--navy-bg);color:var(--navy)"><div class="t">'+t('repOps')+'</div><div class="v"><span class="num">'+(r.invs.length+r.pays.length)+'</span></div></div><div class="stat" style="background:'+(r.pay-r.debt>=0?'var(--green-bg)':'var(--red-bg)')+';color:'+(r.pay-r.debt>=0?'var(--green)':'var(--red)')+'"><div class="t">'+t('repNet')+'</div><div class="v">'+fmt(r.pay-r.debt)+'</div></div></div>'
 +'<div class="pad"><div class="card" style="padding:14px 16px"><div class="row">'+ic('pie',17)+'<b style="font-size:13.5px">'+t('repDay')+'/'+t('repWeek')+'</b><span class="sp"></span><span class="muted num" style="font-size:10.5px;white-space:nowrap">'+dateStr(r.a)+' ← '+dateStr(r.b-1)+'</span></div>'+(chartOK()?'<div style="position:relative;height:120px;margin-top:10px"><canvas id="chW"></canvas></div>':repBars(r))+'</div></div>'
 +(r.invs.length+r.pays.length?'<div class="pad list" style="padding-bottom:6px">'+[...r.invs.map(i=>({ts:i.ts,nm:repNm(i.cust),amt:i.amount,k:'debt',note:i.note})),...r.pays.map(pp=>({ts:pp.ts,nm:repNm(pp.cust),amt:pp.amount,k:'pay',note:''}))].sort((x,y)=>y.ts-x.ts).slice(0,12).map(x=>'<div class="card litem" style="margin-bottom:8px"><div class="sp"><b>'+esc(x.nm)+'</b><div class="muted" style="font-size:11.5px;margin-top:2px">'+(x.k==='debt'?ic('receipt',12):ic('banknote',12))+' '+esc(x.note||'')+' · '+dateStr(x.ts)+'</div></div><span class="amt '+(x.k==='debt'?'red':'green')+'"><span class="num">'+fmt(x.amt)+'</span> '+CUR()+'</span></div>').join('')+'</div>'
 :'<div class="muted" style="text-align:center;padding:18px 0">'+t('repEmpty')+'</div>')
 +'<div class="pad" style="display:flex;gap:10px;padding-top:4px;padding-bottom:18px"><button class="btn btn-line" style="flex:1" onclick="printRep()">'+ic('print',17)+t('repPrint')+'</button><button class="btn btn-navy" style="flex:1.3" onclick="exportRepXlsx()">'+ic('excel',17)+' '+t('repXlsx')+'</button></div></div>'}
const S_reports=()=>headerBar(t('repB'))+repBody();

const S_settings=()=>{const cur=curAcc();const st=sec.enabled?'var(--green)':'var(--muted)';
 const accRow='<div class="card" style="padding:14px 16px"><div class="row" style="align-items:center;gap:12px">'+
  '<span class="av" style="width:44px;height:44px;background:'+(cur.type==='grocery'?'var(--green-bg);color:var(--green)':'var(--navy-bg);color:var(--navy)')+'">'+ic(cur.type==='grocery'?'store':'user',20)+'</span>'+
  '<div class="sp"><div style="font-weight:800">'+esc(cur.name)+'</div><div class="muted" style="font-size:12.5px">'+t(cur.type==='grocery'?'grocery':'personal')+' · '+(cName(cur.cur)?cName(cur.cur)+' · ':'')+esc(cur.cur)+'</div></div>'+
  '<button class="btn btn-line" style="min-width:0;padding:8px 14px;font-size:13px" onclick="openAccSheet()">'+ic('gear',16)+t('switchAcc')+'</button></div></div>';
 const sec0=(title,body)=>'<div class="lb">'+title+'</div>'+body;
 const kv=(bg,col,icon,label,right,click)=>'<div class="kv"'+(click?' style="cursor:pointer" onclick="'+click+'"':'')+'><span class="kic" style="width:34px;height:34px;border-radius:10px;background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center">'+ic(icon,17)+'</span><span class="k" style="margin-inline-start:8px">'+label+'</span><span class="v">'+right+'</span></div>';
 return '<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1>'+t('settings')+'</h1></div><div style="width:42px"></div></div>'+
 '<div class="pad">'+
 sec0(t('account'),accRow)+
 sec0(t('prefs'),'<div class="card" style="padding:6px 16px">'+
 kv('var(--green-bg)','var(--green)','coins',t('country'),'<select class="selctl" aria-label="'+t('country')+'" onchange="if(this.value===\'__c\'){openCurSheet()}else setCur(this.value)">'+COUNTRIES.map(x=>'<option value="'+x[1]+'"'+(cur.cur===x[1]?' selected':'')+'>'+x[0]+' · '+x[1]+'</option>').join('')+(cName(cur.cur)?'':'<option value="'+esc(cur.cur)+'" selected>'+esc(cur.cur)+'</option>')+'<option value="__c">✎ '+t('curCustom')+'</option></select>')+
 '<div class="sep"></div>'+kv(darkOn()?'var(--navy-bg)':'var(--amber-bg)',darkOn()?'var(--navy)':'var(--amber)',darkOn()?'moon':'sun',t('theme'),'<div class="dmsw"><span class="soft" style="font-weight:800;font-size:12px;min-width:38px;text-align:center">'+(sec.darkAuto?t('darkAuto'):darkOn()?t('darkNight'):t('darkDay'))+'</span><div class="sw2 '+(sec.dark?'on':'')+'" role="switch" aria-checked="'+(sec.dark?'true':'false')+'" aria-label="'+t('theme')+'" onclick="sec.dark=!sec.dark;sec.darkAuto=false;saveSec();render()"></div><button class="autochip '+(sec.darkAuto?'on':'')+'" onclick="sec.darkAuto=!sec.darkAuto;saveSec();render()">'+t('darkAuto')+'</button></div>')+
'</div>')+
 sec0(t('sound'),'<div class="card" style="padding:6px 16px">'+
  kv(sec.sound?'var(--green-bg)':'var(--line2)',sec.sound?'var(--green)':'var(--muted)',sec.sound?'bell':'belloff',t('sound'),'<div class="sw2 '+(sec.sound?'on':'')+'" role="switch" aria-checked="'+(sec.sound?'true':'false')+'" aria-label="'+t('sound')+'" onclick="sec.sound=!sec.sound;saveSec();render()"></div>')+
 '<div class="sep"></div>'+
 kv(sec.vib?'var(--green-bg)':'var(--line2)',sec.vib?'var(--green)':'var(--muted)',sec.vib?'vibrate':'viboff',t('vib'),'<div class="sw2 '+(sec.vib?'on':'')+'" role="switch" aria-checked="'+(sec.vib?'true':'false')+'" aria-label="'+t('vib')+'" onclick="sec.vib=!sec.vib;saveSec();render()"></div>')+
 '</div>')+
 sec0(t('trashT'),'<div class="card" style="padding:6px 16px">'+kv('var(--red-bg)','var(--red)','trash',t('trashT'),'<span class="num" style="background:var(--red);color:#fff;border-radius:999px;font-size:10.5px;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:900">'+(DD().trash||[]).length+'</span> '+ic('fwd',16),'go(\'trash\',{})')+'</div>')+
  sec0(t('security'),'<div class="card" style="padding:6px 16px">'+
  kv(sec.enabled?'var(--green-bg)':'var(--line2)',sec.enabled?'var(--green)':'var(--muted)',sec.enabled?'lock':'unlock',t('pinLock'),'<span style="font-weight:800;color:'+st+'">'+t(sec.enabled?'on':'off')+'</span><button class="hbtn" aria-label="'+t('setPin')+'" onclick="askPin()">'+ic('shield',17)+'</button>')+
  (sec.enabled?
   '<div class="sep"></div>'+
   kv((sec.fps&&sec.fps.length)?'var(--green-bg)':'var(--line2)',(sec.fps&&sec.fps.length)?'var(--green)':'var(--muted)','fp',t('useFinger')+' ('+(sec.fps?sec.fps.length:0)+')','<button class="hbtn" onclick="addFp()" style="color:var(--navy)">'+t('fpAdd')+'</button>')+
   ((sec.fps&&sec.fps.length)?sec.fps.map((f,i)=>'<div class="sep"></div><div class="kv"><span class="kic" style="width:34px;height:34px;border-radius:10px;background:var(--navy-bg);color:var(--navy);display:flex;align-items:center;justify-content:center">'+ic('fp',16)+'</span><span class="k" style="margin-inline-start:8px">'+t('fpN')+' '+(i+1)+'</span><span class="v"><button class="hbtn" style="color:var(--red)" onclick="fpDel('+i+')">'+ic('x',15)+'</button></span></div>').join(''):'')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','clock',t('autoLock'),'<select class="inp" style="width:130px;padding:7px 10px" onchange="sec.autoMin=+this.value;saveSec()">'+[1,5,15,30,60].map(m=>'<option value="'+m+'"'+(sec.autoMin===m?' selected':'')+'>'+m+'</option>').join('')+'</select>')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','lock',t('lockNow'),ic('fwd',16),'locked=true;masterKey=null;pinBuf=\'\';stack=[{s:\'home\'}];render()')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','x',t('turnOffPin'),ic('fwd',16),'disableLock()')
  :'')+'</div>')+
 sec0(t('dataSec'),'<div class="card" style="padding:6px 16px">'+
  kv('var(--green-bg)','var(--green)','down',t('backupT'),ic('fwd',16),'Backup.download()')+
 '<div class="sep"></div>'+
 kv('var(--navy-bg)','var(--navy)','up',t('restoreT'),ic('fwd',16),'document.getElementById(\'bkFile\').click()')+
 '<input type="file" id="bkFile" accept=".json" style="display:none" onchange="Backup.pick(this)">'+
 '<div class="sep"></div>'+
 kv('var(--navy-bg)','var(--navy)','excel',t('exportAll'),ic('fwd',16),'exportAll()')+
  '<div class="sep"></div>'+
   '<div class="sep"></div>'+
  kv('var(--red-bg)','var(--red)','trash',t('reset'),ic('fwd',16),'reset()')+
 '</div>')+
 '<div class="card" style="margin-top:16px;padding:2px 16px">'+
 '<div class="kv" style="cursor:pointer" data-action="vosk.expand" role="button" tabindex="0"><span class="kic" style="background:'+(sec.vosk?'var(--green-bg)':'var(--line2)')+';color:'+(sec.vosk?'var(--green)':'var(--muted)')+'">'+ic('mic',17)+'</span><span class="k">'+t('voskOpt')+'</span><span class="v" style="font-weight:800;color:var(--soft)">'+(sec.vosk?t('on'):t('off'))+(ui.voskOpen?' ▾':'')+'</span></div>'+
 (ui.voskOpen?'<div class="sep"></div><div class="muted" style="padding:10px 2px;font-size:12px;line-height:1.9;white-space:pre-line">'+t('voskHelp')+'</div><div style="display:flex;gap:8px;margin:4px 0 12px"><button class="btn btn-line" style="flex:1" data-action="vosk.toggle">'+(sec.vosk?t('voskOff'):t('voskOn'))+'</button>'+(window.DaftariBridge?'<button class="btn btn-soft" style="flex:1" data-action="native.model.import">'+ic('excel',16)+t('impBtn')+'</button>':'')+'</div>':'')+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" data-action="speech.paste.open" role="button" tabindex="0"><span class="kic" style="background:var(--green-bg);color:var(--green)">'+ic('mic',17)+'</span><span class="k">'+t('extT')+'</span><span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+t('extGo')+'</span></div>'+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" data-action="native.project.import" role="button" tabindex="0"><span class="kic" style="background:var(--navy-bg);color:var(--navy)">'+ic('up',17)+'</span><span class="k">'+t('projPull')+'</span><span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+t('projGo')+'</span></div>'+
 '<div class="muted" style="text-align:center;font-size:11px;padding:10px 16px 0;line-height:1.9">'+t('locHint')+'</div>'+
 '<div class="muted" style="text-align:center;font-size:11px;padding:16px 0 6px">'+t('ver')+' <span class="num">'+__BUILD+'</span></div>'+
 '</div>'+
 '</div>';
};


/* ---- profile ---- */
function focusCard(key,o,c){const debt=key[0]==='d';const st=debt?invStatus(o):null;const rem=debt?invRem(o.id):0;
 return '<div class="pad" style="margin-top:12px"><div class="card" style="border:2px solid var(--navy);box-shadow:0 10px 24px rgba(13,31,58,.14);padding:14px 16px;animation:dockIn .25s ease both">'
 +'<div class="row"><span class="kic" style="background:'+(debt?'var(--red-bg);color:var(--red)':'var(--green-bg);color:var(--green)')+'">'+ic(debt?'receipt':'coins',19)+'</span><div class="sp"><div style="font-weight:800">'+(debt?t('invoice')+(o.code?' <span class="num">'+o.code+'</span>':''):t('pay'))+'</div><div class="muted" style="font-size:11.5px;margin-top:2px">'+ic('clock',11)+' '+dateStr(o.ts)+' · '+timeStr(o.ts)+(o.note?' · '+esc(o.note):'')+'</div></div>'+(debt?badge(st):'')+'<div class="amt '+(debt?(st==='paid'?'green':'red'):'green')+'" style="font-size:19px"><span class="num">'+fmt(o.amount)+'</span> '+CUR()+'</div></div>'
 +(debt?'<div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="chip" style="background:#efece6;color:var(--soft)">'+t('total')+': <span class="num">'+fmt(o.amount)+'</span></span><span class="chip" style="background:var(--green-bg);color:var(--green)">'+t('paidLbl')+': <span class="num">'+fmt(invPaid(o.id))+'</span></span><span class="chip" style="background:var(--red-bg);color:var(--red)">'+t('remaining')+': <span class="num">'+fmt(rem)+'</span></span></div>'
 :'<div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="chip" style="background:var(--green-bg);color:var(--green)">'+t('method')+': '+t(o.method||'cash')+'</span><span class="chip" style="background:#efece6;color:var(--soft)">'+((o.alloc&&o.alloc.length)||0)+' '+t('payLog')+'</span></div>')
 +'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-soft" style="flex:1" onclick="shareOne(\''+key+'\')">'+ic('share',16)+t('share')+'</button>'
 +(debt&&c&&c.phone&&rem>0?'<button class="btn btn-soft" style="flex:1;color:var(--green)" onclick="waRemind(\''+o.id+'\')">'+ic('wa',16)+t('waRemind')+'</button>':'')
 +(debt&&rem>0?'<button class="btn btn-green" style="flex:1" onclick="go(\'pay\',{cust:\''+c.id+'\'})">'+ic('coins',16)+t('payRemaining')+'</button>':'')
 +(debt?'<button class="btn btn-line" style="flex:1" onclick="openInvEdit(\''+o.id+'\')">'+ic('edit',16)+t('editL')+'</button>':'<button class="btn btn-line" style="flex:1" onclick="openPayDet(\''+o.id+'\')">'+ic('fwd',16)+t('opDet')+'</button>')
 +'</div></div></div>'}
function shareOne(key){const o=selFind(key);if(!o)return;const c=o.cust?cust(o.cust):null;
 const txt=curAcc().name+' — '+(c?c.name+' · ':'')+(key[0]==='d'?t('debt'):t('pay'))+' '+fmt(o.amount)+' '+CUR()+' · '+dateStr(o.ts)+(key[0]==='d'&&o.note?' · '+o.note:'')+(key[0]==='p'?' · '+t(o.method||'cash'):'');
 if(navigator.share){navigator.share({text:txt}).catch(()=>{})}else if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toastMsg(t('copied'))).catch(()=>toastMsg(t('copied')))}else toastMsg(t('copied'))}
function custFeed(id){const evs=[];
 DD().invoices.filter(i=>i.cust===id).forEach(i=>{evs.push({ts:i.ts,k:i.k==='open'?'open':'debt',amt:i.amount,id:i.id,code:i.code,note:i.note});(i.edits||[]).forEach(e=>evs.push({ts:e.ts,k:'edit',from:e.from,to:e.to,id:i.id,code:i.code,note:e.note}))});
 DD().payments.filter(pp=>pp.cust===id).forEach(pp=>evs.push({ts:pp.ts,k:'pay',amt:pp.amount,id:pp.id,alloc:pp.alloc}));
 evs.sort((a,b)=>b.ts-a.ts);return evs}
function cfRow(e,cid){const icn=e.k==='pay'?'coins':e.k==='edit'?'undo':e.k==='open'?'hist':'receipt';
 const col=e.k==='pay'?'var(--green)':e.k==='edit'?'var(--amber)':'var(--red)';
 const bg=e.k==='pay'?'var(--green-bg)':e.k==='edit'?'var(--amber-bg)':'var(--red-bg)';
 const lb=e.k==='pay'?t('pay'):e.k==='edit'?t('ret'):e.k==='open'?t('opening'):t('newDebt');
 const amt=e.k==='pay'?'+ <span class="num">'+fmt(e.amt)+'</span> '+CUR():e.k==='edit'?'<span class="num">'+fmt(e.from)+' \u2190 '+fmt(e.to)+'</span>':'- <span class="num">'+fmt(e.amt)+'</span> '+CUR();
 const oc=(e.k==='pay'||e.k==='debt'||e.k==='open')&&cid?'go(\'profile\',{id:\''+cid+'\',focus:\''+(e.k==='pay'?'p:':'d:')+e.id+'\'})':(e.k==='pay'?'openPayDet(\''+e.id+'\')':'go(\'invoice\',{id:\''+e.id+'\'})');
 return '<div class="card litem" onclick="'+oc+'"><span class="kic" style="background:'+bg+';color:'+col+'">'+ic(icn,17)+'</span><div class="sp"><div style="font-weight:800;font-size:14px">'+lb+(e.code?' \u00b7 <span class="num">'+e.code+'</span>':'')+'</div><div class="muted" style="font-size:11.5px;margin-top:3px">'+ic('clock',11)+' '+rel(e.ts)+' \u00b7 '+dateStr(e.ts)+(e.note?' \u00b7 '+esc(e.note):'')+'</div></div><div style="text-align:end"><span class="amt" style="color:'+col+'">'+amt+'</span></div></div>';}
function openPayDet(id){const p=DD().payments.find(x=>x.id===id);if(!p)return;
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('payDet')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<div class="muted" style="margin-bottom:10px">'+dateStr(p.ts)+' \u00b7 '+timeStr(p.ts)+' \u00b7 '+money(p.amount)+'</div>'
 +((p.alloc&&p.alloc.length)?p.alloc.map(a=>{const i=DD().invoices.find(x=>x.id===a.inv);return '<button class="srow" onclick="closeSheet();go(\'invoice\',{id:\''+a.inv+'\'})"><span class="sic2">'+ic('receipt',18)+'</span><span class="sp" style="text-align:start"><span class="t">'+(i?t('invoice')+' <span class="num">'+i.code+'</span>':t('invoice'))+'</span></span><span class="amt green">'+money(a.amt)+'</span></button>'}).join(''):'<div class="muted">'+t('noRes')+'</div>'))}
function openInvEdit(id){const i=DD().invoices.find(x=>x.id===id);if(!i)return;
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('invEditT')+' <span class="num">'+i.code+'</span></h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<label class="lb">'+t('debtAmt')+' ('+CUR()+')</label><input class="inp num" id="ieA" inputmode="decimal" value="'+fmt(i.amount)+'">'
 +'<label class="lb">'+t('remind')+' — '+t('optF')+'</label><input class="inp" id="ieN" value="'+esc(i.note||'')+'" placeholder="'+t('remindPh')+'">'
 +'<label class="lb">'+t('due')+' — '+t('optF')+'</label><input class="inp num" id="ieD" type="date" value="'+(i.due?new Date(i.due).toISOString().slice(0,10):'')+'">'
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1.4" onclick="saveInvEdit(\''+id+'\')">'+ic('save',17)+' '+t('saveC')+'</button></div>')}
async function saveInvEdit(id){const i=DD().invoices.find(x=>x.id===id);if(!i)return;const na=Money.parse(document.getElementById('ieA').value);
 if(na<=0){toastMsg(t('enterAmt'));return}
 const note=(document.getElementById('ieN').value||'').trim();const dv=document.getElementById('ieD').value;
 try{await LedgerEdits.commit(d=>{const target=d.invoices.find(x=>x.id===id);if(na!==target.amount){target.edits=target.edits||[];target.edits.push({ts:Date.now(),from:target.amount,to:na,note:t('editL')})}target.amount=na;target.note=note;target.due=dv?+new Date(dv+'T00:00:00'):null})}catch(e){storageFailure();return}
 closeSheet();render();toastMsg(t('savedC'))}
const S_profile=p=>{const c=cust(p.id);if(!c)return S_home();
 const invs=custInvoices(c.id);const evs=custFeed(c.id);
 return headerBar(t('custAcc'),null,'back()','openCustMenu(\''+c.id+'\')')
 +'<div class="pad"><div class="card" style="padding:17px"><div class="row"><span class="av" style="width:62px;height:62px;font-size:21px;padding:0;cursor:pointer;background:'+(c.photo?'none':avColor(c.name))+'" onclick="openPhotoSheet(\''+c.id+'\')" aria-label="'+t('photoT')+'">'+(c.photo?'<img src="'+c.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(initials(c.name)))+'</span><div class="sp"><div style="font-size:19px;font-weight:800">'+esc(c.name)+'</div>'+(c.phone?'<div class="muted" style="margin-top:3px">'+ic('phone',12)+' <span class="num">'+esc(c.phone)+'</span></div>':'')+'</div>'+(c.pinned?ic('pin',20):'')+'</div><div class="muted" style="margin-top:8px">'+t('since')(c.since)+'</div></div></div>'
 + (c.archived?'<div class="pad" style="margin-top:10px"><button class="btn btn-line" onclick="setCustomerArchived(\''+c.id+'\',false)">'+ic('undo',17)+t('restore')+'</button></div>':'')+
 '<div class="pad stats" style="margin-top:12px"><div class="stat red"><div class="t">'+t('remaining')+'</div><div class="v">'+money(custOpen(c.id))+'</div></div><div class="stat green"><div class="t">'+t('totalPaid')+'</div><div class="v">'+money(custPaid(c.id))+'</div></div></div>'
 +(p.focus&&selFind(p.focus)?focusCard(p.focus,selFind(p.focus),c):'')
 +'<div class="pad" style="margin:14px 20px 4px;font-weight:800;font-size:16.5px;display:flex;align-items:center;gap:8px">'+ic('hist',16)+' '+t('txAll')+' <span class="chip" style="background:#efece6;color:var(--soft)"><span class="num">'+evs.length+'</span></span></div>'
 +'<div class="pad list" id="pfeed" style="margin-top:6px;padding-bottom:4px">'+(evs.length?evs.map(x=>cfRow(x,c.id)).join(''):'<div class="muted" style="text-align:center;padding:22px 0">'+t('noOps')+'</div>')+'</div>'
 +'<div class="pad" style="margin:14px 20px 4px;font-weight:800;font-size:16.5px">'+ic('receipt',16)+' '+t('invoices')+'</div>'

 +'<div class="pad list" style="margin-top:14px;padding-bottom:8px">'+(invs.length?invs.map(invCard).join(''):'<div class="muted" style="text-align:center;padding:22px 0">'+t('noInv')+'</div>')+'</div>'
 +'<div class="bottombar">'+lpBtn('debt','btn-red','receipt',t('newDebt'))+lpBtn('pay','btn-green','coins',t('pay'))+'</div>';
};
function invCard(i){const st=invStatus(i),rem=invRem(i);
 return '<div class="card inv '+st+'" onclick="go(\'invoice\',{id:\''+i.id+'\'})"><div class="row"><span class="kic" style="background:'+(st==='paid'?'var(--green-bg);color:var(--green)':st==='part'?'var(--amber-bg);color:var(--amber)':'var(--red-bg);color:var(--red)')+'">'+(st==='paid'?ic('checkc',19):ic('receipt',19))+'</span><div class="sp"><div style="font-weight:800">'+t('invoice')+' <span class="num">'+i.code+'</span></div><div class="muted" style="margin-top:3px">'+ic('clock',12)+' '+rel(i.ts)+' · '+dateStr(i.ts)+' · '+timeStr(i.ts)+'</div>'+(i.note?'<div class="soft" style="font-size:13px;margin-top:5px;border-top:1px dashed var(--line);padding-top:5px">'+ic('tag',12)+' '+esc(i.note)+'</div>':'')+'</div><div style="text-align:end">'+badge(st)+'<div class="amt '+(st==='paid'?'green':'red')+'" style="margin-top:7px">'+money(st==='paid'?i.amount:rem)+'</div></div></div></div>';
}
const S_invoice=p=>{const i=DD().invoices.find(x=>x.id===p.id);if(!i)return S_home();const c=cust(i.cust),st=invStatus(i),paid=invPaid(i.id),rem=invRem(i);
 const pays=DD().payments.filter(x=>x.alloc.some(a=>a.inv===i.id)).sort((a,b)=>a.ts-b.ts);
 return headerBar(t('invoice')+' <span class="num">'+i.code+'</span>',null,'back()','openExport(\''+c.id+'\')')
 +'<div class="pad"><div class="card" style="padding:17px"><div class="row">'+(c?avat(c.name,50):'<span class="av" style="width:50px;height:50px;background:var(--red-bg);color:var(--red)">'+ic('receipt',20)+'</span>')+'<div class="sp"><div style="font-weight:800;font-size:16.5px">'+(c?esc(c.name):esc(i.note||t('expense')))+'</div><div class="muted" style="margin-top:3px">'+dateStr(i.ts)+' · '+timeStr(i.ts)+'</div></div>'+badge(st)+'</div>'
 +'<div class="stats" style="margin-top:15px;grid-template-columns:1fr 1fr 1fr"><div style="text-align:center"><div class="muted">'+t('total')+'</div><div class="amt" style="font-size:17px;margin-top:4px">'+money(i.amount)+'</div></div><div style="text-align:center;border-inline:1px solid var(--line2)"><div class="muted">'+t('paidLbl')+'</div><div class="amt green" style="font-size:17px;margin-top:4px">'+money(paid)+'</div></div><div style="text-align:center"><div class="muted">'+t('remaining')+'</div><div class="amt red" style="font-size:17px;margin-top:4px">'+money(rem)+'</div></div></div></div></div>'
 +'<div class="pad" style="margin-top:12px"><button class="btn" style="width:100%;background:var(--amber-bg);color:var(--amber)" onclick="openReturnSheet(\''+i.id+'\')">'+ic('undo',16)+t('retT')+'</button></div>'
 +((i.edits&&i.edits.length)?'<div class="pad" style="margin:14px 20px 7px;font-weight:800;color:var(--amber)">'+ic('edit',16)+' '+t('editsLog')+'</div><div class="pad" style="margin-top:0"><div class="card" style="padding:4px 16px">'+i.edits.slice().reverse().map(e=>'<div class="kv"><span class="kic" style="background:var(--amber-bg);color:var(--amber)">'+ic('undo',15)+'</span><div class="k">'+t('ret')+'<div class="muted" style="font-size:11px">'+dateStr(e.ts)+' · '+timeStr(e.ts)+(e.note?' · '+esc(e.note):'')+'</div></div><span class="v amt" style="color:var(--amber)">'+fmt(e.from)+' ← '+fmt(e.to)+'</span></div>').join('')+'</div></div>':'')
 +(i.due?'<div class="pad" style="margin-top:12px"><div class="card" style="padding:11px 16px;display:flex;align-items:center;gap:10px;border-color:'+(isOverdue(i)?'var(--red-line)':'var(--line2)')+'"><span style="width:36px;height:36px;border-radius:11px;background:'+(isOverdue(i)?'var(--red-bg);color:var(--red)':'var(--amber-bg);color:var(--amber)')+';display:flex;align-items:center;justify-content:center;flex:none">'+ic('cal',17)+'</span><div class="sp"><div class="muted" style="font-size:11.5px">'+t('due')+'</div><div style="font-weight:700">'+dateStr(i.due)+(isOverdue(i)?' · <b style="color:var(--red)">'+t('overdue')+'</b>':'')+'</div></div></div></div>':'')
 +(c&&c.phone&&rem>0?'<div class="pad" style="margin-top:12px"><button class="btn btn-green" onclick="waRemind(\''+i.id+'\')">'+ic('wa',18)+t('waRemind')+'</button></div>':'')
 +'<div class="pad" style="margin:16px 20px 7px;font-weight:800">'+ic('hist',16)+' '+t('payLog')+'</div>'
 +'<div class="pad"><div class="card" style="padding:4px 16px">'+(pays.length?pays.map((x,n)=>'<div class="kv"><span class="kic" style="background:var(--green-bg);color:var(--green)">'+ic('checkc',17)+'</span><span class="k">'+t('payOf')+' <span class="num">'+(n+1)+'</span><br><span style="font-size:11.5px">'+dateStr(x.ts)+' · '+timeStr(x.ts)+'</span></span><span class="v amt green">'+money(x.alloc.find(a=>a.inv===i.id).amt)+'</span></div>').join(''):'<div class="muted" style="text-align:center;padding:20px 0">'+t('noPay')+'</div>')+'</div></div>'
 +'<div class="bottombar" style="flex-direction:column">'+(rem>0?'<button class="btn btn-green" onclick="go(\'pay\',{cust:\''+c.id+'\'})">'+ic('coins',18)+t('payRemaining')+'</button>':'')+'<button class="btn btn-line" onclick="openExport(\''+c.id+'\')">'+ic('share',17)+t('shareReceipt')+'</button></div>';
};
