/* ---- voice ---- */
const S_voice=p=>{const v=ui.voice;const pre=p&&p.cust?cust(p.cust):null;let body='';
 if(v.st==='idle'){body='<div class="micwrap"><button class="mic" data-action="voice.start">'+ic('mic',50)+'</button><div class="wave" style="opacity:.25">'+waveHtml()+'</div><div style="font-weight:700;margin-top:6px">'+t('tapMic')+'</div><div class="transcript" style="background:var(--card2);border-color:var(--line);color:var(--soft)">'+t('example')+'</div><div class="muted" style="margin-top:10px;text-align:center;line-height:1.8;padding:0 28px">'+t('voiceHint')+'</div></div>';}
 else if(v.st==='listen'){body='<div class="micwrap"><button class="mic live">'+ic('mic',50)+'</button><div class="wave">'+waveHtml()+'</div><div style="font-weight:800;color:var(--green)">'+t('listening')+'</div></div>';}
 else{const d=v.d;body='<div class="micwrap" style="padding-top:8px"><div class="wave" style="opacity:.5">'+waveHtml()+'</div><div class="transcript">'+t('heard')+' «'+esc(d.say)+'»</div></div>'
 +'<div class="pad"><div class="card" style="padding:5px 16px">'+(v.edit?
 '<div class="kv"><span class="k">'+ic('user',16)+t('cust')+'</span><span class="v" style="min-width:55%"><select class="inp" style="padding:8px 10px" id="ve_c">'+DD().customers.filter(c=>!c.archived).map(c=>'<option value="'+c.id+'"'+(c.id===d.custId?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></span></div>'
 +'<div class="kv"><span class="k">'+ic('wallet',16)+t('amount')+'</span><span class="v" style="min-width:35%"><input class="inp num" style="padding:8px 10px" id="ve_a" type="number" value="'+(d.amt?Money.dec(d.amt):'')+'"></span></div>'
 +'<div class="kv"><span class="k">'+ic('tag',16)+t('remind')+'</span><span class="v" style="min-width:55%"><input class="inp" style="padding:8px 10px" id="ve_n" value="'+esc(d.note)+'" placeholder="'+t('remindPh')+'"></span></div>'
 :(!isP()?'<div class="kv"><span class="kic">'+ic('user',17)+'</span><span class="k">'+t('cust')+'</span><span class="v">'+esc(d.name)+'</span></div>':'')
 +'<div class="kv"><span class="kic" style="color:var(--red)">'+ic('wallet',17)+'</span><span class="k">'+t('amount')+'</span><span class="v amt red">'+money(d.amt)+'</span></div>'
 +'<div class="kv"><span class="kic">'+ic('tag',17)+'</span><span class="k">'+t('remind')+'</span><span class="v">'+esc(d.note)+'</span></div>')+'</div>'
 +(v.cands.length&&!v.edit?'<div class="muted" style="margin:10px 2px 4px;font-weight:700">'+t('cand')+'</div><div class="cand">'+v.cands.map(c=>'<button class="'+(c.id===v.d.custId?'on':'')+'" data-action="voice.customer" data-customer="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div>':'')
 +'<div style="display:flex;gap:12px;margin-top:14px"><button class="btn btn-red" style="flex:1.5" data-action="voice.confirm">'+ic('checkc',18)+t('confirmReg')+'</button><button class="btn btn-line" style="flex:1" data-action="voice.edit">'+ic('edit',17)+t('editL')+'</button><button class="hbtn" data-action="voice.clear">'+ic('x',18)+'</button></div>'
 +'<div class="muted" style="text-align:center;margin-top:13px">'+ic('lock',12)+' '+speechPrivacyHint()+'</div></div>';}
 return headerBar(t('voiceTitle'),pre?esc(pre.name):null,{action:'nav.back'})+body;};
function waveHtml(){let s='';for(let i=0;i<26;i++)s+='<i style="--d:'+(i*0.07)+'s;--h:'+(8+((i*37)%26))+'px"></i>';return s}
function speechPrivacyHint(){return SpeechService.selected==='web'?(db.lang==='ar'?'التعرف عبر المتصفح قد يستخدم خدمة عبر الإنترنت.':'Browser speech recognition may use an online service.'):t('privacyC')}
let speechScreen=null;
function voiceStart(){
 if(SpeechService.busy)return;
 speechScreen='voice';ui.voice.st='listen';ui.voice.edit=false;render();
 const view=ui.voice;
 SpeechService.listen({language:db.lang}).then(text=>{
  if(ui.voice!==view||view.st!=='listen'||curScr().s!=='voice')return;
  view.st='idle';extSay(text);
 }).catch(error=>{
  if(ui.voice!==view||view.st!=='listen')return;
  view.st='idle';if(error.name!=='AbortError')toastMsg(esc(error.message));render();
 });
}
function voiceToggleEdit(){const v=ui.voice;if(v.edit){v.d.custId=document.getElementById('ve_c').value;v.d.name=document.getElementById('ve_c').selectedOptions[0].text;v.d.amt=Money.parse(document.getElementById('ve_a').value);v.d.note=document.getElementById('ve_n').value;}v.edit=!v.edit;render()}
async function voiceConfirm(){const v=ui.voice;if(v.edit)voiceToggleEdit();const c=cust(v.d.custId)||cust(ctxCust());if(!c||!v.d.amt){toastMsg(t('chooseFirst'));return}
 const inv={id:uid(),code:'A'+DD().seq,cust:c.id,ts:Date.now(),amount:v.d.amt,note:v.d.note};try{await LedgerEdits.insert('invoices',inv,true)}catch(e){storageFailure();return}feedback('debt');
 ui.voice={st:'idle',demo:ui.voice.demo,edit:false,d:{},cands:[]};stack=[{s:'profile',p:{id:c.id}}];render();
 doneSnack('debt',inv.id,c?c.id:null,inv.amount);}
/* ---- pay ---- */
/* ---- long-press recording ---- */
let recPend=null,recEnd=null;
const DEMOP=[{name:'أبو خالد',amt:20,note:'',say:'أبو خالد سدد عشرين ريال نقدًا'}];
let touchSeen=0;const lpLast={t:0,k:''};
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
function createRecordingView(kind,custId){
 clearTimeout(recEnd);clearInterval(window.__recTick);
 ui.rec={kind,st:'rec',edit:false,d:{},cands:[],pre:custId||null,t0:Date.now()};
 window.__wvCol=kind==='debt'?'#a71949':'#0e7a52';go('rec',{kind});
 return ui.rec;
}
function startRec(kind,custId){
 if(SpeechService.busy){toastMsg('يوجد تسجيل أو تعرّف جارٍ');return}
 speechScreen='rec';const recording=createRecordingView(kind,custId);
 SpeechService.listen({language:db.lang,onPartial:text=>{
  if(ui.rec!==recording||recording.st!=='rec')return;
  const el=document.getElementById('liveTx');if(el)el.textContent=t('heard')+' «'+text+'»';
 }}).then(text=>{
  if(ui.rec!==recording||recording.st!=='rec'||curScr().s!=='rec')return;
  clearInterval(window.__recTick);handleSay(kind,text,null);
 }).catch(error=>{
  if(ui.rec!==recording||recording.st!=='rec')return;
  clearInterval(window.__recTick);
  if(error.name!=='AbortError')toastMsg(esc(error.message));
  finishRec();
 });
}
function retryRec(){const old=ui.rec;if(!old)return;const kind=old.kind,pre=old.pre;ui.rec=null;SpeechService.cancel();if(curScr().s==='rec')stack.pop();startRec(kind,pre)}
window.addEventListener('daftari-speech-state',event=>{
 const state=event.detail;
 const labels=db.lang==='ar'?{initializing:'جارٍ تجهيز محرك الصوت…',starting:'بانتظار الميكروفون…',listening:'جارٍ التسجيل',stopping:'جارٍ استخراج النص…'}:{initializing:'Preparing speech engine…',starting:'Waiting for microphone…',listening:'Recording',stopping:'Transcribing…'};
 const el=document.getElementById('speechStatus');if(el)el.textContent=(labels[state.status]||'')+(state.engine==='web'?' · '+speechPrivacyHint():'');
 clearInterval(window.__recTick);
 if(state.status==='listening'&&ui.rec&&ui.rec.st==='rec'){
  const recording=ui.rec;recording.t0=Date.now();
  window.__recTick=setInterval(()=>{
   if(ui.rec!==recording||recording.st!=='rec')return;
   const timer=document.getElementById('recT');const seconds=Math.floor((Date.now()-recording.t0)/1000);
   if(timer)timer.textContent=('0'+Math.floor(seconds/60)).slice(-2)+':'+('0'+seconds%60).slice(-2);
  },500);
 }
});
window.addEventListener('daftari-render',event=>{
 const screen=event.detail&&event.detail.screen;
 if((SpeechService.busy&&screen!==speechScreen)||(screen!=='rec'&&screen!=='voice')){
  if(ui.rec&&ui.rec.st==='rec')ui.rec=null;
  ui.voice.st='idle';clearInterval(window.__recTick);SpeechService.cancel();
 }
});
window.addEventListener('daftari-speech-background',()=>{
 clearTimeout(recPend);recPend=null;clearTimeout(recEnd);clearInterval(window.__recTick);
 ui.voice.st='idle';
 if(ui.rec&&ui.rec.st==='rec'){ui.rec=null;if(curScr().s==='rec')back()}
 else if(curScr().s==='voice')render();
});
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
 clearInterval(window.__recTick);SpeechService.cancel();
 const pr=parseSay(text||'');let warn=null;
 if(!text||!String(text).trim())warn='nospeech';else if(pr.amt<=0)warn='noamt';else if(pr.amt>1000000)warn='toobig';else if((conf==null?1:conf)<0.45)warn='lowconf';
 r0.warn=warn;if(warn)toastMsg(t('warn_'+warn));
 r0.d=kind==='debt'?{name:pr.name,amt:pr.amt,note:pr.note,due:null,say:text,custId:pr.custId}:{name:pr.name,amt:pr.amt,method:'cash',say:text,custId:pr.custId};
 r0.st='edit';render()}
/* ---- integration with the phone's own STT engine (VOSK app): paste or share text ---- */
function extSay(text){text=String(text||'').trim();if(!text)return false;
 const kind=/سداد|سدّد|ادفع|إيداع|ايداع|pay|deposit/i.test(text)?'pay':'debt';
 SpeechService.cancel();
 if(!ui.rec||ui.rec.st!=='rec')createRecordingView(kind,ctxCust());
 handleSay(kind,text,null);return true}
window.openExtSheet=()=>{openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('extT')+'</h3><span class="sp"></span><button class="hbtn" data-action="sheet.close">'+ic('x',17)+'</button></div><div class="muted" style="font-size:12px;line-height:1.8;margin-bottom:8px">'+t('extD')+'</div><textarea id="extTx" class="inp" style="min-height:90px;resize:vertical" placeholder="'+t('extPh')+'"></textarea><button class="btn btn-navy" style="margin-top:10px" data-action="speech.paste.apply"">'+ic('mic',16)+' '+t('extGo')+'</button>')}

window.voskImpMsg=(lib,model)=>t(lib&&model?'voskImpBoth':lib?'voskImpLib':model?'voskImpModel':'voskImpNone');
window.projPick=()=>{
 if(window.DaftariBridge){NativeActions.importProject();return}
 toastMsg(esc('استيراد حزم المشروع متاح في تطبيق Android؛ تشغيل HTML مستورد هنا غير مسموح.'));
};
function endRec(){
 if(!ui.rec||ui.rec.st!=='rec')return;
 if(SpeechService.busy){SpeechService.stop();return}
 finishRec();
}
function finishRec(){const r=ui.rec;if(!r||r.st!=='rec')return;
 clearInterval(window.__recTick);clearTimeout(recEnd);
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
 if(r.st==='rec')return headerBar('<span class="recdot"></span>'+(r.kind==='debt'?t('recDebt'):t('recPay')),null,{action:'record.cancel'},null,'<span class="num" id="recT" style="font-weight:900;font-size:15px;color:var(--red);min-width:52px;text-align:end">00:00</span>')
 +'<div class="micwrap"><button class="mic live" style="background:radial-gradient(circle at 35% 30%,#5c1030,#7a1236 70%);box-shadow:0 14px 34px rgba(167,25,73,.35),0 0 0 10px rgba(167,25,73,.08)">'+ic('mic',50)+'</button><div class="wave red" id="wvfall">'+waveHtml()+'</div><div class="transcript" id="liveTx" aria-live="polite" style="min-height:22px"></div><div id="speechStatus" role="status" style="font-weight:800;color:var(--red)">'+t('recOn')+'</div><div class="muted" style="margin-top:10px;text-align:center;line-height:1.8;padding:0 28px">'+t('voiceHint')+'</div></div>'
 +'<div class="pad" style="margin-top:12px"><div class="card" style="padding:10px 16px" id="recFields">'+recFieldsHtml()+'</div></div>'
 +'<div class="card" style="margin:12px 16px 0;padding:10px 14px;text-align:start"><div style="font-weight:900;font-size:12.5px;color:var(--navy)">'+ic('shield',14)+' '+t('strictT')+'</div><div class="muted" style="margin-top:6px;font-size:11.5px;line-height:1.9;white-space:pre-line">'+t('strictRules')+'</div></div>'
 +'<div style="display:flex;gap:10px;padding:14px 16px 6px"><button class="btn btn-line" style="flex:1" data-action="record.cancel">'+ic('x',16)+t('cancel')+'</button><button class="btn '+(r.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.4" data-action="record.stop">'+ic('checkc',16)+t('recStop')+'</button></div>'
 +'<div class="pad" style="padding:0 16px 18px"><button class="btn btn-soft" style="width:100%" data-action="speech.paste.open">'+ic('mic',16)+' '+t('extBtn')+'</button></div>';
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
 return headerBar(r.kind==='debt'?t('recDebt'):t('recPay'),null,{action:'record.cancel'})
 +'<div class="micwrap" style="padding-top:8px"><div class="wave red" style="opacity:.45">'+waveHtml()+'</div><div class="transcript">'+t('heard')+' «'+esc(d.say)+'»</div></div>'
 +(r.warn?'<div class="card" style="margin:10px 16px 0;padding:10px 14px;background:var(--amber-bg)"><div style="font-weight:900;color:var(--amber);font-size:12.5px">⚠ '+t('warn_'+r.warn)+'</div><div class="muted" style="font-size:11.5px;margin-top:4px">'+t('strictFix')+'</div></div>':'')
 +'<div class="pad"><div class="card" style="padding:5px 16px">'+rows+'</div>'
 +(r.cands.length&&!isP()?'<div class="muted" style="margin:10px 2px 4px;font-weight:700">'+t('cand')+'</div><div class="cand">'+r.cands.map(c=>'<button class="'+(c.id===d.custId?'on':'')+'" data-action="record.customer" data-customer="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'<button data-action="record.new-customer">+ '+t('addC')+'</button>'+'</div>':'')
 +impact
 +'<div style="display:flex;gap:10px;margin-top:14px"><button class="btn '+(r.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.4" data-action="record.confirm">'+ic('checkc',18)+(r.kind==='debt'?t('confirmReg'):t('confirmPay'))+'</button><button class="btn btn-line" style="flex:1" data-action="record.retry">'+ic('mic',16)+t('retryRec')+'</button><button class="hbtn" data-action="record.cancel">'+ic('x',18)+'</button></div>'
 +'<div class="muted" style="text-align:center;margin-top:12px">'+ic('lock',12)+' '+speechPrivacyHint()+'</div></div>';};
function readRecFields(){const r=ui.rec;const rc=document.getElementById('re_c');if(rc){r.d.custId=rc.value;r.d.name=rc.selectedOptions[0].text}const ra=document.getElementById('re_a');if(ra)r.d.amt=Money.parse(ra.value);if(r.kind==='debt'){const rn=document.getElementById('re_n');if(rn)r.d.note=rn.value;const rd=document.getElementById('re_d');if(rd)r.d.due=rd.value?new Date(rd.value+'T12:00:00').getTime():null}}
function cancelRec(){clearTimeout(recEnd);clearInterval(window.__recTick);ui.rec=null;SpeechService.cancel();back()}
async function recConfirm(){const r=ui.rec;readRecFields();const c=isP()?null:(cust(r.d.custId)||cust(ctxCust()));if((!c&&!isP())||!r.d.amt){toastMsg(t('chooseFirst'));return}
 learnCorrection(r.d.say,r.d.amt);
 if(r.kind==='debt'){const inv={id:uid(),code:'A'+DD().seq,cust:c?c.id:null,ts:Date.now(),amount:r.d.amt,note:r.d.note,due:r.d.due||null,src:r.src||'voice'};try{await LedgerEdits.insert('invoices',inv,true)}catch(e){storageFailure();return}feedback('debt');speak((c?c.name+'، ':'')+t('newDebt')+' '+r.d.amt+' '+CUR());ui.rec=null;stack=[c?{s:'profile',p:{id:c.id}}:{s:'home'}];render();doneSnack('debt',inv.id,c?c.id:null,inv.amount)}
 else{const amt=r.d.amt;const open=c?custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts):[];let left=amt;const alloc=[];open.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});const pyv={id:uid(),cust:c?c.id:null,ts:Date.now(),amount:amt,method:r.d.method||'cash',alloc,src:'voice'};try{await LedgerEdits.insert('payments',pyv)}catch(e){storageFailure();return}feedback('pay');doneSnack('pay',pyv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('pay')+' '+r.d.amt+' '+CUR());ui.rec=null;ui.pay={cust:null,amt:'',method:'cash',done:{cid:c?c.id:null,cname:c?c.name:t('deposit'),amt,after:c?custOpen(c.id):0}};stack=[{s:'pay'}];render()}}
const __dd={};const dedupe=k=>{const n=Date.now();if(__dd.k===k&&n-(__dd.t||0)<700)return true;__dd.k=k;__dd.t=n;return false};
function repRangeCalc(){const rp=ui.rp||{};const now=new Date();const d0=new Date();d0.setHours(0,0,0,0);const mode=rp.mode||'week';let a,b;
 if(mode==='day'){const d=rp.day?new Date(rp.day+'T00:00:00'):new Date(d0);a=+d;b=a+D}
 else if(mode==='week'){const d=rp.day?new Date(rp.day+'T00:00:00'):new Date(d0);a=+d;b=a+7*D}
 else if(mode==='range'){a=rp.from?+new Date(rp.from+'T00:00:00'): +d0;b=(rp.to?+new Date(rp.to+'T00:00:00'): +d0)+D;if(a>b){const t2=a;a=b;b=t2}}
 else{const d=rp.month?new Date(rp.month+'-01T00:00:00'):new Date(now.getFullYear(),now.getMonth(),1);a=+d;b=+new Date(d.getFullYear(),d.getMonth()+1,1)}
 return [a,b]}
function repData(){const rp=ui.rp||{};const [a,b]=repRangeCalc();const cid=rp.cust||null;
 const invs=DD().invoices.filter(i=>!i.arch&&i.ts>=a&&i.ts<b&&(!cid||i.cust===cid));
 const pays=DD().payments.filter(p=>p.ts>=a&&p.ts<b&&(!cid||p.cust===cid));
 return {a,b,invs,pays,debt:invs.reduce((x,i)=>x+i.amount,0),pay:pays.reduce((x,p)=>x+p.amount,0)}}
function repNm(id){const c=id?cust(id):null;return c?c.name:t('deposit')}
function repRows(){const r=repData();const rows=[[t('date'),t('time'),t('cust'),t('type'),CUR(),t('remind')]];
 [...r.invs.map(i=>({ts:i.ts,nm:repNm(i.cust),ty:t('debt'),amt:i.amount,note:i.note||''})),...r.pays.map(p=>({ts:p.ts,nm:repNm(p.cust),ty:t('pay'),amt:p.amount,note:''}))].sort((x,y)=>y.ts-x.ts).forEach(x=>rows.push([dateStr(x.ts),timeStr(x.ts),x.nm,x.ty,fmt(x.amt),x.note]));
 return rows}
function exportRepXlsx(){if(typeof XLSX==='undefined'){toastMsg('Excel');return}try{const ws=XLSX.utils.aoa_to_sheet(repRows());const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'report');XLSX.writeFile(wb,'dafter-report.xlsx');toastMsg(t('done'))}catch(e){toastMsg('Excel')}}
function printRep(){const r=repData();const rows=repRows().slice(1);const hd=repRows()[0].map(c=>'<th style="padding:6px 8px;text-align:right">'+esc(c)+'</th>').join('');
 document.getElementById('printArea').innerHTML='<div style="font-family:system-ui;direction:rtl;padding:18px"><div style="font-weight:900;font-size:19px;color:#12294a">'+esc(curAcc().name)+' — '+t('repB')+'</div><div style="color:#555;font-size:12px;margin-top:4px">'+dateStr(r.a)+' ← '+dateStr(r.b-1)+(ui.rp&&ui.rp.cust?' · '+esc(repNm(ui.rp.cust)):'')+'</div><div style="display:flex;gap:14px;margin:12px 0;font-weight:800;font-size:13px"><span style="color:#a71949">'+t('repDebtSum')+': '+fmt(r.debt)+'</span><span style="color:#0e7a52">'+t('repPaySum')+': '+fmt(r.pay)+'</span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#eef2f7">'+hd+'</tr>'+rows.map(x=>'<tr style="border-bottom:1px solid #e3e6ea">'+x.map(c=>'<td style="padding:6px 8px">'+esc(String(c))+'</td>').join('')+'</tr>').join('')+'</table></div>';
 window.print()}
function openRepCust(){openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('cust')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<button class="srow" onclick="ui.rp.cust=null;closeSheet();render()"><span class="sic2" style="background:var(--navy-bg);color:var(--navy)">'+ic('users',20)+'</span><span class="sp" style="text-align:start"><span class="t">'+t('repCustAll')+'</span></span>'+(!ui.rp.cust?ic('checkc',18):'')+'</button>'
 +DD().customers.filter(c=>!c.archived).map(c=>'<button class="srow" onclick="ui.rp.cust=\''+c.id+'\';closeSheet();render()"><span class="sic2">'+avat(c.name,26)+'</span><span class="sp" style="text-align:start"><span class="t">'+esc(c.name)+'</span></span>'+(ui.rp.cust===c.id?ic('checkc',18):'')+'</button>').join(''))}
