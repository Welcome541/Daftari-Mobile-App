/* =====================================================================
 * Daftari · 36-recognition.js
 * ---------------------------------------------------------------------
 * Arabic/English number parsing + recording
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function waveHtml(){let s='';for(let i=0;i<26;i++)s+='<i style="--d:'+(i*0.07)+'s;--h:'+(8+((i*37)%26))+'px"></i>';return s}
function voiceStart(){ui.voice.st='listen';ui.voice.edit=false;render();VoiceEngine.listen(txt=>{if(extSay(txt))ui.voice.st='idle';else{toastMsg(t('warn_nospeech'));ui.voice.st='idle';render()}})}
function voiceToggleEdit(){const v=ui.voice;if(v.edit){v.d.custId=document.getElementById('ve_c').value;v.d.name=document.getElementById('ve_c').selectedOptions[0].text;v.d.amt=Money.parse(document.getElementById('ve_a').value);v.d.note=document.getElementById('ve_n').value;}v.edit=!v.edit;render()}
function voiceConfirm(){const v=ui.voice;if(v.edit)voiceToggleEdit();const c=cust(v.d.custId)||cust(ctxCust());if(!c||!v.d.amt){toastMsg(t('chooseFirst'));return}
 const now=Date.now();const inv={id:uid(),code:'A'+(DD().seq++),cust:c.id,ts:now,createdAt:now,hasTime:true,amount:v.d.amt,note:v.d.note};DD().invoices.push(inv);save();feedback('debt');
 ui.voice={st:'idle',demo:ui.voice.demo,edit:false,d:{},cands:[]};stack=[{s:'profile',p:{id:c.id}}];render();
 doneSnack('debt',inv.id,c?c.id:null,inv.amount);}
let recPend=null,recEnd=null;
const DEMOP=[{name:'أبو خالد',amt:20,note:'',say:'أبو خالد سدد عشرين ريال نقدًا'}];
let touchSeen=0;
const lpLast={t:0,k:''};
function lpGuard(k){const n=Date.now();if(lpLast.k===k&&n-lpLast.t<450)return false;lpLast.t=n;lpLast.k=k;return true}
function btnDownT(k){touchSeen=Date.now();btnDown(k)}
function btnDownP(k){if(Date.now()-touchSeen<800)return;btnDown(k)}
function btnUpT(k){touchSeen=Date.now();if(!lpGuard(k))return;btnUp(k)}
function btnUpP(k){if(Date.now()-touchSeen<800)return;if(!lpGuard(k))return;btnUp(k)}
function btnClick(k){if(Date.now()-touchSeen<800)return;if(recPend||ui.rec&&ui.rec.st==='rec')return;if(!lpGuard(k))return;clearTimeout(recPend);recPend=null;goWiz(k,ctxCust())}
function lpBtn(kind,cls,icon,label){return '<button class="btn '+cls+'" aria-label="'+t(kind==='debt'?'recDebt':'recPay')+'" onpointerdown="btnDownP(\''+kind+'\')" onpointerup="btnUpP(\''+kind+'\')" onpointerleave="btnCancelRec()" ontouchstart="btnDownT(\''+kind+'\')" ontouchend="btnUpT(\''+kind+'\')" onclick="btnClick(\''+kind+'\')" oncontextmenu="return false">'+ic(icon,18)+label+'</button>'}
function btnDown(kind){if(recPend)return;recPend=setTimeout(()=>{recPend=null;try{if(sec.vib&&navigator.vibrate)navigator.vibrate([18,40,18])}catch(e){}startRec(kind)},380)}
function btnCancelRec(){clearTimeout(recPend)}
function btnUp(kind){if(recPend){clearTimeout(recPend);recPend=null;
 goWiz(kind,ctxCust());return}
 // no auto-close: only handle explicit finger lift if still recording
 if(ui.rec && ui.rec.st==='rec' && !ui.rec._released){
  ui.rec._released=true;
  clearTimeout(recEnd);
  if(sec.vosk && window.voskEngine && window.voskEngine.recording && !ui.rec._voskStopRequested){
   ui.rec._voskStopRequested=true; window.voskEngine.stop(); recEnd=setTimeout(()=>{if(ui.rec&&ui.rec.st==='rec') endRec()},450); return;
  }
  // small debounce to avoid double firing from pointer+touch
  setTimeout(()=>{ if(ui.rec&&ui.rec.st==='rec') endRec(); }, 120);
 }}
function startRec(kind,custId){ui.rec={kind,st:'rec',edit:false,d:{},cands:[],pre:custId||null,t0:Date.now()};window.__wvCol=kind==='debt'?'#a71949':'#0e7a52';go('rec',{kind});clearTimeout(recEnd);
 clearInterval(window.__recTick);window.__recTick=setInterval(()=>{if(!ui.rec||ui.rec.st!=='rec')return;const el=document.getElementById('recT');const sc=Math.floor((Date.now()-ui.rec.t0)/1000);if(el)el.textContent=('0'+Math.floor(sc/60)).slice(-2)+':'+('0'+sc%60).slice(-2);const rf=document.getElementById('recFields');if(rf)rf.innerHTML=recFieldsHtml();if(sc>=30){toastMsg(t('recLong'));endRec()}},500);
 startMicMeter();
 if(sec.vosk){if(window.voskEngine&&window.voskEngine.ready){window.voskEngine.start(kind,custId);return}
  toastMsg(t('voskLoad'));libLoad('lib/vosk-browser.js').then(()=>{window.voskReinit&&window.voskReinit();setTimeout(()=>{if(window.voskEngine&&window.voskEngine.ready){window.voskEngine.start(kind,custId)}else toastMsg(t('voskNo'))},300)}).catch(()=>toastMsg(t('voskNo')));return}
 if(tryWebASR(kind))return;
 ui.rec.engineError=true; render();}
function learnCorrection(text,amtMinor){if(!text||!amtMinor)return;const c=sec.corrections||(sec.corrections=[]);const e=c.find(x=>x.t===text);if(e){e.a=amtMinor;e.n=(e.n||1)+1}else{c.push({t:text,a:amtMinor,n:1});if(c.length>200)c.shift()}saveSec()}
function amtFromText(text){const lc=(sec.corrections||[]).find(x=>x.t&&text&&text.includes(x.t));if(lc)return {amt:lc.a,start:0,end:0,raw:true};
  const nd=String(text).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴٥٦٨٩'.indexOf(c)));
  const m=nd.match(/\d+(?:[.,]\d+)?/);
  if(m)return {amt:Money.parse(m[0]),start:m.index,end:m.index+m[0].length,raw:true};
  const w=words2num(nd);
  return w.amt>0?{amt:Money.fromNumber(w.amt),start:w.start,end:w.end,raw:true}:{amt:0,start:0,end:0,raw:false};
}
const HU={'مئة':1,'مائة':1,'مية':1,'ماية':1,'مايه':1,'مئه':1};
const W1={'صفر':0,'واحد':1,'واحدة':1,'احد':1,'أحد':1,'اثنين':2,'اثنان':2,'اثنتان':2,'اتنين':2,'تنين':2,'ثلاثة':3,'ثلاث':3,'تلاتة':3,'تلات':3,'اربعة':4,'أربعة':4,'اربع':4,'أربع':4,'خمسة':5,'خمس':5,'خمست':5,'سته':6,'ستة':6,'ست':6,'سبعه':7,'سبعة':7,'سبع':7,'ثمانية':8,'ثمان':8,'تمانية':8,'ثمانيه':8,'تسعة':9,'تسع':9,'تسعه':9};
const W10={'عشرة':10,'عشر':10,'عشرت':10,'عشرون':20,'عشرين':20,'تلاتون':30,'ثلاثون':30,'ثلاثين':30,'تلاتين':30,'اربعون':40,'أربعون':40,'اربعين':40,'أربعين':40,'خمسون':50,'خمسين':50,'ستون':60,'ستين':60,'سبعون':70,'سبعين':70,'ثمانون':80,'ثمانين':80,'تمانون':80,'تمانيه':8,'تسعون':90,'تسعين':90};
const E1={'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19};
const E10={'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90};
function hunMul(t){ // returns u for "<u> مئة" combos like ثلاثمئة / خمسمية / تلاتمية
  const m=t.match(/^(واحد|واحدة|احد|أحد|اثنتين|اثنين|اثنان|اتنين|ثلاثة|ثلاث|تلاتة|تلات|اربعة|أربعة|اربع|أربع|خمسة|خمس|خمست|سته|ستة|ست|سبعه|سبعة|سبع|ثمانية|ثمان|تمانية|تسعة|تسع|تسعه)(مئة|مائة|مية|ماية|مايه|مئه)$/);
  if(!m)return 0;return W1[m[1]]||0}
function words2num(s){
  const toks=String(s).toLowerCase().split(/[^0-9a-zA-Z؀-ۿ]+/).filter(Boolean);
  let total=0,cur=0;const usedSet=new Set();
  for(let i=0;i<toks.length;i++){
    let t=toks[i].replace(/^و+/,'');let used=true;let extra=false;
    if(t==='و'||t==='and'){used=false}
    else if(HU[t]){cur=(cur||1)*100}
    else if(t==='مئتان'||t==='مائتان'||t==='ميتين'||t==='مايتين'){cur+=200}
    else if(hunMul(t)){cur+=hunMul(t)*100}
    else if(t==='الف'||t==='ألف'){total+=(cur||1)*1000;cur=0}
    else if(t==='الفين'||t==='ألفين'||t==='الفان'||t==='ألفان'){total+=2000;cur=0}
    else if(t==='الاف'||t==='آلاف'||t==='الآلاف'){total+=(cur||1)*1000;cur=0}
    else if({'نص':0.5,'نصف':0.5,'ربع':0.25}[t]!==undefined){cur+={'نص':0.5,'نصف':0.5,'ربع':0.25}[t]}
  else if(t==='أرباع'||t==='ارباع'){cur=cur*0.25}
  else if(t==='هللة'){cur=cur/100}
  else if(W10[t]!==undefined){cur+=W10[t]}
    else if(W1[t]!==undefined){
      const nx=toks[i+1];
      if(nx&&/^(عشر|عشرة|عشره)$/.test(nx.replace(/^و+/,''))){cur+=10+W1[t];i++;extra=true}
      else if(nx&&HU[nx.replace(/^و+/,'')]){cur+=W1[t]*100;i++;extra=true}
      else cur+=W1[t];
    }
    else if(E1[t]!==undefined){cur+=E1[t]}
    else if(E10[t]!==undefined){cur+=E10[t]}
    else if(t==='hundred'){cur=(cur||1)*100}
    else if(t==='thousand'){total+=(cur||1)*1000;cur=0}
    else used=false;
    if(used){usedSet.add(i);if(extra)usedSet.add(i-1)}
  }
  const usedIdx=[...usedSet].sort((a,b)=>a-b);
  if(!usedIdx.length)return {amt:0,start:0,end:0};
  let pos=0;const starts=[],ends=[];
  for(let i=0;i<toks.length;i++){const at=s.indexOf(toks[i],pos);starts.push(at);ends.push(at+toks[i].length);pos=at+toks[i].length}
  return {amt:total+cur,start:starts[usedIdx[0]],end:ends[usedIdx[usedIdx.length-1]]};
}
function parseSay(text){const a=amtFromText(text);const amt=a.amt||0;
 const before=a.raw?text.slice(0,a.start).trim():text.trim();let after=a.raw?text.slice(a.end).trim():'';
 after=after.replace(/ريال|ريالات|ر\.س|جنيه|درهم|ليرة|فقط|only|net/g,'').trim();
 const cs=DD().customers.filter(c=>!c.archived);let name=before,custId=null;
 const hit=(before&&(cs.find(c=>c.name===before)||cs.find(c=>c.name.includes(before))||cs.find(c=>before.includes(c.name.split(' ')[0]))))||null;
 if(hit){name=hit.name;custId=hit.id}
 return {name,amt,note:after,custId}}
function handleSay(kind,text,conf){const r0=ui.rec;if(!r0||!(r0.st==='rec'||(r0.st==='edit'&&!r0.d.say)))return;const lt=document.getElementById('liveTx');if(lt&&r0.st==='rec')lt.textContent=t('heard')+' «'+String(text).slice(0,60)+'»';clearTimeout(recEnd);
 const pr=parseSay(text||'');let warn=null;
 if(!text||!String(text).trim())warn='nospeech';else if(pr.amt<=0)warn='noamt';else if(pr.amt>1000000)warn='toobig';else if((conf==null?1:conf)<0.45)warn='lowconf';
 r0.warn=warn;if(warn)toastMsg(t('warn_'+warn));
 r0.d=kind==='debt'?{name:pr.name,amt:pr.amt,note:pr.note,due:null,say:text,custId:pr.custId}:{name:pr.name,amt:pr.amt,method:'cash',say:text,custId:pr.custId};
 r0.edit=false; r0.st='edit';render()}
window.voskOnText=(k,txt,conf)=>handleSay(k,txt,conf);
window.voskOnEnd=()=>{const r0=ui.rec;if(r0&&r0.st==='rec'){clearTimeout(recEnd);recEnd=setTimeout(endRec,400)}};
function extSay(text){text=String(text||'').trim();if(!text)return false;
 const kind=/سداد|سدّد|ادفع|إيداع|ايداع|pay|deposit/i.test(text)?'pay':'debt';
 if(!ui.rec||ui.rec.st!=='rec'){startRec(kind,ctxCust());if(!ui.rec)return false}
 handleSay(kind,text,null);return true}
window.openExtSheet=()=>{openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('extT')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div><div class="muted" style="font-size:12px;line-height:1.8;margin-bottom:8px">'+t('extD')+'</div><textarea id="extTx" class="inp" style="min-height:90px;resize:vertical" placeholder="'+t('extPh')+'"></textarea><button class="btn btn-navy" style="margin-top:10px" onclick="if(extSay(document.getElementById(\'extTx\').value)){closeSheet()}else{toastMsg(t(\'warn_nospeech\'))}">'+ic('mic',16)+' '+t('extGo')+'</button>')}
window.voskImpMsg=(lib,model)=>t(lib&&model?'voskImpBoth':lib?'voskImpLib':model?'voskImpModel':'voskImpNone');
window.projPick=()=>{if(window.Daftari&&Daftari.pickProject){Daftari.pickProject();return}var el=document.getElementById('projFile');if(el)el.click()};
window.projPickFile=inp=>{var f=inp&&inp.files&&inp.files[0];if(!f)return;
 if(/\.html?$/i.test(f.name)){var fr=new FileReader();
  fr.onload=()=>{try{document.open();document.write(fr.result);document.close()}catch(e){toastMsg('X '+e.message)}};
  fr.readAsText(f,'utf-8');}
 else{toastMsg(t('projZipNo'))}
};
function tryWebASR(kind){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return false;
 try{const r=new SR();r.lang=db.lang==='ar'?'ar-SA':'en-US';r.interimResults=true;r.maxAlternatives=1;
  r.onresult=e=>{const res=e.results[0][0];const lt=document.getElementById('liveTx');if(lt&&!e.results[0].isFinal)lt.textContent=t('heard')+' «'+(res.transcript||'')+'»';if(e.results[0].isFinal)handleSay(kind,res.transcript||'',res.confidence)};
  r.onerror=ev=>{toastMsg(ev&&ev.error==='no-speech'?t('warn_nospeech'):t('webNo'));if(ui.rec&&ui.rec.st==='rec'){clearTimeout(recEnd);recEnd=setTimeout(endRec,600)}};
  r.onend=()=>{if(ui.rec&&ui.rec.st==='rec'){clearTimeout(recEnd);recEnd=setTimeout(endRec,400)}};
  r.start();return true}catch(e){return false}}
function endRec(){const r=ui.rec;if(!r||r.st!=='rec')return;if(sec.vosk&&window.voskEngine&&window.voskEngine.recording&&!r._voskStopRequested){r._voskStopRequested=true;clearTimeout(recEnd);window.voskEngine.stop();recEnd=setTimeout(()=>{if(ui.rec===r&&r.st==='rec')endRec()},1400);return}stopMicMeter();clearInterval(window.__recTick);try{if(sec.vib&&navigator.vibrate)navigator.vibrate(r.d&&r.d.say?50:[30,40,30])}catch(e){}
 if(!isP()&&!DD().customers.some(c=>!c.archived)){ui.rec=null;toastMsg(t('noCustomers'));go('newcust',{});return}
 const pre=isP()?null:((r.pre&&cust(r.pre))||(ctxCust()?cust(ctxCust()):null));
 r.warn=r.warn||'nospeech';
 r.d=r.kind==='debt'?{name:pre?pre.name:'',amt:0,note:'',due:null,say:'',custId:pre?pre.id:null}:{name:pre?pre.name:'',amt:0,method:'cash',say:'',custId:pre?pre.id:null};
 r.cands=pre?[]:DD().customers.filter(c=>!c.archived).slice(0,5);
 r.edit=false; r.st='edit';render()}
function payImpactFor(cid,amt){const c=cid?cust(cid):null;if(!c||!amt)return '';const open=custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts);let left=amt;const rows=[];open.forEach(i=>{if(left<=0)return;const r2=invRem(i);const use=Math.min(r2,left);left-=use;rows.push({i,use,r:r2})});const after=custOpen(c.id)-amt;const will=after<=0?'willPaid':(rows.length?'willPart':'willOpen');
 return '<div class="card" style="padding:4px 16px;margin-top:12px"><div class="kv"><span class="kic" style="background:'+(will==='willPaid'?'var(--green-bg);color:var(--green)':'var(--amber-bg);color:var(--amber)')+'">'+(will==='willPaid'?ic('checkc',17):ic('clock',17))+'</span><span class="k">'+t(will)+'</span><span class="v amt" style="color:'+(will==='willPaid'?'var(--green)':'var(--amber)')+'">'+money(after)+'</span></div></div>';}
function recFieldsHtml(){const r=ui.rec||{d:{}},d=r.d||{};
 const line=(mark,color,txt)=>'<div style="display:flex;align-items:center;gap:9px;padding:4px 0;font-weight:800;font-size:13.5px"><span style="width:22px;text-align:center;color:'+color+'">'+mark+'</span><span>'+txt+'</span></div>';
 const arrow='<div class="muted" style="text-align:center;font-size:10px;line-height:1;padding:1px 0">\u2193</div>';
 const hasC=!!(d.custId||d.name),hasA=d.amt>0,hasN=!!d.note;
 let h=line(hasC?ic('checkc',16):'\u25cb',hasC?'var(--green)':'var(--soft)',hasC?esc(d.name||''):t('cust'));
 h+=arrow+line(hasA?'\u25cf':'\u25cb',hasA?(r.kind==='debt'?'var(--red)':'var(--green)'):'var(--soft)',hasA?t('amount')+' \u2014 '+money(d.amt):t('amount'));
 if(r.kind==='debt')h+=arrow+line(hasN?'\u25cf':'\u25cb',hasN?'var(--navy)':'var(--soft)',hasN?esc(d.note):t('remind')+' \u2014 '+t('optF'));
 return h}
const S_rec=p=>{const r=ui.rec||{st:'rec',kind:(p&&p.kind)||'debt'};
 const d=r.d||{};
 const hasAmt=d.amt>0;
 const custOpts=isP()?[]:DD().customers.filter(c=>!c.archived);
 const recStyle='<style>.recWrap{background:#f6f1ea;min-height:calc(100vh - 56px)} .recWave i{background:#d2a0b8 !important;width:3px !important;border-radius:99px} .recCard{background:#fff;border-radius:18px;border:1px solid #ece6db;box-shadow:0 8px 24px rgba(13,31,58,.07);padding:14px} .recInp{width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid #e9e1d5;background:#fff;font-size:14.5px;outline:none;text-align:center;font-weight:700} .recInp:focus{border-color:var(--navy)} .recInp.err{border-color:#e85a5a;background:#fff5f5} .recLbl{font-weight:800;font-size:12.5px;color:#6b7280;display:flex;align-items:center;gap:6px;white-space:nowrap} .candPill{border-radius:999px;padding:8px 14px;font-weight:700;font-size:13px;border:1.5px solid #e8e0d5;background:#fff;color:var(--ink)} .candPill.on{background:var(--navy);border-color:var(--navy);color:#fff} .recBtnConfirm{background:#7a1236;color:#fff;border-radius:14px;padding:14px 18px;font-weight:900;font-size:16px;flex:1.45;display:flex;align-items:center;justify-content:center;gap:8px;border:none} .recBtnEdit{background:#fff;border:1.5px solid #e8e0d5;border-radius:14px;padding:12px 14px;font-weight:800;color:#9aa0a6;flex:1;display:flex;align-items:center;justify-content:center;gap:6px} .recX{width:44px;height:44px;border-radius:12px;background:#fff;border:1.5px solid #e8e0d5;display:flex;align-items:center;justify-content:center;flex:none} .recDash{border:1.5px dashed #cbd5e1;background:#f8fafc}</style>';
 const topWave='<div style="display:flex;flex-direction:column;align-items:center;padding:14px 0 8px"><div class="wave recWave" style="height:28px;gap:3px;justify-content:center;margin:0">'+waveHtml()+'</div>'+(r.st==='rec'?'<canvas id="wv" width="260" height="24" style="display:none"></canvas><div id="wvfall" style="display:none">'+waveHtml()+'</div><div id="liveTx" aria-live="polite" style="min-height:14px;font-size:12px;color:var(--muted);margin-top:6px"></div><div class="num" id="recT" style="font-weight:900;font-size:13px;color:var(--red);margin-top:4px">00:00</div>':'<div style="font-size:12px;color:var(--muted);margin-top:6px" class="transcript">'+(d.say?esc(d.say).slice(0,60):'')+'</div>')+'</div>';
 const custInput=r.edit
   ?'<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><select class="recInp" id="re_c" style="text-align:center">'+custOpts.map(c=>'<option value="'+c.id+'"'+(c.id===d.custId?' selected':'')+'>'+esc(c.name)+'</option>').join('')+(custOpts.length?'':'<option value="">'+t('cust')+'</option>')+'</select></div><div class="recLbl">'+t('cust')+' '+ic('user',16)+'</div></div>'
   :'<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><input class="recInp" id="re_c_txt" value="'+esc(d.name||'')+'" placeholder="'+t('cust')+'" readonly onclick="ui.rec.edit=true;render()" style="cursor:pointer"></div><div class="recLbl">'+t('cust')+' '+ic('user',16)+'</div></div>';
 const amtCls=(r.warn==='noamt' || !hasAmt) ? ' err' : '';
 const amtInput='<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><input class="recInp num'+amtCls+'" id="re_a" type="number" inputmode="decimal" value="'+(d.amt?Money.dec(d.amt):'')+'" placeholder="* أدخل المبلغ هنا" ></div><div class="recLbl" style="color:'+(amtCls?'#e85a5a':'')+'">'+t('amount')+' * '+ic('wallet',16)+'</div></div>';
 const noteInput=r.kind==='debt'?'<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><input class="recInp" id="re_n" value="'+esc(d.note||'')+'" placeholder="رز وحليب..." ></div><div class="recLbl">'+t('remind')+' '+ic('tag',16)+'</div></div>':'<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><select class="recInp" id="re_m"><option value="cash"'+(d.method==='cash'?' selected':'')+'>'+t('cash')+'</option><option value="transfer"'+(d.method==='transfer'?' selected':'')+'>'+t('transfer')+'</option><option value="cardpay"'+(d.method==='cardpay'?' selected':'')+'>'+t('cardpay')+'</option></select></div><div class="recLbl">'+t('method')+' '+ic('banknote',16)+'</div></div>';
 const cardInner=custInput+'<div style="height:10px"></div>'+amtInput+'<div style="height:10px"></div>'+noteInput;
 const warnHtml='<div style="text-align:center;color:#c0392b;font-weight:800;font-size:13px;margin:14px 18px 6px;line-height:1.6">يرجى التأكد من صحة البيانات قبل الحفظ والتأكيد!</div>';
 const allCustsForChips=(r.cands&&r.cands.length?r.cands:custOpts.slice(0,5));
 const candHtml=allCustsForChips.length&&!isP()?'<div style="padding:0 16px"><div style="text-align:end;font-weight:800;font-size:13px;color:var(--soft);margin:12px 2px 8px">اختر المقصود:</div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">'+allCustsForChips.map(c=>'<button class="candPill '+(c.id===d.custId?'on':'')+'" onclick="ui.rec.d.custId=\''+c.id+'\';ui.rec.d.name=\''+esc(c.name)+'\';render()">'+esc(c.name)+'</button>').join('')+'</div></div>':'';
 const newBtnHtml='<div style="padding:0 16px;margin-top:12px;display:flex;justify-content:flex-end"><button class="candPill recDash" onclick="recNewCust()" style="font-size:13px">+ عميل جديد</button></div>';
 const bottomBar='<div style="display:flex;gap:10px;align-items:center;padding:16px 16px 18px"><button class="recX" onclick="cancelRec()">'+ic('x',16)+'</button><button class="recBtnEdit" onclick="recToggleEdit()">'+ic('edit',14)+' تعديل</button><button class="recBtnConfirm" onclick="recConfirm()">'+ic('checkc',18)+' تأكيد</button></div>';
 const engineErr=(r.engineError?'<div class="pad"><div class="card" style="padding:12px 14px;background:var(--amber-bg);border:1px solid var(--amber-line);border-radius:14px"><div style="display:flex;gap:8px;align-items:center;font-weight:900;color:var(--amber);font-size:13px">'+ic('warn',16)+' '+t('voskNo')+'</div><div class="muted" style="font-size:12px;margin-top:6px;line-height:1.6">'+t('webNo')+'</div></div></div>':'');
 return recStyle+headerBar(t('recDebt'),null,'cancelRec()')
 +'<div class="recWrap">'+topWave
 +'<div class="pad"><div class="recCard">'+cardInner+'</div></div>'
 +warnHtml
 +candHtml
 +newBtnHtml
 +engineErr
 +bottomBar
 +'</div>';};
function recToggleEdit(){const r=ui.rec;if(!r) return; if(r.edit) readRecFields(); r.edit=!r.edit; render();}
function readRecFields(){const r=ui.rec;const rc=document.getElementById('re_c');if(rc){r.d.custId=rc.value;r.d.name=rc.selectedOptions[0].text} else {const rct=document.getElementById('re_c_txt'); if(rct){ const nm=rct.value.trim(); if(nm) r.d.name=nm; const hit=DD().customers.find(c=>c.name===nm); if(hit) r.d.custId=hit.id; }}const ra=document.getElementById('re_a');if(ra)r.d.amt=Money.parse(ra.value);if(r.kind==='debt'){const rn=document.getElementById('re_n');if(rn)r.d.note=rn.value;} else {const rm=document.getElementById('re_m'); if(rm) r.d.method=rm.value;}}
function cancelRec(){clearTimeout(recEnd);if(window.voskEngine&&window.voskEngine.stop)window.voskEngine.stop();stopMicMeter();clearInterval(window.__recTick);ui.rec=null;back()}
function recConfirm(){const r=ui.rec;readRecFields();const c=isP()?null:(cust(r.d.custId)||cust(ctxCust()));if((!c&&!isP())||!r.d.amt){toastMsg(t('chooseFirst'));return}
 learnCorrection(r.d.say,r.d.amt);
 if(r.kind==='debt'){const now2=Date.now();const inv={id:uid(),code:'A'+(DD().seq++),cust:c?c.id:null,ts:now2,createdAt:now2,hasTime:true,amount:r.d.amt,note:r.d.note,due:null,src:r.src||'voice'};DD().invoices.push(inv);save();feedback('debt');speak((c?c.name+'، ':'')+t('newDebt')+' '+r.d.amt+' '+CUR());ui.rec=null;stack=[c?{s:'profile',p:{id:c.id}}:{s:'home'}];render();doneSnack('debt',inv.id,c?c.id:null,inv.amount)}
 else{const amt=r.d.amt;const open=c?custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts):[];let left=amt;const alloc=[];open.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});const now3=Date.now();const pyv={id:uid(),cust:c?c.id:null,ts:now3,createdAt:now3,hasTime:true,amount:amt,method:r.d.method||'cash',alloc,src:'voice'};DD().payments.push(pyv);save();feedback('pay');doneSnack('pay',pyv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('pay')+' '+r.d.amt+' '+CUR());ui.rec=null;ui.pay={cust:null,amt:'',method:'cash',done:{cid:c?c.id:null,cname:c?c.name:t('deposit'),amt,after:c?custOpen(c.id):0}};stack=[{s:'pay'}];render()}}
