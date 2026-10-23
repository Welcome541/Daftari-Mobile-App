/* ---- new customer ---- */
const S_newcust=p=>{const ed=p&&p.edit?cust(p.edit):null;if(ed&&ui.nc.edit!==ed.id){ui.nc={name:ed.name,phone:ed.phone||'',photo:ed.photo||null,edit:ed.id}}
 const nm=ui.nc.name||'';
 return headerBar(ed?t('editC'):t('addC'),null,'back()')
 +'<div class="pad"><div class="card" style="padding:20px 17px;display:flex;flex-direction:column;align-items:center"><span class="av" style="width:92px;height:92px;font-size:28px;padding:0;cursor:pointer;background:'+(ui.nc.photo?'none':(nm?avColor(nm):'#d9d2c6'))+';color:'+(nm?'#fff':'var(--navy)')+'" onclick="openPhotoSheet(\'nc\')" aria-label="'+t('photoT')+'">'+(ui.nc.photo?'<img src="'+ui.nc.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':(nm?esc(initials(nm)):ic('user',32)))+'</span>'
 +'<div style="width:100%"><label class="lb">'+t('nameReq')+'</label><input class="inp" value="'+esc(nm)+'" oninput="ui.nc.name=this.value" placeholder="'+(db.lang==='ar'?'مثال: حسن القحطاني':'e.g. Hasan')+'">'
 +'<label class="lb">'+t('phone')+'</label><input class="inp num" value="'+esc(ui.nc.phone)+'" oninput="ui.nc.phone=this.value" inputmode="tel" placeholder="05x xxx xxxx">'

 +'<button class="btn btn-line" style="margin-top:13px" onclick="openContacts()">'+ic('contact',18)+t('fromContacts')+'</button>'
 +'<div class="muted" style="text-align:center;margin-top:13px">'+ic('lock',12)+' '+t('privacyC')+'</div></div></div></div>'
 +'<div class="bottombar"><button class="btn btn-navy" onclick="saveCustomer()">'+ic('save',18)+t('saveC')+'</button></div>';};
async function saveCustomer(){const nm=ui.nc.name.trim();if(!nm){toastMsg(t('nameReq'));return}
 if(!ui.nc.edit&&!ui.nc.forceDup){const dup=DD().customers.find(x=>!x.archived&&normAr(x.name)===normAr(nm));
  if(dup){openSheet('<h3>'+t('dupT')+'</h3><div class="card litem" style="margin-top:8px">'+avat(dup.name,42)+'<div class="sp"><b>'+esc(dup.name)+'</b>'+(dup.phone?'<div class="muted num">'+esc(dup.phone)+'</div>':'')+'<div class="muted">'+t('remaining')+': <b class="num">'+fmt(custOpen(dup.id))+'</b> '+CUR()+'</div></div></div><div class="muted" style="margin-top:10px">'+t('dupQ')+'</div><div class="row" style="gap:10px;margin-top:14px"><button class="btn btn-navy" style="flex:1.2" onclick="closeSheet();stack=[{s:\'profile\',p:{id:\''+dup.id+'\'}}];render()">'+t('dupOpen')+'</button><button class="btn btn-line" style="flex:1.2" onclick="closeSheet();ui.nc.forceDup=true;saveCustomer()">'+t('dupNew')+'</button></div>');return}}
 if(ui.nc.edit){const c=cust(ui.nc.edit);const form=LedgerSchema.clone(ui.nc);try{await LedgerEdits.commit(d=>{const target=d.customers.find(x=>x.id===c.id);target.name=nm;target.phone=form.phone.trim();if(form.photo!==undefined)target.photo=form.photo})}catch(e){storageFailure();return}toastMsg(t('savedC'));ui.nc={name:'',phone:'',limit:'',photo:null,edit:null};stack=[{s:'profile',p:{id:c.id}}];render();return}
 const c={id:uid(),name:nm,phone:ui.nc.phone.trim(),photo:ui.nc.photo||null,since:String(new Date().getFullYear()),archived:false,pinned:false};try{await LedgerEdits.commit(d=>d.customers.push(c))}catch(e){storageFailure();return}toastMsg(t('savedC'));ui.nc={name:'',phone:'',limit:'',photo:null,edit:null};if(ui.recPend&&ui.rec){ui.recPend=false;ui.rec.d.custId=c.id;ui.rec.d.name=c.name;ui.rec.cands=[];stack=[{s:'rec',p:{kind:ui.rec.kind}}];render();return}stack=[{s:'profile',p:{id:c.id}}];render();}

/* ================= sheets ================= */
function openPhotoSheet(target){const c=target==='nc'?null:cust(target);
 openSheet('<h3>'+t('photoT')+'</h3>'
 +'<button class="srow" onclick="pickPhoto(\''+target+'\')"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('cam',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('photoAdd')+'</span><span class="d">'+t('photoD')+'</span></span>'+ic('fwd',17)+'</button>'
 +((target==='nc'?ui.nc.photo:(c&&c.photo))?'<button class="srow" onclick="removePhoto(\''+target+'\')"><span class="sic2" style="background:var(--red-bg);color:var(--red)">'+ic('trash',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('photoDel')+'</span></span></button>':''))}
function openSheet(html){document.getElementById('sheet').innerHTML='<div class="grab"></div>'+html;document.getElementById('sheetWrap').classList.add('open');window.__prevFocus=document.activeElement;setTimeout(()=>{try{document.getElementById('sheet').focus()}catch(e){}},40)}
function closeSheet(){document.getElementById('sheetWrap').classList.remove('open');try{if(window.__prevFocus&&window.__prevFocus.focus)window.__prevFocus.focus()}catch(e){}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const sw=document.getElementById('sheetWrap');if(sw&&sw.classList.contains('open'))closeSheet()}});
document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const sw=document.getElementById('sheetWrap');if(!sw||!sw.classList.contains('open'))return;const sh=document.getElementById('sheet');const f=[...sh.querySelectorAll('button,select,input,[tabindex]')].filter(x=>!x.disabled);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});

