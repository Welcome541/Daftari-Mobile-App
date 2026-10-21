/* ================= seed / migrate ================= */
function seed(){
 return {meta:{schemaVersion:2},lang:((navigator.language||'').slice(0,2).toLowerCase()==='ar'?'ar':'en'),active:'a1',accounts:[{id:'a1',name:'بقالة الندى',type:'grocery',cur:'ر.س',minorUnit:2}],data:{a1:{customers:[],invoices:[],payments:[],seq:500}}};
}
/* بيانات تجريبية للاختبارات فقط — لا تُستدعى في الإنتاج إطلاقًا */
function demoFixtures(){
 const c=(id,nm,ph,since,pin)=>({id,name:nm,phone:ph,since,archived:false,pinned:!!pin});
 const cs=[c('c1','أبو خالد','050 456 7291','2023',true),c('c2','محمد العتيبي','055 210 8843','2024'),c('c3','سارة أحمد','053 246 8101','2024'),c('c4','نور الهاجري','056 135 7924','2025'),c('c5','حسن القحطاني','054 987 6543','2024')];
 const now=Date.now();
 const iv=(id,code,cu,ts,amount,note)=>({id,code,cust:cu,ts,amount,note});
 const is=[iv('i1','A489','c1',now-50*MIN,70,'رز · زيت · حليب'),iv('i2','A488','c1',now-26*H,320,'سكر · شاي · دقيق'),iv('i3','A487','c1',now-3*D,500,'أرز · سمن · معجون طماطم'),iv('i4','A486','c1',now-30*D,460,'زيت · مكرونة · عدس'),iv('i5','A490','c2',now-45*MIN,200,'مواد تموينية'),iv('i6','A485','c3',now-4*H,150,'خضروات وفواكه'),iv('i7','A482','c5',now-2*D-3*H,300,'رز · زيت · حليب'),iv('i8','A475','c5',now-2*D,150,'خبز · عصائر')];
 const py=(id,cu,ts,amount,method,alloc)=>({id,cust:cu,ts,amount,method,alloc});
 const ps=[py('p1','c1',now-20*MIN,30,'cash',[{inv:'i1',amt:30}]),py('p2','c1',now-3*D+2*H,500,'cash',[{inv:'i3',amt:500}]),py('p3','c1',now-29*D,460,'cash',[{inv:'i4',amt:460}]),py('p4','c3',now-1*H,150,'transfer',[{inv:'i6',amt:150}]),py('p5','c5',now-1*D,50,'cash',[{inv:'i8',amt:50}])];
 is.forEach(i=>i.amount*=100);ps.forEach(pp=>{pp.amount*=100;pp.alloc.forEach(a=>a.amt*=100)});
 return {meta:{schemaVersion:2},lang:((navigator.language||'').slice(0,2).toLowerCase()==='ar'?'ar':'en'),active:'a1',accounts:[{id:'a1',name:'بقالة الندى',type:'grocery',cur:'ر.س',minorUnit:2}],data:{a1:{customers:cs,invoices:is,payments:ps,seq:491}}};
}
function migrate(x){return x == null ? seed() : LedgerSchema.migrate(x)}

/* ================= data access ================= */
const curAcc=()=>db.accounts.find(a=>a.id===db.active)||db.accounts[0];
const DD=()=>db.data[db.active];
const cust=id=>DD().customers.find(c=>c.id===id);
let _IX=null;
function ix(){if(_IX)return _IX;const paidByInv={},open={},paid={},last={};
 DD().payments.forEach(p=>{if(p.arch)return;paid[p.cust]=(paid[p.cust]||0)+p.amount;last[p.cust]=Math.max(last[p.cust]||0,p.ts);(p.alloc||[]).forEach(a=>{paidByInv[a.inv]=(paidByInv[a.inv]||0)+a.amt})});
 DD().invoices.forEach(i=>{if(i.arch)return;open[i.cust]=(open[i.cust]||0)+Math.max(0,i.amount-(paidByInv[i.id]||0));last[i.cust]=Math.max(last[i.cust]||0,i.ts)});
 _IX={paidByInv,open,paid,last};return _IX}
