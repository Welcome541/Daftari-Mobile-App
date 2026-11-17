/* =====================================================================
 * Daftari · 06-migrate.js
 * ---------------------------------------------------------------------
 * Seed, demo fixtures, schema migrations
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function seed(){
 return {meta:{schemaVersion:2},lang:((navigator.language||'').slice(0,2).toLowerCase()==='ar'?'ar':'en'),active:'a1',accounts:[{id:'a1',name:'بقالة الندى',type:'grocery',cur:'ر.س',minorUnit:2}],data:{a1:{customers:[],invoices:[],payments:[],seq:500}}};
}
/* Demo ledger - the three rows of the reference design lead the customer
   list, with the exact balances, kinds and clock times of the drawing:
     محمد العلي   فاتورة 200   اليوم 05:33
     سارة أحمد   سداد نقدًا 300 (دائن 150)  أمس 01:40
     نور الهادي   فاتورة 80   قبل يومين 22:22
   The remaining customers carry older activity, so the list reads
   newest-first exactly like the reference. */
function demoFixtures(){
 const c=(id,nm,ph,since,pin)=>({id,name:nm,phone:ph,since,archived:false,pinned:!!pin});
 const cs=[c('c1','محمد العلي','050 456 7291','2024'),c('c2','سارة أحمد','053 246 8101','2024'),c('c3','نور الهادي','056 135 7924','2025'),
  c('c4','أبو خالد','050 912 3344','2023'),c('c5','حسن القحطاني','054 987 6543','2024'),c('c6','محمد العتيبي','055 210 8843','2024')];
 const at=(day,h,m)=>{const d=new Date();d.setDate(d.getDate()-day);d.setHours(h,m,0,0);return d.getTime()};
 const iv=(id,code,cu,ts,amount,note)=>({id,code,cust:cu,ts,amount,note});
 const is=[iv('i1','A500','c1',at(0,5,33),200,'مواد تموينية'),
  iv('i2','A499','c2',at(1,0,30),150,'خضروات وفواكه'),
  iv('i3','A498','c3',at(2,22,22),80,'خبز وحليب'),
  iv('i4','A497','c4',at(3,9,15),320,'رز وزيت'),
  iv('i5','A496','c5',at(4,17,5),460,'دقيق وسكر'),
  iv('i6','A495','c6',at(5,12,45),150,'عصائر وأجبان')];
 const py=(id,cu,ts,amount,method,alloc)=>({id,cust:cu,ts,amount,method,alloc});
 const ps=[py('p1','c2',at(1,1,40),300,'cash',[{inv:'i2',amt:150}]),
  py('p2','c4',at(3,10,0),120,'cash',[{inv:'i4',amt:120}]),
  py('p3','c5',at(4,18,0),460,'transfer',[{inv:'i5',amt:460}])];
 is.forEach(i=>i.amount*=100);ps.forEach(pp=>{pp.amount*=100;pp.alloc.forEach(a=>a.amt*=100)});
 return {meta:{schemaVersion:2},lang:((navigator.language||'').slice(0,2).toLowerCase()==='ar'?'ar':'en'),active:'a1',accounts:[{id:'a1',name:'بقالة الندى',type:'grocery',cur:'ر.س',minorUnit:2}],data:{a1:{customers:cs,invoices:is,payments:ps,seq:501}}};
}
/* Replace the ledger with the demo one (or with an empty one). The
   language choice is kept - only the data changes. */
function applyDemo(){
 const lang=db&&db.lang;
 db=migrate(demoFixtures());
 if(lang)db.lang=lang;
 save();closeSheet();stack=[{s:'home'}];render();toastMsg(t('demoLoaded'));
}
function clearDemo(){
 const lang=db&&db.lang;
 db=migrate(null);
 if(lang)db.lang=lang;
 save();closeSheet();stack=[{s:'home'}];render();toastMsg(t('demoCleared'));
}
function openDemoSheet(){
 openSheet('<div class="grab"></div><div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('demoT')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<div class="muted" style="font-size:13px;line-height:1.9">'+esc(t('demoD'))+'</div>'
 +'<button class="btn btn-navy" style="margin-top:14px" onclick="applyDemo()">'+ic('zap',17)+t('demoLoad')+'</button>'
 +'<button class="btn btn-line-red" style="margin-top:10px" onclick="clearDemo()">'+ic('trash',17)+t('demoClear')+'</button>');
}
const MIGRATIONS=[{to:2,run(x){for(const aid in x.data){const d=x.data[aid];(d.invoices||[]).forEach(i=>{i.amount=Math.round((Number(i.amount)||0)*100);(i.edits||[]).forEach(e=>{e.from=Math.round((Number(e.from)||0)*100);e.to=Math.round((Number(e.to)||0)*100)})});(d.payments||[]).forEach(pp=>{pp.amount=Math.round((Number(pp.amount)||0)*100);(pp.alloc||[]).forEach(a=>a.amt=Math.round((Number(a.amt)||0)*100))});(d.customers||[]).forEach(c=>{if(c.limit)c.limit=Math.round(Number(c.limit)*100)})}(x.accounts||[]).forEach(a=>a.minorUnit=a.minorUnit||2);return x}}];
function migrate(x){
 let base;
 if(x&&x.accounts&&x.data)base=x;
 else{base=seed();if(x&&x.customers){base.data.a1={customers:x.customers,invoices:x.invoices||[],payments:x.payments||[],seq:x.seq||500};if(x.lang)base.lang=x.lang;if(x.cur)base.accounts[0].cur=x.cur;if(x.accName)base.accounts[0].name=x.accName}}
 base.meta=base.meta||{schemaVersion:1};
 const from=base.meta.schemaVersion||1;
 if(from<2){try{localStorage.setItem('v1raw',JSON.stringify(base))}catch(e){}}
 for(const m of MIGRATIONS){if((base.meta.schemaVersion||1)<m.to){try{base=m.run(base);base.meta.schemaVersion=m.to;const bad=Invariants.check(base);if(bad)throw new Error(bad)}catch(e){try{const r=JSON.parse(localStorage.getItem('v1raw')||'null');if(r)return r}catch(_){}}}}
 return base;
}