function accRow(x){const ad=db.data[x.id]||{};const cn=(ad.customers||[]).filter(c=>!c.archived).length;
 return '<div class="srow" style="cursor:pointer" onclick="switchAcc(\''+x.id+'\')"><span class="sic2" style="background:'+(x.type==='grocery'?'var(--green-bg);color:var(--green)':'#eef1f5')+'">'+(x.type==='grocery'?ic('store',20):ic('user',20))+'</span><span class="sp" style="text-align:start"><span class="t">'+esc(x.name)+'</span><span class="d">'+(x.type==='grocery'?t('grocery'):t('personal'))+' · <span class="num">'+cn+'</span> '+t('customers')+' · '+x.cur+'</span></span>'+(x.id===db.active?ic('checkc',20):'')+'<button class="hbtn" style="min-width:36px;height:36px;border:none;box-shadow:none;background:transparent" onclick="event.stopPropagation();ui.accEdit=\''+x.id+'\';ui.accTy=\''+x.type+'\';renderAccSheet()">'+ic('edit',16)+'</button></div>'}
function openAccSheet(){ui.accEdit=null;ui.accTy='grocery';renderAccSheet();document.getElementById('sheetWrap').classList.add('open')}
function renderAccSheet(){
 let h='<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('accT')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>';
 if(!ui.accEdit){
  h+=db.accounts.filter(x=>x.type==='grocery'||x.id===db.active).map(accRow).join('');
  h+='<button class="btn btn-navy" style="margin-top:6px" onclick="ui.accEdit=\'new\';renderAccSheet()">'+ic('plus',17)+t('addAcc')+'</button>';
 }else{
  const e=ui.accEdit==='new'?{name:'',type:ui.accTy,cur:db.lang==='ar'?'\u0631.\u0633':'$'}:db.accounts.find(x=>x.id===ui.accEdit);
  h+='<div class="lb" style="margin-top:0">'+(ui.accEdit==='new'?t('addAcc'):t('editAcc'))+'</div>'
  +'<input class="inp" id="aeNm" value="'+esc(e.name)+'" placeholder="'+(db.lang==='ar'?'\u0645\u062b\u0627\u0644: \u0628\u0642\u0627\u0644\u0629 \u0627\u0644\u062d\u064a':'e.g. Main store')+'">'

  +'<select class="inp" id="aeCur" style="margin-top:10px">'+['\u0631.\u0633','$','\u20ac','\u00a3','\u062f.\u0625','\u20ba'].map(x=>'<option'+(e.cur===x?' selected':'')+'>'+x+'</option>').join('')+'</select>'
  +'<button class="btn btn-navy" style="margin-top:12px" onclick="saveAccEdit()">'+ic('save',17)+t('saveName')+'</button>'
  +'<button class="btn btn-soft" style="margin-top:8px" onclick="ui.accEdit=null;renderAccSheet()">'+ic('back',16)+t('cancel')+'</button>';
 }
 document.getElementById('sheet').innerHTML='<div class="grab"></div>'+h;}