function repBars(r){const days=Math.min(31,Math.max(1,Math.round((r.b-r.a)/D)));const bw=(r.b-r.a)/days;const buckets=[...Array(days)].map(()=>({d:0,p:0}));
 r.invs.forEach(i=>{const k=Math.min(days-1,Math.floor((i.ts-r.a)/bw));buckets[k].d+=i.amount});
 r.pays.forEach(p=>{const k=Math.min(days-1,Math.floor((p.ts-r.a)/bw));buckets[k].p+=p.amount});
 const mx=Math.max(1,...buckets.map(b=>Math.max(b.d,b.p)));
 return '<div style="display:flex;align-items:flex-end;gap:4px;height:96px;margin-top:12px">'+buckets.map(b=>'<div style="flex:1;display:flex;gap:2px;align-items:flex-end;height:100%"><div style="flex:1;background:var(--red);opacity:.85;border-radius:4px 4px 0 0;height:'+Math.max(3,b.d/mx*90)+'px"></div><div style="flex:1;background:var(--green);opacity:.85;border-radius:4px 4px 0 0;height:'+Math.max(3,b.p/mx*90)+'px"></div></div>').join('')+'</div>'}
const S_repb=p=>headerBar(t('repB'),null,'back()')+repBody();function goWiz(kind,preId){if(!isP()&&!DD().customers.some(c=>!c.archived)){toastMsg(t('noCustomers'));go('newcust',{});return}
 const solo=(()=>{const a=DD().customers.filter(c=>!c.archived);return a.length===1?a[0].id:null})();
 ui.wz={kind,step:isP()?0:((preId||solo)?1:0),custId:preId||solo,amt:'',note:'',due:'',q:'',method:'cash'};go('wiz',{});setTimeout(()=>{const a=document.getElementById('wzA');if(a)a.focus()},80)}
