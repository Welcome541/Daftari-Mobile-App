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