function openCustMenu(id){const c=cust(id);
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('custOpts')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<button class="srow" onclick="closeSheet();ui.nc={name:\'\',phone:\'\',edit:\''+id+'\'};go(\'newcust\',{edit:\''+id+'\'})"><span class="sic2">'+ic('edit',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('editC')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();openExport(\''+id+'\')"><span class="sic2">'+ic('share',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('shareExp')+'</span><span class="d">'+t('shareExpD')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();confirmArchive(\''+id+'\')"><span class="sic2" style="color:var(--red)">'+ic('archive',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('archC')+'</span><span class="d" style="color:var(--red)">'+t('archD')+'</span></span></button>'
 +'<div class="muted" style="text-align:center;margin-top:8px">'+ic('shield',13)+' '+t('deletedKeep')+'</div>');}
function confirmArchive(id){const c=cust(id);const o=custOpen(id);
 openSheet('<h3>'+t('archConf')+'</h3><div style="font-weight:800;margin:6px 0">'+esc(c.name)+'</div>'
 +(o>0?'<div class="card" style="padding:12px 14px;background:var(--red-bg);color:var(--red);font-weight:800">'+t('archBal')(money(o))+'</div><div class="muted" style="margin-top:10px;line-height:1.8">'+t('archKeep')+'</div>':'<div class="muted" style="margin-top:6px;line-height:1.8">'+t('archZero')+'</div>')
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1" onclick="setCustomerArchived(\''+id+'\',true)">'+t('archGo')+'</button></div>')}
function confirmRestore(id){openSheet('<h3>'+t('restoreQ')+'</h3><div class="muted" style="margin-top:6px">'+t('restoreD')+'</div><div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1" onclick="setCustomerArchived(\''+id+'\',false)">'+t('restore')+'</button></div>')}
function openExport(id){const c=cust(id);
 openSheet('<h3>'+t('exportT')+' — '+esc(c.name)+'</h3>'
 +'<button class="srow" onclick="closeSheet();shareReceipt(\''+id+'\')"><span class="sic2">'+ic('share',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('stTxt')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();exportCSV(\''+id+'\')"><span class="sic2" style="color:var(--green)">'+ic('excel',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('stXls')+'</span></span></button>'
 +(c.phone?'<button class="srow" onclick="closeSheet();sendWA(\''+id+'\')"><span class="sic2" style="color:#1e8e5a">'+ic('wa',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('sendWa')+'</span></span></button><button class="srow" onclick="closeSheet();sendSMS(\''+id+'\')"><span class="sic2">'+ic('sms',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('sendSms')+'</span></span></button>':''));}
function openPaper(){openSheet('<h3>'+t('paperT')+'</h3><div class="muted" style="margin-bottom:8px">'+t('paperD')+'</div><div class="lb">'+t('paperDate')+'</div><input class="inp num" id="ppD" type="date" value="'+new Date().toISOString().slice(0,10)+'"><textarea class="inp" id="ppT" rows="6" style="margin-top:8px" placeholder="'+(db.lang==='ar'?'أبو خالد سبعين رز وحليب':'Abu Khaled seventy')+'"></textarea><button class="btn btn-navy" style="margin-top:10px" onclick="paperReview()">'+t('paperGo')+'</button><div id="ppR"></div>')}
function paperReview(){const txt=document.getElementById('ppT').value;const rows=txt.split('\n').map(x=>x.trim()).filter(Boolean);const drafts=rows.map(r=>{const pr=parseSay(r);return {say:r,name:pr.name||r,amt:pr.amt||0,note:pr.note||'',ok:!!(pr.name&&pr.amt>0)}});window.__pp=drafts;
 document.getElementById('ppR').innerHTML='<div style="margin-top:10px">'+drafts.map((d,i)=>'<div class="kv" style="padding:6px 0"><span class="kic" style="background:'+(d.ok?'var(--green-bg);color:var(--green)':'var(--amber-bg);color:var(--amber)')+'">'+(d.ok?'✓':'!')+'</span><span class="k">'+esc(d.name)+'<div class="muted" style="font-size:11px">'+esc(d.note)+'</div></span><span class="v amt">'+(d.ok?fmt(d.amt):t('needsRev'))+'</span></div>').join('')+'</div><button class="btn btn-green" style="margin-top:10px" onclick="paperCommit()">'+t('importGo')+'</button>'}
async function paperCommit(){const ds=(window.__pp||[]).filter(d=>d.ok);const dv=document.getElementById('ppD').value;const ts=dv?new Date(dv+'T12:00:00').getTime():Date.now();try{await LedgerEdits.commit(draftData=>{ds.forEach(d=>{let c=draftData.customers.find(x=>x.name===d.name&&!x.archived);if(!c){c={id:uid(),name:d.name,phone:'',since:String(new Date(ts).getFullYear()),archived:false,pinned:false};draftData.customers.push(c)}draftData.invoices.push({id:uid(),code:'P'+(draftData.seq++),cust:c.id,ts,amount:d.amt,note:d.note,src:'paper'})})})}catch(e){storageFailure();return}closeSheet();render();toastMsg('✓ '+ds.length)}
function openImport(){openSheet('<h3>'+t('importT')+'</h3><div class="muted" style="margin-bottom:10px">'+t('importD')+'</div><textarea class="inp" id="impTxt" rows="7" placeholder="'+(db.lang==='ar'?'أبو خالد، 50، رز وحليب\\nسارة أحمد، 120، سكر وشاي':'Abu Khaled, 50, rice & milk')+'"></textarea><input type="file" accept=".txt,.csv,.xls,.xlsx" style="margin-top:10px" onchange="readImp(this)"><button class="btn btn-soft" style="margin-top:10px" onclick="ocrPick()">'+ic('cam',17)+t('ocrBtn')+'</button><button class="btn btn-soft" style="margin-top:10px" onclick="openPaper()">'+ic('mic',17)+t('paperT')+'</button><button class="btn btn-navy" style="margin-top:12px" onclick="doImport()">'+ic('up',17)+t('importGo')+'</button>')}
window.readImp=inp=>{const f=inp.files[0];if(!f)return;
 if(/\.xlsx?$/i.test(f.name)&&typeof XLSX==='undefined'){busy(1);libLoad('lib/xlsx.full.min.js').then(()=>{busy(0);window.readImp(inp)}).catch(()=>{busy(0);toastMsg(t('xlNo'))});return}
 if(/\.xlsx?$/i.test(f.name)){const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(new Uint8Array(r.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];importRows(XLSX.utils.sheet_to_json(ws,{header:1}))}catch(e){toastMsg(t('btFail'))}};r.readAsArrayBuffer(f);return}
 const r=new FileReader();r.onload=()=>{document.getElementById('impTxt').value=r.result};r.readAsText(f)};
async function importRows(rows){const accountId=db.active;const snap=JSON.stringify(DD());let n=0;
 try{await LedgerEdits.commit(draftData=>{
 (rows||[]).forEach(r=>{if(!Array.isArray(r))return;const cells=r.map(x=>x==null?'':String(x).trim()).filter(x=>x!=='');if(cells.length<2)return;
  let nm=null,amt=null,ph='',nt=[];
  cells.forEach(c=>{if(ph===''&&/^[+0-9][0-9\s-]{8,}$/.test(c)){ph=c;return}
   if(amt===null&&/^[\d.,،\s]+$/.test(c)&&c.replace(/\D/g,'').length>0&&c.replace(/\D/g,'').length<=7){amt=Money.parse(c);return}
   if(!nm){nm=c;return}nt.push(c)});
  if(!nm||amt===null||isNaN(amt)||amt<=0)return;
  let c=draftData.customers.find(x=>x.name===nm&&!x.archived);if(!c){c={id:uid(),name:nm,phone:ph,since:String(new Date().getFullYear()),archived:false,pinned:false};draftData.customers.push(c)}
  draftData.invoices.push({id:uid(),code:'A'+(draftData.seq++),cust:c.id,ts:Date.now(),amount:amt,note:nt.join(' ')});n++});
 if(!n)throw new Error('no-import-rows');
 })}catch(e){if(e.message==='no-import-rows')toastMsg(t('noRes'));else storageFailure();return 0}
 const committed=JSON.stringify(db.data[accountId]);closeSheet();render();
 toastMsg(t('imported')(n),async()=>{try{await LedgerEdits.commit((_,draft)=>{if(JSON.stringify(draft.data[accountId])!==committed)throw new Error('data-changed');draft.data[accountId]=JSON.parse(snap)});render()}catch(e){storageFailure()}});return n}

function doImport(){const txt=document.getElementById('impTxt').value;
 importRows(txt.split(/\n+/).map(l=>l.split(/[,،;\t]+/)))}
function recNewCust(){ui.nc={name:(ui.rec&&ui.rec.d.name)||'',phone:'',photo:null,edit:null};ui.recPend=true;go('newcust',{})}
function openCurSheet(){openSheet('<h3>'+t('curCustom')+'</h3><input class="inp" id="curIn" value="'+esc(curAcc().cur)+'" maxlength="12"><button class="btn btn-navy" style="margin-top:12px" onclick="saveCur()">'+ic('checkc',16)+t('saveName')+'</button>')}
window.reset=async()=>{if(!confirm(t('resetQ')))return;await Backup.restore(seed(),true)};
function openContacts(){
 if(window.DaftariBridge){NativeActions.pickContact();return}
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('contactsT')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="padding:16px 13px"><div class="row" style="color:var(--soft)">'+ic('shield',17)+'<span style="font-size:12.5px">'+t('contactsAppOnly')+'</span></div></div></div>')
}
function openCustPicker(){openSheet('<h3>'+t('chooseC')+'</h3>'+DD().customers.filter(c=>!c.archived).map(c=>'<button class="srow" onclick="ui.pay.cust=\''+c.id+'\';ui.pay.amt=\'\';closeSheet();render()">'+avat(c.name,42)+'<span class="sp" style="text-align:start"><span class="t">'+esc(c.name)+'</span><span class="d">'+t('remaining')+': '+money(custOpen(c.id))+'</span></span>'+(custOpen(c.id)>0?'<span class="amt red">'+money(custOpen(c.id))+'</span>':'')+'</button>').join(''))}

/* ================= long-press quick actions ================= */
let lpT=null;
function openQuick(id){const c=cust(id);if(!c)return;const open=custOpen(id);
 openSheet('<div class="row" style="margin-bottom:12px">'+avat(c.name,46)+'<div class="sp"><div style="font-weight:800">'+esc(c.name)+'</div><div class="muted">'+t('remaining')+': <b class="num">'+fmt(open)+'</b> '+CUR()+'</div></div><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<button class="srow" onclick="closeSheet();startRec(\'debt\',\''+id+'\')"><span class="sic2" style="background:var(--red-bg);color:var(--red)">'+ic('mic',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('recDebt')+'</span><span class="d">'+t('voiceHint').split('.')[0]+'</span></span>'+ic('fwd',17)+'</button>'
 +'<button class="srow" onclick="quickPay(\''+id+'\')"><span class="sic2" style="background:var(--green-bg);color:var(--green)">'+ic('coins',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('quickPay')+'</span></span>'+ic('fwd',17)+'</button>'
 +'<div class="row" style="gap:10px;margin:2px 0 10px"><button class="btn btn-soft" style="flex:1" onclick="togglePin(\''+id+'\')">'+ic('pin',16)+(c.pinned?t('unpinU'):t('pinU'))+'</button><button class="btn btn-soft" style="flex:1" onclick="closeSheet();openOpeningSheet(\''+id+'\')">'+ic('hist',16)+t('opening')+'</button>'+(c.phone?'<button class="btn btn-soft" style="flex:1" onclick="window.open(\'tel:'+(c.phone||'').replace(/[^0-9+]/g,'')+'\')">'+ic('phone',16)+t('callC')+'</button>':'')+'</div>'
 +'<button class="srow" onclick="closeSheet();go(\'profile\',{id:\''+id+'\'})"><span class="sic2">'+ic('user',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('openAcc2')+'</span></span>'+ic('fwd',17)+'</button>');}
function openFabSheet(){if(isP()){openSheet('<h3>'+t('addQ')+'</h3><button class="srow" onclick="closeSheet();startRec(\'debt\')"><span class="sic2" style="background:var(--red-bg);color:var(--red)">'+ic('mic',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('recDebt')+'</span></span>'+ic('fwd',17)+'</button><button class="srow" onclick="closeSheet();openDebtSheet()"><span class="sic2" style="background:var(--red-bg);color:var(--red)">'+ic('receipt',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('manualDebt')+'</span></span>'+ic('fwd',17)+'</button><button class="srow" onclick="closeSheet();ui.pay={cust:null,amt:\'\',method:\'cash\',done:null};go(\'pay\',{})"><span class="sic2" style="background:var(--green-bg);color:var(--green)">'+ic('coins',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('recPay')+'</span></span>'+ic('fwd',17)+'</button>');return}
 openSheet('<h3>'+t('addC')+'</h3>'
 +'<button class="srow" onclick="closeSheet();ui.nc={name:\'\',phone:\'\',photo:null,edit:null};go(\'newcust\',{})"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('userplus',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('manualC')+'</span><span class="d">'+t('manualCd')+'</span></span>'+ic('fwd',17)+'</button>'
 +'<button class="srow" onclick="closeSheet();openContacts()"><span class="sic2" style="background:var(--green-bg);color:var(--green)">'+ic('contact',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('fromContacts')+'</span><span class="d">'+t('contactsD')+'</span></span>'+ic('fwd',17)+'</button>');}
function quickPay(id){ui.qpM=ui.qpM||'cash';openSheet('<h3>'+t('quickPay')+' — '+esc(cust(id).name)+'</h3><input class="inp num" id="qp_a" type="number" inputmode="decimal" placeholder="0.00"><div class="seg" style="margin-top:10px">'+['cash','transfer','cardpay'].map(m=>'<button class="'+(ui.qpM===m?'on':'')+'" onclick="ui.qpM=\''+m+'\';quickPay(\''+id+'\')">'+t(m)+'</button>').join('')+'</div><button class="btn btn-green" style="margin-top:12px" onclick="quickPaySave(\''+id+'\')">'+ic('checkc',18)+t('confirmPay')+'</button>')}
async function quickPaySave(id){const amt=Money.parse(document.getElementById('qp_a').value);if(amt<=0){toastMsg(t('enterAmt'));return}
 const openI=custInvoices(id).filter(i=>invRem(i)>0&&!i.k).sort((x,y)=>x.ts-y.ts);let left=amt;const alloc=[];openI.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});
 try{await LedgerEdits.insert('payments',{id:uid(),cust:id,ts:Date.now(),amount:amt,method:ui.qpM||'cash',alloc})}catch(e){storageFailure();return}feedback('pay');closeSheet();render();toastMsg('<b>'+t('payDone')+'</b> · '+money(amt));}
/* ================= exports / share ================= */
function statementText(id){const c=cust(id);const L=[curAcc().name+' — '+t('printTitle'),t('cust')+': '+c.name+(c.phone?' ('+c.phone+')':''),t('remaining')+': '+fmt(custOpen(id))+' '+CUR()+' | '+t('totalPaid')+': '+fmt(custPaid(id))+' '+CUR(),'— '+t('invoices')+' —'];
 custInvoices(id).forEach(i=>L.push(i.code+' | '+new Date(i.ts).toLocaleDateString('en-GB')+' | '+fmt(i.amount)+(i.edits&&i.edits.length?' ('+t('edited')+' '+new Date(i.edits[i.edits.length-1].ts).toLocaleDateString('en-GB')+')':'')+' | '+STLBL[invStatus(i)]()+(i.note?' | '+i.note:'')));
 L.push('— '+t('payLog')+' —');DD().payments.filter(p=>p.cust===id).forEach(p=>L.push(new Date(p.ts).toLocaleDateString('en-GB')+' | '+fmt(p.amount)+' | '+t(p.method)));return L.join('\n')}
function shareReceipt(id){const txt=statementText(id);if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toastMsg(t('copied'))).catch(()=>toastMsg(t('copied')));else toastMsg(t('copied'))}
function sendWA(id){const c=cust(id);const msg=encodeURIComponent((db.lang==='ar'?'السلام عليكم '+c.name+'، لديكم مبلغ ':'Hello '+c.name+', outstanding balance: ')+fmt(custOpen(id))+' '+CUR()+' — '+curAcc().name);window.open('https://wa.me/'+(c.phone||'').replace(/\D/g,'')+'?text='+msg,'_blank')}
function sendSMS(id){const c=cust(id);const msg=encodeURIComponent((db.lang==='ar'?'تذكير: المتبقي ':'Reminder: ')+fmt(custOpen(id))+' '+CUR()+' — '+curAcc().name);window.open('sms:+'+(c.phone||'').replace(/\D/g,'')+'?body='+msg,'_blank')}
function dl(name,content,mime){let href;try{href=URL.createObjectURL(new Blob([content],{type:mime}))}catch(e){href='data:'+mime+';charset=utf-8,'+encodeURIComponent(content)}const a=document.createElement('a');a.href=href;a.download=name;a.click()}
function exportCSV(id){const c=cust(id);let rows='﻿Type,Date,Customer,Amount,Note\n';custInvoices(id).forEach(i=>rows+='Debt,'+new Date(i.ts).toISOString().slice(0,10)+','+c.name+','+i.amount+',"'+(i.note||'').replace(/"/g,'')+'"\n');DD().payments.filter(p=>p.cust===id).forEach(p=>rows+='Payment,'+new Date(p.ts).toISOString().slice(0,10)+','+c.name+','+p.amount+','+p.method+'\n');dl('statement-'+c.name+'.csv',rows,'text/csv')}
const csvC=v=>{v=String(v==null?'':v).replace(/"/g,'""');return /^[=+\-@]/.test(v)?"'"+v:v};
function exportAll(){let rows='﻿Type,Date,Customer,Code,Amount,Note\n';DD().invoices.forEach(i=>rows+='Debt,'+new Date(i.ts).toISOString().slice(0,10)+','+csvC((cust(i.cust)||{}).name)+','+csvC(i.code)+','+Money.dec(i.amount)+',"'+csvC(i.note||'')+'"\n');DD().payments.forEach(p=>rows+='Payment,'+new Date(p.ts).toISOString().slice(0,10)+','+csvC((cust(p.cust)||{}).name)+',,'+Money.dec(p.amount)+','+csvC(p.method)+'\n');dl('dafter-data.csv',rows,'text/csv');toastMsg('CSV ✓')}
function exportPDF(id){const c=cust(id);document.getElementById('printArea').innerHTML='<div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #12294a;padding-bottom:10px;margin-bottom:12px"><div style="width:52px;height:52px;border-radius:14px;background:#0d1f3a;color:#e8c76a;display:flex;align-items:center;justify-content:center">'+ic('book',26)+'</div><div><div style="font-size:20px;font-weight:900;color:#12294a">'+esc(curAcc().name)+'</div><div style="color:#667;font-size:12px">دَفتَري Daftari · '+t('printTitle')+' · '+new Date().toLocaleDateString('en-GB')+'</div></div></div><div>'+t('cust')+': <b>'+esc(c.name)+'</b>'+(c.phone?' · <span dir="ltr">'+esc(c.phone)+'</span>':'')+'</div><div>'+t('remaining')+': <b>'+fmt(custOpen(id))+' '+CUR()+'</b> · '+t('totalPaid')+': '+fmt(custPaid(id))+' '+CUR()+'</div><table><tr><th>'+t('invoice')+'</th><th>Date</th><th>'+t('remind')+'</th><th>'+t('total')+'</th><th>'+t('paidLbl')+'</th><th>'+t('remaining')+'</th></tr>'+custInvoices(id).map(i=>'<tr><td>'+i.code+'</td><td>'+new Date(i.ts).toLocaleDateString('en-GB')+'</td><td>'+esc(i.note||'')+'</td><td>'+fmt(i.amount)+'</td><td>'+fmt(invPaid(i.id))+'</td><td>'+fmt(invRem(i))+'</td></tr>').join('')+'</table>';try{window.print()}catch(e){toastMsg('PDF')}}

/* ================= lock / security UI ================= */
let pinBuf='';
const S_lock=()=>'<div class="padlock"><div class="logo-ic" style="width:64px;height:64px;border-radius:20px">'+ic('book',30)+'</div><h1 style="margin-top:14px">دَفتَري</h1><div class="muted" style="margin-top:6px">'+t('enterPin')+'</div><div class="pdots" id="pdots">'+[0,1,2,3].map(()=>'<i></i>').join('')+'</div>'
 +((sec.fps&&sec.fps.length)?'<button class="btn btn-line" style="width:auto;margin-top:18px;padding:10px 22px" onclick="fpUnlock()">'+ic('fp',18)+t('fpUse')+'</button>':'')
 +'<div class="kp">'+['1','2','3','4','5','6','7','8','9'].map(d=>'<button onclick="pinTap(\''+d+'\')">'+d+'</button>').join('')+'<button onclick="pinTap(\'x\')">'+ic('back',20)+'</button><button onclick="pinTap(\'0\')">0</button><button onclick="pinTap(\'c\')">'+ic('x',18)+'</button>'+'</div><button class="btn btn-line" onclick="Recovery.show()">استعادة الدفتر / Recovery</button></div>';
function pinTap(d){if(d==='c')pinBuf='';else if(d==='x')pinBuf=pinBuf.slice(0,-1);else if(pinBuf.length<4)pinBuf+=d;
 const dots=document.querySelectorAll('#pdots i');dots.forEach((el,i)=>el.classList.toggle('f',i<pinBuf.length));
 if(pinBuf.length===4)verifyPin(pinBuf);}
async function verifyPin(pin){if(Date.now()<(sec.lockUntil||0)){toastMsg('⏳ '+Math.ceil((sec.lockUntil-Date.now())/1000)+'s');return}
 const h=await sha256hex(sec.salt+pin);
 if(h!==sec.pinHash){sec.failN=(sec.failN||0)+1;if(sec.failN>=5){sec.lockUntil=Date.now()+30000;sec.failN=0;saveSec()}toastMsg(t('wrongPin'));pinBuf='';setTimeout(()=>{const d2=document.querySelectorAll('#pdots i');d2.forEach(el=>el.classList.remove('f'))},300);return}
 const pk=await deriveKey(pin,sec.salt);const mk=await unwrapKey(sec.masterWrapPin,pk);if(!mk){toastMsg(t('wrongPin'));return}
 masterKey=mk;locked=false;pinBuf='';sec.failN=0;saveSec();
 if(window.__afterUnlock){await window.__afterUnlock()}else{stack=[{s:'home'}];render()}}
async function askPin(){const pin=prompt(db.lang==='ar'?'رمز جديد (4 أرقام):':'New PIN (4 digits):');if(!pin||!/^\d{4}$/.test(pin))return;
 try{const next=LedgerSchema.clone(sec);next.salt=uid()+uid();next.pinHash=await sha256hex(next.salt+pin);
 if(!masterKey){next.fps=[];next.credId=null;next.fpWrap=null}
 const key=masterKey||await newMaster();const pk=await deriveKey(pin,next.salt);next.masterWrapPin=await wrapKey(key,pk);next.enabled=true;
 await commitSecurity(next,key);toastMsg('🔒 ✓');render()}catch(e){storageFailure()}}
async function disableLock(){try{const next=LedgerSchema.clone(sec);next.enabled=false;await commitSecurity(next,null);render()}catch(e){storageFailure()}}
async function fpDel(i){try{const next=LedgerSchema.clone(sec);next.fps.splice(i,1);if(!next.fps.length){next.credId=null;next.fpWrap=null}await commitSecurity(next,masterKey);render()}catch(e){storageFailure()}}
let fingerprintBusy=false;
function usableFingerprint(f){return f&&typeof f.id==='string'&&/^(?:[0-9a-f]{2})+$/.test(f.id)&&Array.isArray(f.prfInput)&&f.prfInput.length===32&&f.prfInput.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&f.wrap}
function fingerprintBytes(hex){return new Uint8Array(hex.match(/../g).map(h=>parseInt(h,16)))}
async function addFp(){if(fingerprintBusy)return;fingerprintBusy=true;
 try{if(locked||!sec.enabled||!masterKey||!window.PublicKeyCredential||!navigator.credentials)throw new Error('unavailable');
 if((sec.fps||[]).length>=5){toastMsg('🖐 5');return}
 const key=masterKey,configuration=JSON.stringify(sec),first=crypto.getRandomValues(new Uint8Array(32));
 const cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Daftari Next'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'owner',displayName:'Daftari owner'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},extensions:{prf:{eval:{first}}}}});
 const prf=cred&&cred.getClientExtensionResults().prf;if(!prf||!prf.results||!prf.results.first)throw new Error('prf-unavailable');
 const material=new Uint8Array(prf.results.first);if(material.length!==32)throw new Error('invalid-prf');
 const fk=await crypto.subtle.importKey('raw',material,{name:'AES-GCM'},false,['encrypt','decrypt']);
 const hex=[...new Uint8Array(cred.rawId)].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(locked||masterKey!==key||JSON.stringify(sec)!==configuration)throw new Error('stale-enrollment');
 const next=LedgerSchema.clone(sec);next.fps=next.fps||[];if(!hex||next.fps.some(f=>f.id===hex))throw new Error('duplicate-credential');
 next.fps.push({id:hex,prfInput:[...first],wrap:await wrapKey(key,fk)});next.credId=hex;next.fpWrap=null;
 await commitSecurity(next,key);toastMsg('✓');render();
 }catch(e){toastMsg(t('fpNo'))}finally{fingerprintBusy=false}}
async function fpUnlock(){if(fingerprintBusy||!locked||Date.now()<(sec.lockUntil||0))return;fingerprintBusy=true;
 try{const configuration=JSON.stringify(sec),entries=(sec.fps||[]).filter(usableFingerprint);if(!entries.length)throw new Error('reenroll-required');
 const evalByCredential={};for(const f of entries){const id=btoa(String.fromCharCode(...fingerprintBytes(f.id))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');evalByCredential[id]={first:new Uint8Array(f.prfInput)}}
 const cred=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),userVerification:'required',allowCredentials:entries.map(f=>({type:'public-key',id:fingerprintBytes(f.id)})),extensions:{prf:{evalByCredential}}}});
 if(!locked||JSON.stringify(sec)!==configuration)throw new Error('stale-unlock');
 const used=[...new Uint8Array(cred.rawId)].map(b=>b.toString(16).padStart(2,'0')).join('');const entry=entries.find(f=>f.id===used);if(!entry)throw new Error('unknown-credential');
 const prf=cred.getClientExtensionResults().prf;if(!prf||!prf.results||!prf.results.first)throw new Error('prf-unavailable');const material=new Uint8Array(prf.results.first);if(material.length!==32)throw new Error('invalid-prf');
 const fk=await crypto.subtle.importKey('raw',material,{name:'AES-GCM'},false,['encrypt','decrypt']);const key=await unwrapKey(entry.wrap,fk);if(!key)throw new Error('invalid-wrap');
 if(!locked||JSON.stringify(sec)!==configuration)throw new Error('stale-unlock');masterKey=key;locked=false;sec.failN=0;sec.lockUntil=0;saveSec();lastTouch=Date.now();
 if(window.__afterUnlock)await window.__afterUnlock();else{stack=[{s:'home'}];render()}
 }catch(e){toastMsg(t('fpNo'))}finally{fingerprintBusy=false}}
/* auto-lock */
let lastTouch=Date.now();
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>lastTouch=Date.now(),{passive:true}));
setInterval(()=>{if(sec.enabled&&!locked&&!Backup.busy&&!Store.cryptoBusy&&!LedgerEdits.busy&&Date.now()-lastTouch>sec.autoMin*60000){locked=true;masterKey=null;pinBuf='';stack=[{s:'home'}];render()}},5000);

/* ================= toast ================= */
let toastTimer=null,undoAct=null;
function toastMsg(html,fn,shareId,dur){undoAct=fn||null;const el=document.getElementById('toast');el.innerHTML='<span style="flex:1;line-height:1.5">'+html+'</span>'+(shareId?'<button class="tb" style="border-color:#9fd0ff;color:#9fd0ff;padding:7px 10px" aria-label="'+t('shareLbl')+'" onclick="hideToast();shareReceipt(\''+shareId+'\')">'+ic('share',14)+'</button>':'')+(fn?'<button class="tb" onclick="doUndoAct()">'+ic('undo',14)+t('undo')+'</button>':'');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),dur||3000)}
function hideToast(){clearTimeout(toastTimer);document.getElementById('toast').classList.remove('show');undoAct=null}
function doneSnack(kind,id,cid,amt){const accountId=db.active;toastMsg('<b>'+(kind==='debt'?t('debtDone'):t('payDone'))+'</b> · '+money(amt)+'<br><span style="font-size:11.5px;opacity:.8">'+t('undoAvail')+'</span>',async()=>{try{await LedgerEdits.commit((_,draft)=>{const d=draft.data[accountId];if(!d)throw new Error('missing-account');if(kind==='debt'){if(d.payments.some(p=>(p.alloc||[]).some(a=>a.inv===id)))throw new Error('invoice-has-payments');d.invoices=d.invoices.filter(x=>x.id!==id)}else{d.payments=d.payments.filter(x=>x.id!==id)}});render()}catch(e){storageFailure()}},kind==='debt'&&cid?id:null,3000)}
function doUndoAct(){if(undoAct){try{undoAct()}catch(e){}undoAct=null}document.getElementById('toast').classList.remove('show')}

/* ================= misc ================= */
const COUNTRIES=[['السعودية','ر.س'],['العراق','د.ع'],['مصر','ج.م'],['اليمن','ر.ي'],['الإمارات','د.إ'],['سوريا','ل.س']];
const cName=c=>(COUNTRIES.find(x=>x[1]===c)||[])[0]||null;
function darkOn(){if(sec&&sec.darkAuto){try{if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)return true}catch(e){}const h=new Date().getHours();return h>=18||h<6}return !!(sec&&sec.dark)}
function applyLang(){document.documentElement.lang=db.lang;document.documentElement.dir=db.lang==='ar'?'rtl':'ltr';document.body.lang=db.lang;document.title=db.lang==='ar'?'دَفتَري':'Daftari';document.body.classList.toggle('dark',darkOn());document.body.classList.toggle('priv',!!(sec&&sec.priv))}
window.addEventListener('online',()=>render());window.addEventListener('offline',()=>render());
try{if(window.matchMedia){const mq=matchMedia('(prefers-color-scheme: dark)');(mq.addEventListener?mq.addEventListener('change',()=>render()):mq.addListener(()=>render()))}}catch(e){}

/* ================= pull to refresh ================= */
let ptrY=null;
document.getElementById('phone').addEventListener('touchstart',e=>{if(window.scrollY<=2&&curScr().s==='home')ptrY=e.touches[0].clientY},{passive:true});
document.getElementById('phone').addEventListener('touchmove',e=>{if(ptrY===null)return;const dy=e.touches[0].clientY-ptrY;const el=document.getElementById('ptr');document.getElementById('ptrT').textContent=t('pull');el.classList.toggle('on',dy>70)},{passive:true});
document.getElementById('phone').addEventListener('touchend',()=>{const el=document.getElementById('ptr');if(el.classList.contains('on')){document.getElementById('ptrT').textContent=t('refreshed');setTimeout(()=>el.classList.remove('on'),700);render()}ptrY=null;setTimeout(()=>el.classList.remove('on'),900)},{passive:true});
/* fab hide on scroll */
let lastY=0;
window.addEventListener('load',()=>{try{if((curScr()||{}).s==='reports')drawCharts()}catch(e){}});
window.addEventListener('scroll',()=>{const f=document.getElementById('fabAdd');const y=window.scrollY;if(y>lastY+6)f.classList.add('hid');else if(y<lastY-6)f.classList.remove('hid');lastY=y},{passive:true});

/* ================= render ================= */
const S_trash=p=>{const list=(DD().trash||[]).slice().sort((a,b)=>b.ts-a.ts);
 return headerBar(t('trashT'),null,"stack=[{s:'settings'}];render()")
 +'<div class="pad list" style="margin-top:10px;padding-bottom:10px">'+(list.length?list.map(e=>{const o=e.o;const c=o.cust?cust(o.cust):null;
  const cc=e.k==='c'?e.o:c;
  return '<div class="card litem">'+(cc?avat(cc.name,44):'<span class="av" style="width:44px;height:44px;background:'+(e.k==='d'?'var(--red-bg);color:var(--red)':'var(--green-bg);color:var(--green)')+'">'+ic(e.k==='d'?'receipt':'banknote',18)+'</span>')+'<div class="sp"><b>'+esc(cc?cc.name:t(e.k==='d'?'debt':'pay'))+'</b>'+(e.k==='c'?'<div class="muted" style="font-size:11.5px;margin-top:2px">'+t('cust')+' · '+dateStr(e.ts)+'</div>':'<div class="muted" style="font-size:11.5px;margin-top:2px">'+(e.k==='d'?ic('receipt',12):ic('banknote',12))+' '+esc(o.note||(e.k==='p'?(o.method||''):''))+' · '+dateStr(o.ts)+'</div>')+'</div>'+(e.k==='c'?'':('<span class="amt '+(e.k==='d'?'red':'green')+'"><span class="num">'+fmt(o.amount)+'</span> '+CUR()+'</span>'))+'<button class="btn btn-soft" style="width:auto;padding:8px 12px;font-size:12.5px;white-space:nowrap" onclick="trashRestore(\''+o.id+'\')">'+ic('undo',14)+t('restore')+'</button></div>'}).join('')
 :'<div class="muted" style="text-align:center;padding:34px 0">'+ic('trash',28)+'<div style="margin-top:10px;font-weight:700">'+t('trashEmptyS')+'</div></div>')+'</div>'
 +(list.length?'<div class="pad" style="padding-top:0"><button class="btn btn-red" style="width:100%" onclick="trashPurge()">'+ic('trash',16)+' '+t('emptyTrash')+'</button></div>':'')};
const SCREENS={home:S_home,customers:S_customers,reports:S_reports,settings:S_settings,profile:S_profile,invoice:S_invoice,voice:S_voice,rec:S_rec,wiz:S_wiz,repb:S_repb,newcust:S_newcust,trash:S_trash,lock:()=>S_lock()};
const TABS=['home','customers','reports','settings'];
function render(){_IX=null;if(!db){document.getElementById('app').innerHTML='';return}
 applyLang();
 if(locked){document.getElementById('app').innerHTML=S_lock();document.getElementById('tabbar').style.display='none';document.getElementById('actionrow').innerHTML='';document.getElementById('fabAdd').classList.add('hide');window.dispatchEvent(new CustomEvent('daftari-render',{detail:{screen:'lock'}}));return}
 const tp=curScr();const S=SCREENS[tp.s]||S_home;
 document.getElementById('app').innerHTML=S(tp.p||{});
 const isTab=['home','customers','reports','settings'].includes(tp.s);
 const tb=document.getElementById('tabbar');tb.style.display=isTab?'grid':'none';
 const tbBtn=x=>'<button class="'+(tp.s===x?'on':'')+'" aria-current="'+(tp.s===x?'true':'false')+'" onclick="tab(\''+x+'\')"><span class="tbind">'+ic(x==='home'?'home':x==='customers'?'users':x==='reports'?'pie':'gear',24)+'</span><span class="tblb">'+t(x)+'</span></button>';
 tb.innerHTML=tbBtn('home')+tbBtn('customers')+'<button class="tabplus" aria-label="'+t('addC')+'" onclick="ui.nc={name:\'\',phone:\'\',edit:null};go(\'newcust\',{})">'+ic('plus',24)+'</button>'+tbBtn('reports')+tbBtn('settings');
 const ar=document.getElementById('actionrow');
 ar.innerHTML=isTab?((tp.s==='home'&&(ui.sel&&ui.sel.on))?selBarHtml():((tp.s==='customers'&&(ui.csel&&ui.csel.on))?custSelBar():(tp.s==='home'?lpBtn('debt','btn-red','receipt',t('newDebt'))+lpBtn('pay','btn-green','coins',t('pay')):''))):'';
 document.getElementById('fabAdd').classList.add('hide');
 if(!locked&&typeof drawCharts==='function'&&['reports','repb'].includes((curScr()||{}).s))requestAnimationFrame(()=>{try{if(!locked&&['reports','repb'].includes((curScr()||{}).s))drawCharts()}catch(e){}});
 window.scrollTo(0,0);window.dispatchEvent(new CustomEvent('daftari-render',{detail:{screen:tp.s}}));}

/* ================= charts (Chart.js MIT, fallback CSS bars) ================= */
function chartOK(){try{return typeof Chart!=='undefined'&&!!document.createElement('canvas').getContext('2d')}catch(e){return false}}
let __chW=null,__chM=null;
function drawCharts(){if(!chartOK())return;
 const pays=DD().payments;
 const days=[...Array(7)].map((_,i)=>{const d0=new Date();d0.setHours(0,0,0,0);const s0=d0.getTime()-(6-i)*864e5;return pays.filter(pp=>pp.ts>=s0&&pp.ts<s0+864e5).reduce((x,pp)=>x+pp.amount,0)});
 const isRep=['reports','repb'].includes((curScr()||{}).s);
 const cw=document.getElementById('chW');
 if(cw){if(__chW)__chW.destroy();let lb,ds,lg=false;
  if(isRep){const r=repData();const n=Math.min(31,Math.max(1,Math.round((r.b-r.a)/864e5)));const bw=(r.b-r.a)/n;const bk=[...Array(n)].map(()=>({d:0,p:0}));
   r.invs.forEach(x=>{bk[Math.min(n-1,Math.floor((x.ts-r.a)/bw))].d+=x.amount});r.pays.forEach(x=>{bk[Math.min(n-1,Math.floor((x.ts-r.a)/bw))].p+=x.amount});
   const st=Math.ceil(n/8);lb=bk.map((_,k)=>k%st?'':new Date(r.a+k*bw).toLocaleDateString(db.lang==='ar'?'ar':'en-GB',{day:'numeric',month:'numeric'}));
   ds=[{label:t('debtsF'),data:bk.map(x=>x.d),backgroundColor:'#e08585',borderRadius:4,maxBarThickness:14},{label:t('paysF'),data:bk.map(x=>x.p),backgroundColor:'#7fc8a4',borderRadius:4,maxBarThickness:14}];lg=true;}
  else{lb=[...Array(7)].map((_,i)=>i===6?'·':String(6-i));ds=[{data:days,backgroundColor:days.map((v,i)=>i===6?'#0e7a52':'#bfe0d2'),borderRadius:6,maxBarThickness:34}];}
  __chW=new Chart(cw,{type:'bar',data:{labels:lb,datasets:ds},options:{maintainAspectRatio:false,plugins:{legend:{display:lg,labels:{boxWidth:12,font:{size:10}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(128,128,128,.15)'}}}}});}
 const now=new Date();const lbls=[],debtD=[],collD=[];
 for(let k=5;k>=0;k--){const m=new Date(now.getFullYear(),now.getMonth()-k,1);
  lbls.push(m.toLocaleDateString(db.lang==='ar'?'ar':['en'],{month:'short'}));
  debtD.push(DD().invoices.filter(i=>{const d=new Date(i.ts);return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear()}).reduce((x,i)=>x+i.amount,0));
  collD.push(pays.filter(pp=>{const d=new Date(pp.ts);return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear()}).reduce((x,pp)=>x+pp.amount,0));}
 const cm=document.getElementById('chM');
 if(cm){if(__chM)__chM.destroy();
  __chM=new Chart(cm,{type:'bar',data:{labels:lbls,datasets:[{label:t('owed'),data:debtD,backgroundColor:'#e08585',borderRadius:5,maxBarThickness:22},{label:t('collToday'),data:collD,backgroundColor:'#7fc8a4',borderRadius:5,maxBarThickness:22}]},options:{maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(128,128,128,.15)'}}}}});}
}
/* ================= OCR import (Tesseract.js Apache-2.0) ================= */
function ocrPick(){
 if(typeof Tesseract==='undefined'){toastMsg(t('xlLoading'));busy(1);libLoad('lib/tesseract.min.js').then(()=>{busy(0);ocrPick()}).catch(()=>{busy(0);toastMsg(t('ocrNo'))});return}
 const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
 inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;toastMsg(t('ocrRun'));
  Tesseract.recognize(f,'ara+eng',{}).then(r=>{
    const txt=String(r&&r.data&&r.data.text||'');
    const rows=txt.split(/\n+/).map(l=>l.split(/[,،;\t]+/));
    importRows(rows);
  }).catch(()=>toastMsg(t('ocrNo')))};
 inp.click();
}
window.addEventListener('load',()=>{try{if(db&&!locked&&(curScr()||{}).s==='reports')render()}catch(e){}});
try{const __u=new URL(location.href);const __st=__u.searchParams.get('t')||__u.searchParams.get('text')||__u.searchParams.get('title');if(__st){try{sessionStorage.setItem('daftariShare',__st)}catch(e){}history.replaceState(null,'',location.pathname)}setTimeout(()=>{try{const st=sessionStorage.getItem('daftariShare');if(st){sessionStorage.removeItem('daftariShare');window.__shR=extSay(st)?(toastMsg(t('shareGot')),1):0}}catch(e){window.__shE=String(e&&e.message)}},900)}catch(e){}
try{if(false&&'serviceWorker' in navigator&&!location.protocol.startsWith('file')){navigator.serviceWorker.register('sw.js').catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__cc){window.__cc=1;location.reload()}});navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.update()))}}catch(e){}