function wizExit(){ui.wz=null;back()}
function wzSel(id){ui.wz.custId=id;ui.wz.step=1;render();setTimeout(()=>{const a=document.getElementById('wzA');if(a)a.focus()},80)}
function wzReList(){const el=document.getElementById('wzlist');if(el){const q=normAr(ui.wz.q||'');let cs=DD().customers.filter(c=>!c.archived);if(q)cs=cs.filter(c=>normAr(c.name).includes(q)||(pdig(ui.wz.q||'').length>=3&&pdig(c.phone).endsWith(pdig(ui.wz.q))));el.innerHTML=wzListHtml(cs)}}
function wzListHtml(cs){if(!cs.length)return '<div class="muted" style="text-align:center;padding:22px 0">'+t('noResC')(esc(ui.wz.q||''))+'</div>';
 return cs.map(c=>{const o=custOpen(c.id);return '<div class="card litem" style="margin-bottom:8px" onclick="wzSel(\''+c.id+'\')">'+avat(c.name,46)+'<div class="sp"><b>'+esc(c.name)+'</b>'+(c.phone?'<div class="muted num" style="font-size:12px;margin-top:2px">'+esc(c.phone)+'</div>':'')+'</div><div style="text-align:end">'+(o>0?'<span class="amt red"><span class="num">'+fmt(o)+'</span> '+CUR()+'</span>':'<span class="amt gray"><span class="num">0.00</span> '+CUR()+'</span>')+'</div><span style="color:var(--navy)">'+ic('fwd',18)+'</span></div>'}).join('')}
