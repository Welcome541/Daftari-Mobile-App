/* =====================================================================
 * Daftari · 40-sheets.js
 * ---------------------------------------------------------------------
 * Bottom-sheet framework + account sheet
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
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
function switchAcc(id){db.active=id;save();closeSheet();stack=[{s:'home'}];render()}
function saveAccEdit(){const nm=(document.getElementById('aeNm').value||'').trim();if(!nm){toastMsg(t('nameReq'));return}const curV=document.getElementById('aeCur').value;
 if(ui.accEdit==='new'){const id=uid();db.accounts.push({id,name:nm,type:ui.accTy,cur:curV});db.data[id]={customers:[],invoices:[],payments:[],seq:1};db.active=id}
 else{const x=db.accounts.find(a=>a.id===ui.accEdit);if(x){x.name=nm;x.cur=curV;x.type=ui.accTy}}
 ui.accEdit=null;save();toastMsg(t('savedName'));closeSheet();stack=[{s:'home'}];render()}
