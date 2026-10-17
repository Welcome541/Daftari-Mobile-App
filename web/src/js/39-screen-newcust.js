/* =====================================================================
 * Daftari · 39-screen-newcust.js
 * ---------------------------------------------------------------------
 * SCREEN: new / edit customer
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_newcust=p=>{const ed=p&&p.edit?cust(p.edit):null;if(ed&&ui.nc.edit!==ed.id){ui.nc={name:ed.name,phone:ed.phone||'',photo:ed.photo||null,edit:ed.id}}
 const nm=ui.nc.name||'';
 return headerBar(ed?t('editC'):t('addC'),null,'back()')
 +'<div class="pad"><div class="card" style="padding:20px 17px;display:flex;flex-direction:column;align-items:center"><span class="av" style="width:92px;height:92px;font-size:28px;padding:0;cursor:pointer;background:'+(ui.nc.photo?'none':(nm?avColor(nm):'#d9d2c6'))+';color:'+(nm?'#fff':'var(--navy)')+'" onclick="openPhotoSheet(\'nc\')" aria-label="'+t('photoT')+'">'+(ui.nc.photo?'<img src="'+ui.nc.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':(nm?esc(initials(nm)):ic('user',32)))+'</span>'
 +'<div style="width:100%"><label class="lb">'+t('nameReq')+'</label><input class="inp" value="'+esc(nm)+'" oninput="ui.nc.name=this.value" placeholder="'+(db.lang==='ar'?'مثال: حسن القحطاني':'e.g. Hasan')+'">'
 +'<label class="lb">'+t('phone')+'</label><input class="inp num" value="'+esc(ui.nc.phone)+'" oninput="ui.nc.phone=this.value" inputmode="tel" placeholder="05x xxx xxxx">'

 +'<button class="btn btn-line" style="margin-top:13px" onclick="openContacts()">'+ic('contact',18)+t('fromContacts')+'</button>'
 +'<div class="muted" style="text-align:center;margin-top:13px">'+ic('lock',12)+' '+t('privacyC')+'</div></div></div></div>'
 +'<div class="bottombar"><button class="btn btn-navy" onclick="saveCustomer()">'+ic('save',18)+t('saveC')+'</button></div>';};
function saveCustomer(){const nm=ui.nc.name.trim();if(!nm){toastMsg(t('nameReq'));return}
 if(!ui.nc.edit&&!ui.nc.forceDup){const dup=DD().customers.find(x=>!x.archived&&normAr(x.name)===normAr(nm));
  if(dup){openSheet('<h3>'+t('dupT')+'</h3><div class="card litem" style="margin-top:8px">'+avat(dup.name,42)+'<div class="sp"><b>'+esc(dup.name)+'</b>'+(dup.phone?'<div class="muted num">'+esc(dup.phone)+'</div>':'')+'<div class="muted">'+t('remaining')+': <b class="num">'+fmt(custOpen(dup.id))+'</b> '+CUR()+'</div></div></div><div class="muted" style="margin-top:10px">'+t('dupQ')+'</div><div class="row" style="gap:10px;margin-top:14px"><button class="btn btn-navy" style="flex:1.2" onclick="closeSheet();stack=[{s:\'profile\',p:{id:\''+dup.id+'\'}}];render()">'+t('dupOpen')+'</button><button class="btn btn-line" style="flex:1.2" onclick="closeSheet();ui.nc.forceDup=true;saveCustomer()">'+t('dupNew')+'</button></div>');return}}
 if(ui.nc.edit){const c=cust(ui.nc.edit);c.name=nm;c.phone=ui.nc.phone.trim();if(ui.nc.photo!==undefined)c.photo=ui.nc.photo;save();toastMsg(t('savedC'));ui.nc={name:'',phone:'',limit:'',photo:null,edit:null};stack=[{s:'profile',p:{id:c.id}}];render();return}
 const c={id:uid(),name:nm,phone:ui.nc.phone.trim(),photo:ui.nc.photo||null,since:String(new Date().getFullYear()),archived:false,pinned:false};DD().customers.push(c);save();toastMsg(t('savedC'));ui.nc={name:'',phone:'',limit:'',photo:null,edit:null};if(ui.recPend&&ui.rec){ui.recPend=false;ui.rec.d.custId=c.id;ui.rec.d.name=c.name;ui.rec.cands=[];stack=[{s:'rec',p:{kind:ui.rec.kind}}];render();return}stack=[{s:'profile',p:{id:c.id}}];render();}
function openPhotoSheet(target){const c=target==='nc'?null:cust(target);
 openSheet('<h3>'+t('photoT')+'</h3>'
 +'<button class="srow" onclick="pickPhoto(\''+target+'\')"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('cam',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('photoAdd')+'</span><span class="d">'+t('photoD')+'</span></span>'+ic('fwd',17)+'</button>'
 +((target==='nc'?ui.nc.photo:(c&&c.photo))?'<button class="srow" onclick="removePhoto(\''+target+'\')"><span class="sic2" style="background:var(--red-bg);color:var(--red)">'+ic('trash',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('photoDel')+'</span></span></button>':''))}
function pickPhoto(target){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{try{const S=96,cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;const g=cnv.getContext('2d');const m=Math.min(img.width,img.height)||1;g.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);const url=cnv.toDataURL('image/jpeg',0.82);if(target==='nc')ui.nc.photo=url;else{const c=cust(target);if(c){c.photo=url;save()}}closeSheet();render()}catch(e){toastMsg(t('btFail'))}};img.onerror=()=>toastMsg(t('btFail'));img.src=r.result};r.readAsDataURL(f)};inp.click()}
function removePhoto(target){if(target==='nc')ui.nc.photo=null;else{const c=cust(target);if(c){c.photo=null;save()}}closeSheet();render()}
