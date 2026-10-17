/* =====================================================================
 * Daftari · 07-data.js
 * ---------------------------------------------------------------------
 * Data access layer + derived indexes
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const curAcc=()=>db.accounts.find(a=>a.id===db.active)||db.accounts[0];
const DD=()=>db.data[db.active];
const cust=id=>DD().customers.find(c=>c.id===id);
let _IX=null;
function ix(){if(_IX)return _IX;const paidByInv={},open={},paid={},last={};
 DD().payments.forEach(p=>{if(p.arch)return;paid[p.cust]=(paid[p.cust]||0)+p.amount;last[p.cust]=Math.max(last[p.cust]||0,p.ts);(p.alloc||[]).forEach(a=>{paidByInv[a.inv]=(paidByInv[a.inv]||0)+a.amt})});
 DD().invoices.forEach(i=>{if(i.arch)return;open[i.cust]=(open[i.cust]||0)+Math.max(0,i.amount-(paidByInv[i.id]||0));last[i.cust]=Math.max(last[i.cust]||0,i.ts)});
 _IX={paidByInv,open,paid,last};return _IX}
const _LL={};
function libLoad(src){if(_LL[src])return _LL[src];_LL[src]=new Promise((res,rej)=>{const G={'lib/xlsx.full.min.js':()=>window.XLSX,'lib/tesseract.min.js':()=>window.Tesseract,'lib/vosk-browser.js':()=>(window.Vosk||window.createModel),'lib/qrcode.js':()=>window.QRCode,'lib/jsQR.js':()=>window.jsQR,'lib/chart.umd.js':()=>window.Chart};const g=G[src];if(g&&g()){res();return}const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=()=>{(g&&g())?res():rej(new Error('lib:'+src))};document.head.appendChild(sc)});return _LL[src]}
window.busy=on=>{let o=document.getElementById('busyOv');if(on&&!o){o=document.createElement('div');o.id='busyOv';o.style.cssText='position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(10,20,35,.35)';o.innerHTML='<span style="width:36px;height:36px;border:4px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:rotB .8s linear infinite;display:inline-block"></span>';document.body.appendChild(o)}else if(!on&&o){o.remove()}};
let _cd=0;
function debList(){clearTimeout(_cd);_cd=setTimeout(()=>{const el=document.getElementById('clist2');if(el)el.innerHTML=ui.arch?archListBody():custListBody()},120)}
let _td=0;
function debTx(){clearTimeout(_td);_td=setTimeout(()=>{const el=document.getElementById('txlist');if(el)el.innerHTML=feedHtml()},120)}
invPaid=id=>ix().paidByInv[id]||0;
function invEdited(id){const i=DD().invoices.find(v=>v.id===id);return !!(i&&i.edits&&i.edits.length)}
function lastEdit(id){const i=DD().invoices.find(v=>v.id===id);return i&&i.edits?i.edits[i.edits.length-1]:null}
function openReturnSheet(id){const i=DD().invoices.find(v=>v.id===id);if(!i)return;const rem=invRem(i);
 openSheet('<h3>'+t('retT')+' — '+i.code+'</h3><div class="muted" style="margin-bottom:10px">'+t('retHint')+'</div><div class="kv"><span class="k">'+t('remaining')+'</span><span class="v amt red">'+money(rem)+'</span></div><input class="inp num" id="retA" type="number" min="1" max="'+rem+'" placeholder="'+t('retAmt')+'"><input class="inp" id="retN" style="margin-top:8px" placeholder="'+t('retNote')+'"><button class="btn" style="margin-top:12px;background:var(--amber-bg);color:var(--amber)" onclick="applyReturn(\''+id+'\')">'+ic('undo',16)+t('ret')+'</button>')}
function addOpening(cid,amtMinor,note){const i={id:uid(),code:'OPN-'+(DD().seq++),cust:cid,ts:Date.now(),amount:amtMinor,note:note||t('opening'),k:'open'};DD().invoices.push(i);save();render();toastMsg(t('opening')+' ✓')}
function openOpeningSheet(id){openSheet('<h3>'+t('opening')+'</h3><div class="muted" style="margin-bottom:10px">'+t('openingD')+'</div><input class="inp num" id="opA" type="number" inputmode="decimal" placeholder="0.00"><button class="btn btn-navy" style="margin-top:12px" onclick="const a=Money.parse(document.getElementById(\'opA\').value);if(a<=0){toastMsg(t(\'enterAmt\'));return}closeSheet();addOpening(\''+id+'\',a)">'+t('saveName')+'</button>')}
function applyReturn(id,amt,nt){const i=DD().invoices.find(v=>v.id===id);if(!i)return;const rem=invRem(i);const ea=document.getElementById('retA'),en=document.getElementById('retN');const a=(amt!==undefined?Money.fromNumber(amt):(ea?Money.parse(ea.value):0))||0;const note=((nt!==undefined?nt:(en?en.value:''))||'').trim();if(dedupe('ret|'+id+'|'+a))return;
 if(a<=0){toastMsg(t('warn_noamt'));return}if(a>rem){toastMsg(t('retOver'));return}
 i.edits=i.edits||[];i.edits.push({ts:Date.now(),from:i.amount,to:i.amount-a,note:note||t('ret'),kind:'return'});i.amount=i.amount-a;save();closeSheet();render();toastMsg(t('retDone'))}
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
