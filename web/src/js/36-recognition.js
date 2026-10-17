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
 const inv={id:uid(),code:'A'+(DD().seq++),cust:c.id,ts:Date.now(),amount:v.d.amt,note:v.d.note};DD().invoices.push(inv);save();feedback('debt');
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
 goWiz(kind,ctxCust())}}
function startRec(kind,custId){ui.rec={kind,st:'rec',edit:false,d:{},cands:[],pre:custId||null,t0:Date.now()};window.__wvCol=kind==='debt'?'#a71949':'#0e7a52';go('rec',{kind});clearTimeout(recEnd);
 clearInterval(window.__recTick);window.__recTick=setInterval(()=>{if(!ui.rec||ui.rec.st!=='rec')return;const el=document.getElementById('recT');const sc=Math.floor((Date.now()-ui.rec.t0)/1000);if(el)el.textContent=('0'+Math.floor(sc/60)).slice(-2)+':'+('0'+sc%60).slice(-2);const rf=document.getElementById('recFields');if(rf)rf.innerHTML=recFieldsHtml();if(sc>=30){toastMsg(t('recLong'));endRec()}},500);
 startMicMeter();
 if(sec.vosk){if(window.voskEngine&&window.voskEngine.ready){window.voskEngine.start(kind,custId);return}
  toastMsg(t('voskLoad'));libLoad('lib/vosk-browser.js').then(()=>{window.voskReinit&&window.voskReinit();setTimeout(()=>{if(window.voskEngine&&window.voskEngine.ready){window.voskEngine.start(kind,custId)}else toastMsg(t('voskNo'))},300)}).catch(()=>toastMsg(t('voskNo')));return}
 if(tryWebASR(kind))return;
 recEnd=setTimeout(endRec,2600)}
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
 r0.st='edit';render()}
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
 r.st='edit';render()}
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
 if(r.st==='rec')return headerBar('<span class="recdot"></span>'+(r.kind==='debt'?t('recDebt'):t('recPay')),null,'cancelRec()',null,'<span class="num" id="recT" style="font-weight:900;font-size:15px;color:var(--red);min-width:52px;text-align:end">00:00</span>')
 +'<div class="micwrap"><button class="mic live" style="background:radial-gradient(circle at 35% 30%,#5c1030,#7a1236 70%);box-shadow:0 14px 34px rgba(167,25,73,.35),0 0 0 10px rgba(167,25,73,.08)">'+ic('mic',50)+'</button><canvas id="wv" width="260" height="40" style="margin:4px auto 0;display:block"></canvas><div class="wave red" id="wvfall">'+waveHtml()+'</div><div class="transcript" id="liveTx" aria-live="polite" style="min-height:22px"></div><div style="font-weight:800;color:var(--red)">'+t('recOn')+'</div><div class="muted" style="margin-top:10px;text-align:center;line-height:1.8;padding:0 28px">'+t('voiceHint')+'</div></div>'
 +'<div class="pad" style="margin-top:12px"><div class="card" style="padding:10px 16px" id="recFields">'+recFieldsHtml()+'</div></div>'
 +'<div class="card" style="margin:12px 16px 0;padding:10px 14px;text-align:start"><div style="font-weight:900;font-size:12.5px;color:var(--navy)">'+ic('shield',14)+' '+t('strictT')+'</div><div class="muted" style="margin-top:6px;font-size:11.5px;line-height:1.9;white-space:pre-line">'+t('strictRules')+'</div></div>'
 +'<div style="display:flex;gap:10px;padding:14px 16px 6px"><button class="btn btn-line" style="flex:1" onclick="cancelRec()">'+ic('x',16)+t('cancel')+'</button><button class="btn '+(r.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.4" onclick="endRec()">'+ic('checkc',16)+t('recStop')+'</button></div>'
 +'<div class="pad" style="padding:0 16px 18px"><button class="btn btn-soft" style="width:100%" onclick="openExtSheet()">'+ic('mic',16)+' '+t('extBtn')+'</button></div>';
 const d=r.d;
 const rows=r.st==='edit'?
 (!isP()?'<div class="kv"><span class="k">'+ic('user',16)+t('cust')+'</span><span class="v" style="min-width:55%"><select class="inp" style="padding:8px 10px" id="re_c">'+DD().customers.filter(c=>!c.archived).map(c=>'<option value="'+c.id+'"'+(c.id===d.custId?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></span></div>':'')
 +'<div class="kv"><span class="k">'+ic('wallet',16)+t('amount')+'</span><span class="v" style="min-width:35%"><input class="inp num" style="padding:8px 10px" id="re_a" type="number" value="'+(d.amt?Money.dec(d.amt):'')+'"></span></div>'
 +(r.kind==='debt'?'<div class="kv"><span class="k">'+ic('tag',16)+t('remind')+'</span><span class="v" style="min-width:55%"><input class="inp" style="padding:8px 10px" id="re_n" value="'+esc(d.note)+'" placeholder="'+t('remindPh')+'"></span></div><div class="kv"><span class="k">'+ic('cal',16)+t('due')+'</span><span class="v" style="min-width:45%"><input class="inp num" style="padding:8px 10px" type="date" id="re_d" value="'+(d.due?new Date(d.due).toISOString().slice(0,10):'')+'"></span></div>':'')
 :
 '<div class="kv"><span class="kic">'+ic('user',17)+'</span><span class="k">'+t('cust')+'</span><span class="v">'+esc(d.name)+'</span></div>'
 +'<div class="kv"><span class="kic" style="color:'+(r.kind==='debt'?'var(--red)':'var(--green)')+'">'+ic('wallet',17)+'</span><span class="k">'+t('amount')+'</span><span class="v amt '+(r.kind==='debt'?'red':'green')+'">'+money(d.amt)+'</span></div>'
 +(r.kind==='debt'&&d.due?'<div class="kv"><span class="kic" style="color:var(--amber)">'+ic('cal',17)+'</span><span class="k">'+t('due')+'</span><span class="v">'+dateStr(d.due)+(Date.now()>d.due?' · <b style="color:var(--red)">'+t('overdue')+'</b>':'')+'</span></div>':'')
 +(r.kind==='debt'?'<div class="kv"><span class="kic">'+ic('tag',17)+'</span><span class="k">'+t('remind')+'</span><span class="v">'+esc(d.note)+'</span></div>':'<div class="kv"><span class="kic">'+ic('banknote',17)+'</span><span class="k">'+t('method')+'</span><span class="v">'+t(d.method||'cash')+'</span></div>');
 const impact=r.kind==='pay'?payImpactFor(d.custId,d.amt):'';
 return headerBar(r.kind==='debt'?t('recDebt'):t('recPay'),null,'cancelRec()')
 +'<div class="micwrap" style="padding-top:8px"><div class="wave red" style="opacity:.45">'+waveHtml()+'</div><div class="transcript">'+t('heard')+' «'+esc(d.say)+'»</div></div>'
 +(r.warn?'<div class="card" style="margin:10px 16px 0;padding:10px 14px;background:var(--amber-bg)"><div style="font-weight:900;color:var(--amber);font-size:12.5px">⚠ '+t('warn_'+r.warn)+'</div><div class="muted" style="font-size:11.5px;margin-top:4px">'+t('strictFix')+'</div></div>':'')
 +'<div class="pad"><div class="card" style="padding:5px 16px">'+rows+'</div>'
 +(r.cands.length&&!isP()?'<div class="muted" style="margin:10px 2px 4px;font-weight:700">'+t('cand')+'</div><div class="cand">'+r.cands.map(c=>'<button class="'+(c.id===d.custId?'on':'')+'" onclick="ui.rec.d.custId=\''+c.id+'\';ui.rec.d.name=\''+esc(c.name)+'\';render()">'+esc(c.name)+'</button>').join('')+'<button onclick="recNewCust()">+ '+t('addC')+'</button>'+'</div>':'')
 +impact
 +'<div style="display:flex;gap:10px;margin-top:14px"><button class="btn '+(r.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.4" onclick="recConfirm()">'+ic('checkc',18)+(r.kind==='debt'?t('confirmReg'):t('confirmPay'))+'</button><button class="btn btn-line" style="flex:1" onclick="retryRec()">'+ic('mic',16)+t('retryRec')+'</button><button class="hbtn" onclick="cancelRec()">'+ic('x',18)+'</button></div>'
 +'<div class="muted" style="text-align:center;margin-top:12px">'+ic('lock',12)+' '+t('privacyC')+'</div></div>';};
function readRecFields(){const r=ui.rec;const rc=document.getElementById('re_c');if(rc){r.d.custId=rc.value;r.d.name=rc.selectedOptions[0].text}const ra=document.getElementById('re_a');if(ra)r.d.amt=Money.parse(ra.value);if(r.kind==='debt'){const rn=document.getElementById('re_n');if(rn)r.d.note=rn.value;const rd=document.getElementById('re_d');if(rd)r.d.due=rd.value?new Date(rd.value+'T12:00:00').getTime():null}}
function cancelRec(){clearTimeout(recEnd);if(window.voskEngine&&window.voskEngine.stop)window.voskEngine.stop();stopMicMeter();clearInterval(window.__recTick);ui.rec=null;back()}
function recConfirm(){const r=ui.rec;readRecFields();const c=isP()?null:(cust(r.d.custId)||cust(ctxCust()));if((!c&&!isP())||!r.d.amt){toastMsg(t('chooseFirst'));return}
 learnCorrection(r.d.say,r.d.amt);
 if(r.kind==='debt'){const inv={id:uid(),code:'A'+(DD().seq++),cust:c?c.id:null,ts:Date.now(),amount:r.d.amt,note:r.d.note,due:r.d.due||null,src:r.src||'voice'};DD().invoices.push(inv);save();feedback('debt');speak((c?c.name+'، ':'')+t('newDebt')+' '+r.d.amt+' '+CUR());ui.rec=null;stack=[c?{s:'profile',p:{id:c.id}}:{s:'home'}];render();doneSnack('debt',inv.id,c?c.id:null,inv.amount)}
 else{const amt=r.d.amt;const open=c?custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts):[];let left=amt;const alloc=[];open.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});const pyv={id:uid(),cust:c?c.id:null,ts:Date.now(),amount:amt,method:r.d.method||'cash',alloc,src:'voice'};DD().payments.push(pyv);save();feedback('pay');doneSnack('pay',pyv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('pay')+' '+r.d.amt+' '+CUR());ui.rec=null;ui.pay={cust:null,amt:'',method:'cash',done:{cid:c?c.id:null,cname:c?c.name:t('deposit'),amt,after:c?custOpen(c.id):0}};stack=[{s:'pay'}];render()}}
