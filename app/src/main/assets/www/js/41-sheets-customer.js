/* =====================================================================
 * Daftari · 41-sheets-customer.js
 * ---------------------------------------------------------------------
 * Customer sheets: archive, export, import
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function openCustMenu(id){const c=cust(id);
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('custOpts')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<button class="srow" onclick="closeSheet();ui.nc={name:\'\',phone:\'\',edit:\''+id+'\'};go(\'newcust\',{edit:\''+id+'\'})"><span class="sic2">'+ic('edit',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('editC')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();openExport(\''+id+'\')"><span class="sic2">'+ic('share',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('shareExp')+'</span><span class="d">'+t('shareExpD')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();confirmArchive(\''+id+'\')"><span class="sic2" style="color:var(--red)">'+ic('archive',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('archC')+'</span><span class="d" style="color:var(--red)">'+t('archD')+'</span></span></button>'
 +'<div class="muted" style="text-align:center;margin-top:8px">'+ic('shield',13)+' '+t('deletedKeep')+'</div>');}
function confirmArchive(id){const c=cust(id);const o=custOpen(id);
 openSheet('<h3>'+t('archConf')+'</h3><div style="font-weight:800;margin:6px 0">'+esc(c.name)+'</div>'
 +(o>0?'<div class="card" style="padding:12px 14px;background:var(--red-bg);color:var(--red);font-weight:800">'+t('archBal')(money(o))+'</div><div class="muted" style="margin-top:10px;line-height:1.8">'+t('archKeep')+'</div>':'<div class="muted" style="margin-top:6px;line-height:1.8">'+t('archZero')+'</div>')
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1" onclick="cust(\''+id+'\').archived=true;save();closeSheet();toastMsg(t(\'archived\'));stack=[{s:\'customers\'}];render()">'+t('archGo')+'</button></div>')}
function confirmRestore(id){openSheet('<h3>'+t('restoreQ')+'</h3><div class="muted" style="margin-top:6px">'+t('restoreD')+'</div><div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1" onclick="cust(\''+id+'\').archived=false;save();closeSheet();render()">'+t('restore')+'</button></div>')}
function togglePin(id){const c=cust(id);c.pinned=!c.pinned;save();render()}
function openExport(id){const c=cust(id);
 openSheet('<h3>'+t('exportT')+' — '+esc(c.name)+'</h3>'
 +'<button class="srow" onclick="closeSheet();shareReceipt(\''+id+'\')"><span class="sic2">'+ic('share',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('stTxt')+'</span></span></button>'
 +'<button class="srow" onclick="closeSheet();exportCSV(\''+id+'\')"><span class="sic2" style="color:var(--green)">'+ic('excel',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('stXls')+'</span></span></button>'
 +(c.phone?'<button class="srow" onclick="closeSheet();sendWA(\''+id+'\')"><span class="sic2" style="color:#1e8e5a">'+ic('wa',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('sendWa')+'</span></span></button><button class="srow" onclick="closeSheet();sendSMS(\''+id+'\')"><span class="sic2">'+ic('sms',19)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('sendSms')+'</span></span></button>':''));}
function openPaper(){openSheet('<h3>'+t('paperT')+'</h3><div class="muted" style="margin-bottom:8px">'+t('paperD')+'</div><div class="lb">'+t('paperDate')+'</div><input class="inp num" id="ppD" type="date" value="'+new Date().toISOString().slice(0,10)+'"><textarea class="inp" id="ppT" rows="6" style="margin-top:8px" placeholder="'+(db.lang==='ar'?'أبو خالد سبعين رز وحليب':'Abu Khaled seventy')+'"></textarea><button class="btn btn-navy" style="margin-top:10px" onclick="paperReview()">'+t('paperGo')+'</button><div id="ppR"></div>')}
function paperReview(){const txt=document.getElementById('ppT').value;const rows=txt.split('\n').map(x=>x.trim()).filter(Boolean);const drafts=rows.map(r=>{const pr=parseSay(r);return {say:r,name:pr.name||r,amt:pr.amt||0,note:pr.note||'',ok:!!(pr.name&&pr.amt>0)}});window.__pp=drafts;
 document.getElementById('ppR').innerHTML='<div style="margin-top:10px">'+drafts.map((d,i)=>'<div class="kv" style="padding:6px 0"><span class="kic" style="background:'+(d.ok?'var(--green-bg);color:var(--green)':'var(--amber-bg);color:var(--amber)')+'">'+(d.ok?'✓':'!')+'</span><span class="k">'+esc(d.name)+'<div class="muted" style="font-size:11px">'+esc(d.note)+'</div></span><span class="v amt">'+(d.ok?fmt(d.amt):t('needsRev'))+'</span></div>').join('')+'</div><button class="btn btn-green" style="margin-top:10px" onclick="paperCommit()">'+t('importGo')+'</button>'}
function paperCommit(){const ds=(window.__pp||[]).filter(d=>d.ok);const dv=document.getElementById('ppD').value;const ts=dv?new Date(dv+'T12:00:00').getTime():Date.now();ds.forEach(d=>{let c=DD().customers.find(x=>x.name===d.name&&!x.archived);if(!c){c={id:uid(),name:d.name,phone:'',since:String(new Date(ts).getFullYear()),archived:false,pinned:false};DD().customers.push(c)}DD().invoices.push({id:uid(),code:'P'+(DD().seq++),cust:c.id,ts,amount:d.amt,note:d.note,src:'paper'})});closeSheet();save();render();toastMsg('✓ '+ds.length)}
function openImport(){openSheet('<h3>'+t('importT')+'</h3><div class="muted" style="margin-bottom:10px">'+t('importD')+'</div><textarea class="inp" id="impTxt" rows="7" placeholder="'+(db.lang==='ar'?'أبو خالد، 50، رز وحليب\\nسارة أحمد، 120، سكر وشاي':'Abu Khaled, 50, rice & milk')+'"></textarea><input type="file" accept=".txt,.csv,.xls,.xlsx" style="margin-top:10px" onchange="readImp(this)"><button class="btn btn-soft" style="margin-top:10px" onclick="ocrPick()">'+ic('cam',17)+t('ocrBtn')+'</button><button class="btn btn-soft" style="margin-top:10px" onclick="openPaper()">'+ic('mic',17)+t('paperT')+'</button><button class="btn btn-navy" style="margin-top:12px" onclick="doImport()">'+ic('up',17)+t('importGo')+'</button>')}
window.readImp=inp=>{const f=inp.files[0];if(!f)return;
 if(/\.xlsx?$/i.test(f.name)&&typeof XLSX==='undefined'){busy(1);libLoad('lib/xlsx.full.min.js').then(()=>{busy(0);window.readImp(inp)}).catch(()=>{busy(0);toastMsg(t('xlNo'))});return}
 if(/\.xlsx?$/i.test(f.name)){const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(new Uint8Array(r.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];importRows(XLSX.utils.sheet_to_json(ws,{header:1}))}catch(e){toastMsg(t('btFail'))}};r.readAsArrayBuffer(f);return}
 const r=new FileReader();r.onload=()=>{document.getElementById('impTxt').value=r.result};r.readAsText(f)};
function importRows(rows){const snap=JSON.stringify({c:DD().customers,i:DD().invoices});let n=0;
 (rows||[]).forEach(r=>{if(!Array.isArray(r))return;const cells=r.map(x=>x==null?'':String(x).trim()).filter(x=>x!=='');if(cells.length<2)return;
  let nm=null,amt=null,ph='',nt=[];
  cells.forEach(c=>{if(ph===''&&/^[+0-9][0-9\s-]{8,}$/.test(c)){ph=c;return}
   if(amt===null&&/^[\d.,،\s]+$/.test(c)&&c.replace(/\D/g,'').length>0&&c.replace(/\D/g,'').length<=7){amt=Money.parse(c);return}
   if(!nm){nm=c;return}nt.push(c)});
  if(!nm||amt===null||isNaN(amt)||amt<=0)return;
  let c=DD().customers.find(x=>x.name===nm&&!x.archived);if(!c){c={id:uid(),name:nm,phone:ph,since:String(new Date().getFullYear()),archived:false,pinned:false};DD().customers.push(c)}
  DD().invoices.push({id:uid(),code:'A'+(DD().seq++),cust:c.id,ts:Date.now(),amount:amt,note:nt.join(' ')});n++});
 if(!n){toastMsg(t('noRes'));return 0}
 save();closeSheet();render();
 toastMsg(t('imported')(n),()=>{const d2=DD();const o=JSON.parse(snap);d2.customers=o.c;d2.invoices=o.i;save();render()});return n}
function doImport(){const txt=document.getElementById('impTxt').value;
 importRows(txt.split(/\n+/).map(l=>l.split(/[,،;\t]+/)))}
function startMicMeter(){stopMicMeter();try{if(!navigator.mediaDevices)return;
 navigator.mediaDevices.getUserMedia({audio:true}).then(st=>{window.__micSt=st;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;window.__ac=window.__ac||new AC();const an=window.__ac.createAnalyser();an.fftSize=64;window.__ac.createMediaStreamSource(st).connect(an);window.__an=an;window.__micBuf=new Uint8Array(an.frequencyBinCount);const f=document.getElementById('wvfall');if(f)f.style.display='none';
  window.__wvTick=setInterval(()=>{const c=document.getElementById('wv');if(!c||!window.__an||!ui.rec||ui.rec.st!=='rec')return;window.__an.getByteFrequencyData(window.__micBuf);const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);const n=16,w=c.width/n;for(let i=0;i<n;i++){const v=window.__micBuf[i*2]/255;const h=4+v*(c.height-6);g.fillStyle=window.__wvCol||'#a71949';g.fillRect(i*w+1,(c.height-h)/2,w-2,h)}},120)}).catch(()=>{})}catch(e){}}
function stopMicMeter(){try{if(window.__micSt){window.__micSt.getTracks().forEach(t=>t.stop());window.__micSt=null}clearInterval(window.__wvTick)}catch(e){}}
function retryRec(){const k=ui.rec?ui.rec.kind:'debt';ui.rec=null;startRec(k)}
function recNewCust(){ui.nc={name:(ui.rec&&ui.rec.d.name)||'',phone:'',photo:null,edit:null};ui.recPend=true;go('newcust',{})}
function openCurSheet(){openSheet('<h3>'+t('curCustom')+'</h3><input class="inp" id="curIn" value="'+esc(curAcc().cur)+'" maxlength="12"><button class="btn btn-navy" style="margin-top:12px" onclick="saveCur()">'+ic('checkc',16)+t('saveName')+'</button>')}
function saveCur(){const v=(document.getElementById('curIn').value||'').trim();if(v)setCur(v);closeSheet()}
window.reset=()=>{if(!confirm(t('resetQ')))return;try{localStorage.removeItem(PLAIN);localStorage.removeItem(ENC);localStorage.removeItem('v1raw')}catch(e){}db=migrate(null);save();stack=[{s:'home'}];render()};
function openContacts(){
 if(window.Daftari&&Daftari.pickContact){window.contactPicked=(n,p)=>{try{ui.nc.name=n||'';ui.nc.phone=p||'';closeSheet();render()}catch(e){}};try{Daftari.pickContact()}catch(e){toastMsg(t('webNo'))}return}
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('contactsT')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="padding:16px 13px"><div class="row" style="color:var(--soft)">'+ic('shield',17)+'<span style="font-size:12.5px">'+t('contactsAppOnly')+'</span></div></div></div>')
}
function openCustPicker(){openSheet('<h3>'+t('chooseC')+'</h3>'+DD().customers.filter(c=>!c.archived).map(c=>'<button class="srow" onclick="ui.pay.cust=\''+c.id+'\';ui.pay.amt=\'\';closeSheet();render()">'+avat(c.name,42)+'<span class="sp" style="text-align:start"><span class="t">'+esc(c.name)+'</span><span class="d">'+t('remaining')+': '+money(custOpen(c.id))+'</span></span>'+(custOpen(c.id)>0?'<span class="amt red">'+money(custOpen(c.id))+'</span>':'')+'</button>').join(''))}