const _LL={};function libLoad(src){if(_LL[src])return _LL[src];_LL[src]=new Promise((res,rej)=>{const G={'lib/xlsx.full.min.js':()=>window.XLSX,'lib/tesseract.min.js':()=>window.Tesseract,'lib/vosk-browser.js':()=>(window.Vosk||window.createModel),'lib/qrcode.js':()=>window.QRCode,'lib/jsQR.js':()=>window.jsQR,'lib/chart.umd.js':()=>window.Chart};const g=G[src];if(g&&g()){res();return}const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=()=>{(g&&g())?res():rej(new Error('lib:'+src))};document.head.appendChild(sc)});return _LL[src]}
window.busy=on=>{let o=document.getElementById('busyOv');if(on&&!o){o=document.createElement('div');o.id='busyOv';o.style.cssText='position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(10,20,35,.35)';o.innerHTML='<span style="width:36px;height:36px;border:4px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:rotB .8s linear infinite;display:inline-block"></span>';document.body.appendChild(o)}else if(!on&&o){o.remove()}};
let _cd=0;function debList(){clearTimeout(_cd);_cd=setTimeout(()=>{const el=document.getElementById('clist2');if(el)el.innerHTML=ui.arch?archListBody():custListBody()},120)}
let _td=0;function debTx(){clearTimeout(_td);_td=setTimeout(()=>{const el=document.getElementById('txlist');if(el)el.innerHTML=feedHtml()},120)}
invPaid=id=>ix().paidByInv[id]||0;
function invEdited(id){const i=DD().invoices.find(v=>v.id===id);return !!(i&&i.edits&&i.edits.length)}
function lastEdit(id){const i=DD().invoices.find(v=>v.id===id);return i&&i.edits?i.edits[i.edits.length-1]:null}
function openReturnSheet(id){const i=DD().invoices.find(v=>v.id===id);if(!i)return;const rem=invRem(i);
 openSheet('<h3>'+t('retT')+' — '+i.code+'</h3><div class="muted" style="margin-bottom:10px">'+t('retHint')+'</div><div class="kv"><span class="k">'+t('remaining')+'</span><span class="v amt red">'+money(rem)+'</span></div><input class="inp num" id="retA" type="number" min="1" max="'+rem+'" placeholder="'+t('retAmt')+'"><input class="inp" id="retN" style="margin-top:8px" placeholder="'+t('retNote')+'"><button class="btn" style="margin-top:12px;background:var(--amber-bg);color:var(--amber)" onclick="applyReturn(\''+id+'\')">'+ic('undo',16)+t('ret')+'</button>')}
async function addOpening(cid,amtMinor,note){const i={id:uid(),code:'OPN-'+DD().seq,cust:cid,ts:Date.now(),amount:amtMinor,note:note||t('opening'),k:'open'};try{await LedgerEdits.insert('invoices',i,true)}catch(e){storageFailure();return}closeSheet();render();toastMsg(t('opening')+' ✓')}
function openOpeningSheet(id){openSheet('<h3>'+t('opening')+'</h3><div class="muted" style="margin-bottom:10px">'+t('openingD')+'</div><input class="inp num" id="opA" type="number" inputmode="decimal" placeholder="0.00"><button class="btn btn-navy" style="margin-top:12px" onclick="const a=Money.parse(document.getElementById(\'opA\').value);if(a<=0){toastMsg(t(\'enterAmt\'));return}addOpening(\''+id+'\',a)">'+t('saveName')+'</button>')}
async function applyReturn(id,amt,nt){const i=DD().invoices.find(v=>v.id===id);if(!i)return;const rem=invRem(i);const ea=document.getElementById('retA'),en=document.getElementById('retN');const a=(amt!==undefined?Money.fromNumber(amt):(ea?Money.parse(ea.value):0))||0;const note=((nt!==undefined?nt:(en?en.value:''))||'').trim();if(dedupe('ret|'+id+'|'+a))return;
 if(a<=0){toastMsg(t('warn_noamt'));return}if(a>rem){toastMsg(t('retOver'));return}
 try{await LedgerEdits.commit(d=>{const target=d.invoices.find(x=>x.id===id);target.edits=target.edits||[];target.edits.push({ts:Date.now(),from:target.amount,to:target.amount-a,note:note||t('ret'),kind:'return'});target.amount-=a})}catch(e){storageFailure();return}closeSheet();render();toastMsg(t('retDone'))}
const invRem=i=>Math.max(0,i.amount-invPaid(i.id));
const invStatus=i=>{const p=invPaid(i.id);return p<=0?'open':(p>=i.amount?'paid':'part')};
const custInvoices=id=>DD().invoices.filter(i=>i.cust===id).sort((a,b)=>b.ts-a.ts);
const custOpen=id=>ix().open[id]||0; // signed: negative = credit for customer
const openTotal=()=>DD().customers.reduce((s,c)=>s+Math.max(0,custOpen(c.id)),0);
const custPaid=id=>ix().paid[id]||0;
const custPurch=id=>custInvoices(id).reduce((s,i)=>s+i.amount,0);
const custCount=id=>custInvoices(id).length;
const lastAct=id=>ix().last[id]||0;

const isOverdue=i=>!!(i.due&&invRem(i)>0&&Date.now()>i.due);
const custOverdue=id=>DD().invoices.some(i=>i.cust===id&&isOverdue(i));
const dueVal=()=>{const el=document.getElementById('md_d');return el&&el.value?new Date(el.value+'T12:00:00').getTime():null};
const isToday=ts=>new Date(ts).toDateString()===new Date().toDateString();
const collToday=()=>DD().payments.filter(p=>isToday(p.ts)).reduce((s,p)=>s+p.amount,0);
