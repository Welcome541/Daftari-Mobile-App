/* =====================================================================
 * Daftari · 31-screen-customers.js
 * ---------------------------------------------------------------------
 * SCREEN: customers + archive
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_customers=()=>{
 if(isP())return '<div class="hdr"><div class="sp" style="text-align:start"><h1 class="bighdr">'+t('customers')+'</h1></div></div><div class="pad"><div class="card" style="padding:30px 22px;text-align:center"><span class="av" style="width:70px;height:70px;margin:0 auto;background:var(--green-bg);color:var(--green)">'+ic('user',30)+'</span><div style="font-weight:800;margin-top:12px;font-size:17px">'+t('personal')+'</div><div class="muted" style="margin-top:8px;line-height:1.8">'+t('personalMsg')+'</div>'+lpBtn('debt','btn-red','mic',t('recDebt')).slice(0,-10)+' style="margin-top:16px"></button></div></div>';
 if(ui.arch)return headerBar(t('archListT'),null,'ui.arch=false;render()')+'<div class="pad list ops" id="clist2" style="margin-top:12px;padding-bottom:14px">'+archListBody()+'</div>';
 /* The screen carries its own title, very large, on the leading
    edge; the add button takes the opposite corner. No shop icon, no
    shop name and no bell on this screen. */
 const arch=archBtn();
 return '<div class="hdr"><div class="sp" style="text-align:start"><h1 class="bighdr">'+t('customers')+'</h1></div>'
 +'<button class="btn btn-soft" style="width:auto;padding:10px 14px;font-size:13px;font-weight:800" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button></div>'
 +(arch?'<div class="pad" style="margin-top:2px;display:flex;align-items:center;gap:8px">'+arch+'</div>':'')
 +'<div class="pad search" style="margin-top:10px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('searchC')+'" value="'+esc(ui.cq)+'" oninput="ui.cq=this.value;ui.cmax=60;debList()"></div>'+custMenuBtn()+'</div>'
 +fChips()

 +'<div class="pad list ops" id="clist2" style="margin-top:12px;padding-bottom:14px">'+custListBody()+'</div>'
 /* the selection bar closes the list, right under the last customer */
 +((ui.csel&&ui.csel.on)?'<div class="pad" style="position:sticky;bottom:calc(80px + env(safe-area-inset-bottom) + 8px);z-index:28;background:var(--bg);padding:8px 0 12px">'+custSelBar()+'</div>':'');
};
function archCount(){return DD().customers.filter(c=>c.archived).length}
function archBtn(){const n=archCount();if(!n)return '';return '<button class="hbtn" style="height:42px;gap:6px" onclick="ui.arch=true;ui.archQ=\'\';render()" aria-label="'+t('archListT')+'">'+ic('archive',18)+'<span class="num" style="background:var(--amber);color:#fff;border-radius:999px;font-size:10.5px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:900">'+n+'</span></button>'}
function archListBody(){const q=normAr(ui.archQ||'');let list=DD().customers.filter(c=>c.archived);if(q)list=list.filter(c=>normAr(c.name).includes(q));
 return '<div class="inp card" style="margin-bottom:10px">'+ic('search',17)+'<input placeholder="'+t('searchC')+'" value="'+esc(ui.archQ||'')+'" oninput="ui.archQ=this.value;debList()"></div>'
 +(list.length?list.map(c=>'<div class="card litem" onclick="go(\'profile\',{id:\''+c.id+'\'})">'+avat(c.name,46,c.id)+'<div class="sp"><b>'+esc(c.name)+'</b><div class="muted">'+t('lastOp')+': '+lastOpTxt(lastAct(c.id))+'</div></div><button class="btn btn-soft" style="width:auto;padding:9px 14px;font-size:13px" onclick="event.stopPropagation();confirmRestore(\''+c.id+'\')">'+ic('undo',15)+t('restore')+'</button></div>').join(''):'<div class="muted" style="text-align:center;padding:28px 0">'+t('noArch')+'</div>')}
function custListBody(){const list=filteredCustomers(true);
 if(!list.length){
  const cs=DD().customers.filter(c=>!c.archived);
  if(!cs.length)return '<div class="card" style="padding:30px 22px;text-align:center"><span class="av" style="width:70px;height:70px;margin:0 auto;background:var(--navy-bg);color:var(--navy)">'+ic('users',30)+'</span><div style="font-weight:800;margin-top:12px;font-size:17px">'+t('noCustomers')+'</div><div class="muted" style="margin-top:8px;line-height:1.8">'+t('addFirstD')+'</div><button class="btn btn-navy" style="margin-top:14px" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button><button class="btn btn-line" style="margin-top:10px" onclick="openDemoSheet()">'+ic('zap',16)+t('demoLoad')+'</button><div class="muted" style="margin-top:18px">'+t('paperQ')+'</div><button class="btn btn-line" style="margin-top:8px" onclick="openPaper()">'+ic('cam',16)+t('paperGo')+'</button></div>';
  if((ui.cq||'').trim())return '<div class="card" style="padding:26px 20px;text-align:center"><div style="font-weight:800">'+t('noResC')(esc(ui.cq.trim()))+'</div><button class="btn btn-navy" style="margin-top:14px" onclick="ui.nc={name:ui.cq.trim(),phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addX')(esc(ui.cq.trim()))+'</button></div>';
  return '<div class="muted" style="text-align:center;padding:28px 0">'+t('noRes')+'</div>'}
 const max=ui.cmax||60,vis=list.slice(0,max);
 let h=vis.map(c=>custRow(c,true)).join('');
 if(list.length<6&&!(ui.cq||'').trim()&&cFCount()===0)h+='<div style="text-align:center;margin-top:16px"><button class="btn btn-line" style="width:auto;padding:10px 18px" onclick="ui.nc={name:\'\',phone:\'\',limit:\'\',photo:null,edit:null,forceDup:false};go(\'newcust\',{})">'+t('addCustBtn')+'</button></div>';
 return h}