function wizCustCard(){const c=cust(ui.wz.custId);if(!c)return '';return '<div class="card litem" style="margin-bottom:12px;border:1.6px solid var(--navy)" onclick="ui.wz.step=0;render()">'+avat(c.name,44)+'<div class="sp"><b>'+esc(c.name)+'</b>'+(c.phone?'<div class="muted num" style="font-size:12px;margin-top:2px">'+esc(c.phone)+'</div>':'')+'</div><span class="chip" style="background:var(--navy-bg);color:var(--navy);padding:4px 10px;font-size:11px;font-weight:800">'+t('wzCust')+'</span></div>'}
function wizNext(){render()}
function wzLive(){const el=document.getElementById('wzLive');if(el)el.innerHTML=wzLiveHtml()}
async function wizConfirm(){const wz=ui.wz;if(!wz)return;const c=isP()?null:cust(wz.custId);const amt=Money.parse(wz.amt);
 if(dedupe('wz|'+(c?c.id:'p')+'|'+amt))return;
 if(!isP()&&!c){toastMsg(t('chooseFirst'));return}if(amt<=0){toastMsg(t('enterAmt'));return}
 if(wz.kind==='debt'){const inv={id:uid(),code:'A'+DD().seq,cust:c?c.id:null,ts:Date.now(),amount:amt,note:(wz.note||'').trim(),due:wz.due?+new Date(wz.due):null,src:'manual'};try{await LedgerEdits.insert('invoices',inv,true)}catch(e){storageFailure();return}feedback('debt');doneSnack('debt',inv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('newDebt')+' '+amt+' '+CUR())}
 else{const open=c?custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts):[];let left=amt;const alloc=[];
  open.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});
  const pyv={id:uid(),cust:c?c.id:null,ts:Date.now(),amount:amt,method:wz.method,alloc,src:'manual'};try{await LedgerEdits.insert('payments',pyv)}catch(e){storageFailure();return}feedback('pay');doneSnack('pay',pyv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('pay')+' '+amt+' '+CUR())}
 ui.wz=null;tab('home')}
const S_wiz=p=>{const wz=ui.wz;if(!wz)return '<div class="pad"></div>';
 const steps=isP()?['amt']:['cust','amt'];const si=Math.min(wz.step,steps.length-1);const cur=steps[si];
 const lab={cust:t('wzCust'),amt:t('wzConf')};
 let bar='<div style="display:flex;align-items:center;gap:8px;padding:12px 22px 2px">';
 steps.forEach((k,i)=>{const done=i<si,act=i===si;
  bar+='<div style="display:flex;align-items:center;gap:7px;'+(i<steps.length-1?'flex:1':'')+'"><span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex:none;'+(done?'background:var(--green);color:#fff':act?'background:var(--navy);color:#fff':'background:var(--card);border:1.5px solid var(--line);color:var(--soft)')+'">'+(done?ic('check',14):(i+1))+'</span><span style="font-weight:800;font-size:12px;'+(act?'color:var(--navy)':done?'color:var(--green)':'color:var(--soft)')+'">'+lab[k]+'</span>'+(i<steps.length-1?'<span style="flex:1;height:2px;border-radius:2px;background:'+(done?'var(--green)':'var(--line)')+'"></span>':'')+'</div>'});
 bar+='</div>';
 let body='';
 if(cur==='cust'){body='<div class="pad search" style="margin-top:10px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('wzSearchC')+'" value="'+esc(wz.q)+'" oninput="ui.wz.q=this.value;wzReList()"></div></div><div class="pad list" id="wzlist" style="padding-bottom:12px">'+wzListHtml(DD().customers.filter(c=>!c.archived))+'</div>'}
 else{const col=wz.kind==='debt'?'var(--red)':'var(--green)';
  body='<div class="pad" style="margin-top:12px">'+(isP()?'':wizCustCard())
  +'<label class="lb">'+(wz.kind==='debt'?t('debtAmt'):t('amountNow'))+' ('+CUR()+')</label><div class="card" style="display:flex;align-items:center;border:1.8px solid '+col+'"><input id="wzA" class="num" autofocus enterkeyhint="done" style="flex:1;min-width:0;border:none;outline:none;background:none;font-size:28px;font-weight:900;padding:12px 14px" inputmode="decimal" placeholder="0.00" value="'+esc(wz.amt)+'" oninput="ui.wz.amt=this.value;wzLive()"></div><div id="wzLive">'+wzLiveHtml()+'</div>'
  +(wz.kind==='debt'?'<label class="lb">'+t('remind')+' — '+t('optF')+'</label><input class="inp" id="wzN" placeholder="'+t('remindPh')+'" value="'+esc(wz.note)+'" oninput="ui.wz.note=this.value"><label class="lb">'+t('due')+' — '+t('optF')+'</label><input class="inp num" id="wzD" type="date" style="min-width:0;font-size:13px" value="'+esc(wz.due)+'" oninput="ui.wz.due=this.value">'
  :'<label class="lb">'+t('method')+'</label><div class="seg">'+['cash','transfer','cardpay'].map(m=>'<button class="'+(wz.method===m?'on':'')+'" onclick="ui.wz.method=\''+m+'\';render()">'+t(m)+'</button>').join('')+'</div>')+'</div>'}
 let nav='<div class="bottombar" style="display:flex;gap:10px">';
 if(cur==='cust')nav+='<button class="btn btn-line" style="flex:1" onclick="wizExit()">'+ic('x',16)+t('cancel')+'</button>';
 else{nav+='<button class="btn '+(wz.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.6" onclick="wizConfirm()">'+ic('checkc',18)+(wz.kind==='debt'?t('confirmReg'):t('confirmPay'))+'</button>';
  nav+=(si>0?'<button class="btn btn-line" style="flex:1" onclick="ui.wz.step=0;render()">'+ic('back',16)+t('wzBack')+'</button>':'<button class="btn btn-line" style="flex:1" onclick="wizExit()">'+ic('x',16)+t('cancel')+'</button>')}
 nav+='</div>';
 return headerBar(wz.kind==='debt'?t('wizDebtT'):t('wizPayT'),null,'wizExit()')+bar+body+nav};
function wzLiveHtml(){const wz=ui.wz;if(!wz)return '';const amt=Money.parse(wz.amt);const c=isP()?null:cust(wz.custId);
 const before=c?custOpen(c.id):null;const after=before==null?null:(wz.kind==='debt'?before+amt:Math.max(0,before-amt));
 const hint=wz.kind==='pay'&&amt>0&&before>0?(before-amt<=0?t('willPaid'):(after<before?t('willPart'):'')):'';
 return '<div class="card" style="margin-top:12px;padding:14px 16px;background:linear-gradient(135deg,var(--navy-bg),var(--card))">'
 +'<div style="display:flex;align-items:center;gap:12px">'+(isP()?'<span class="av" style="width:40px;height:40px;background:var(--green-bg);color:var(--green)">'+ic('user',18)+'</span>':c?avat(c.name,40):'')+'<div class="sp"><b style="font-size:14px">'+(isP()?esc(curAcc().name):esc(c?c.name:''))+'</b><div class="muted" style="font-size:11.5px;margin-top:2px">'+(wz.kind==='debt'?t('wizDebtT'):t('wizPayT'))+(wz.kind==='debt'&&wz.note?' · '+esc(wz.note):'')+'</div></div><div class="num" style="font-size:26px;font-weight:900;color:'+(amt>0?(wz.kind==='debt'?'var(--red)':'var(--green)'):'var(--soft)')+'">'+fmt(amt)+' <span style="font-size:12px">'+CUR()+'</span></div></div>'
 +(c&&amt>0?'<div class="muted" style="display:flex;align-items:center;gap:7px;margin-top:10px;padding-top:9px;border-top:1px dashed var(--line);font-size:12px;flex-wrap:wrap"><span>'+t('nowOwe')+': <b class="num">'+fmt(before)+'</b></span><span>←</span><span>'+t('afterOp')+': <b class="num" style="color:'+(wz.kind==='debt'?'var(--red)':'var(--green)')+'">'+fmt(after)+'</b></span>'+(hint?'<span style="font-weight:800;color:var(--green)">✓ '+hint+'</span>':'')+'</div>':'')
 +'</div>'}
