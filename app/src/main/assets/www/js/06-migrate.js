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
 const c=(id,nm,ph,since,pin,extra)=>({id,name:nm,phone:ph,since,archived:false,pinned:!!pin,limit:(extra&&extra.limit)||null,photo:null,...extra});
 const at=(day,h,m)=>{const d=new Date();d.setDate(d.getDate()-day);d.setHours(h,m,0,0);return d.getTime()};
 const iv=(id,code,cu,ts,amount,note,due)=>({id,code,cust:cu,ts,amount,note,due:due||null});
 // --- 6 original reference customers (must stay first, checked by tests) ---
 const cs=[
  c('c1','محمد العلي','050 456 7291','2024'),
  c('c2','سارة أحمد','053 246 8101','2024'),
  c('c3','نور الهادي','056 135 7924','2025'),
  c('c4','أبو خالد','050 912 3344','2023'),
  c('c5','حسن القحطاني','054 987 6543','2024'),
  c('c6','محمد العتيبي','055 210 8843','2024'),
  // --- Very long names (overflow / truncation stress) ---
  c('c7','محمد عبد الله بن سالم بن محمد القحطاني العتيبي المطيري','050 111 2222','2022'),
  c('c8','مؤسسة النور للتجارة والمقاولات العامة والاستيراد والتصدير المحدودة','011 445 6789','2021'),
  c('c9','عبد الرحمن بن فيصل بن تركي بن عبد الله آل سعود حفظه الله','050 333 4444','2022'),
  c('c10','مطعم الشاورما السريع جداً — فرع الملك فهد — الرياض — المنطقة الوسطى','011 200 3000','2023'),
  // --- Similar / confusable names (search / dedup stress) ---
  c('c11','أحمد محمد','050 000 1111','2023'),
  c('c12','احمد محمد','050 000 1112','2023'), // without hamza
  c('c13','أحمد محمد علي','050 000 1113','2023'),
  c('c14','أحمد محمود','050 000 1114','2023'),
  c('c15','أحمد محمد — الفرع الثاني','050 000 1115','2023'),
  c('c16','احمد محمد علي','050 000 1116','2024'),
  c('c17','أبو أحمد','050 000 1117','2023'),
  c('c18','أم أحمد','050 000 1118','2023'),
  // --- Another similar cluster ---
  c('c19','سعيد','050 100 0001','2023'),
  c('c20','سعيدان','050 100 0002','2023'),
  c('c21','سعيد السعيد','050 100 0003','2023'),
  c('c22','سعيد سعيد السعيد','050 100 0004','2023'),
  c('c23','سعاد','050 100 0005','2023'),
  c('c24','سعود','050 100 0006','2023'),
  c('c25','مساعد','050 100 0007','2023'),
  // --- Single char / very short ---
  c('c26','س','050 200 0001','2023'),
  c('c27','م','050 200 0002','2023'),
  c('c28','أ','050 200 0003','2023'),
  // --- Special chars / mixed ---
  c('c29','أم سارة (الجارة)','050 300 1111','2023'),
  c('c30','خالد @ المتجر #1','050 300 2222','2023'),
  c('c31','عبدالله (القديم) - مكرر','050 300 3333','2023'),
  c('c32','Ali Hassan','050 400 1111','2023'),
  c('c33','John Smith','050 400 2222','2023'),
  c('c34','عميل 123 - اختبار أرقام','050 400 3333','2023'),
  c('c35','test_lowercase','050 400 4444','2023'),
  c('c36','محمد — test ٥٦٧','050 400 5555','2023'),
  // --- Phone edge cases ---
  c('c37','بدون هاتف','','2023'),
  c('c38','رقم طويل جداً','+966 50 123 4567 890','2023'),
  c('c39','رقم دولي','+20 10 1234 5678','2023'),
  // --- Limit / credit edge ---
  c('c40','المحدود - قريب من السقف','050 500 1111','2023',false,{limit:500000}),
  c('c41','المتجاوز - فوق السقف','050 500 2222','2023',false,{limit:300000}),
  c('c42','بدون سقف - دين كبير','050 500 3333','2023'),
  c('c43','دائن كبير','050 500 4444','2023'),
  // --- More realistic bulk to reach 50 ---
  c('c44','ناصر بن حمد','050 600 1111','2023'),
  c('c45','ناصر حمدان','050 600 2222','2023'),
  c('c46','فاطمة الزهراء','050 600 3333','2023'),
  c('c47','فاطمة زهراء','050 600 4444','2023'),
  c('c48','عمر بن الخطاب','050 700 1111','2023'),
  c('c49','عمر الخطاب','050 700 2222','2023'),
  c('c50','سلطان','050 700 3333','2023'),
  c('c51','سلطان بن سلطان','050 700 4444','2023'),
  c('c52','تركي','050 800 1111','2023'),
  c('c53','تركـي','050 800 2222','2023'), // tatweel
  c('c54','يوسف اليوسف','050 800 3333','2023'),
  c('c55','يوسف يوسف اليوسف','050 800 4444','2023'),
  c('c56','عبدالله عبدالله','050 900 1111','2023'),
  c('c57','بقالة الندى - مورد','011 900 0001','2023'),
  c('c58','شركة الأفق','011 900 0002','2023'),
  c('c59','مؤسسة الأفق للتوريد','011 900 0003','2023'),
  c('c60','أبو ياسر - الاسم الطويل جداً الاختبار الثاني للقطع','050 900 2222','2023')
 ];
 const is=[];
 const ps=[];
 // original 6 invoices (reference)
 const origIs=[
  iv('i1','A500','c1',at(0,5,33),200,'مواد تموينية'),
  iv('i2','A499','c2',at(1,0,30),150,'خضروات وفواكه'),
  iv('i3','A498','c3',at(2,22,22),80,'خبز وحليب'),
  iv('i4','A497','c4',at(3,9,15),320,'رز وزيت'),
  iv('i5','A496','c5',at(4,17,5),460,'دقيق وسكر'),
  iv('i6','A495','c6',at(5,12,45),150,'عصائر وأجبان')
 ];
 const origPs=[
  {id:'p1',cust:'c2',ts:at(1,1,40),amount:300,method:'cash',alloc:[{inv:'i2',amt:150}]},
  {id:'p2',cust:'c4',ts:at(3,10,0),amount:120,method:'cash',alloc:[{inv:'i4',amt:120}]},
  {id:'p3',cust:'c5',ts:at(4,18,0),amount:460,method:'transfer',alloc:[{inv:'i5',amt:460}]}
 ];
 is.push(...origIs); ps.push(...origPs);
 // --- Edge invoices for comprehensive coverage ---
 let seq=494;
 function addInv(cust,day,h,m,amount,note,due){
  is.push(iv('i'+(is.length+1),'A'+(seq--),cust,at(day,h,m),amount,note,due));
 }
 function addPay(cust,day,h,m,amount,method,alloc){
  ps.push({id:'p'+(ps.length+1),cust,ts:at(day,h,m),amount,method,alloc:alloc||[]});
 }
 // Very long names already have normal invoices - add them older
 addInv('c7',6,10,0,500,'طلبية كبيرة جداً تشمل جميع أصناف البقالة من أرز وسكر وزيت وحليب وخبز ومعلبات ومشروبات ومثلجات وحلويات وبسكويت ومعكرونة وتوابل وخضروات وفواكه طازجة');
 addInv('c7',6,11,30,250,'تكملة الطلبية السابقة — جزء ثان');
 addInv('c8',7,8,0,100,'فاتورة يومية');
 addInv('c10',7,9,0,100,'فاتورة يومية - أحمد محمد علي');
 addInv('c11',7,10,0,50,'اختبار تشابه الأسماء 1');
 addInv('c12',7,10,5,50,'اختبار تشابه الأسماء 2 - بدون همزة');
 addInv('c13',7,10,10,50,'اختبار تشابه الأسماء 3');
 addInv('c14',7,10,15,50,'اختبار تشابه الأسماء 4');
 // Large / small / decimal amounts
 addInv('c40',8,9,0,480,'قريب من السقف — 480 من 500');
 addInv('c41',8,9,0,500,'تجاوز السقف — 500 من 300');
 addInv('c42',8,10,0,999999,'مبلغ كبير جداً — اختبار تنسيق الأرقام الكبيرة');
 addInv('c42',8,11,0,1,'مبلغ صغير جداً — ريال واحد');
 addInv('c42',9,9,0,0.05,'هللة — 0.05');
 addInv('c42',9,10,0,1234.56,'مبلغ عشري — 1234.56');
 addInv('c42',10,9,0,100000,'100,000 — اختبار الفواصل');
 addInv('c43',10,10,0,2000,'دين أولي لدائن كبير');
 addPay('c43',10,11,0,5000,'cash',[]);
 // Bulk: create 2 invoices per remaining customers with varying amounts/times
 const bulkNotes=['مواد غذائية','خضروات','لحوم','أدوات منزلية','إيجار','فاتورة كهرباء','فاتورة ماء','', 'طلبية خاصة — لا يوجد وصف','Test English note','ملاحظة طويلة جداً تحتوي على تفاصيل كثيرة عن المنتجات والكميات والأسعار والخصومات والعروض الخاصة لهذا اليوم','نقداً','آجل','معدل — تم تعديل المبلغ'];
 for(let idx=18; idx<cs.length; idx++){
  const cid=cs[idx].id;
  const day= 11 + (idx % 20); // 11..30 days ago - older than reference
  const h= 8 + (idx % 14); const m= (idx*7)%60;
  const amt= [20,35,50,75,100,150,200,320,460,800,1200,2500,5000][idx % 13];
  const note= bulkNotes[idx % bulkNotes.length];
  addInv(cid, day, h, m, amt, note);
  if(idx % 3 === 0){
   const payAmt= Math.floor(amt*0.6);
   addPay(cid, day+1, h, m, payAmt, ['cash','transfer','cardpay'][idx%3], []);
  }
 }
 // Overdue / due date edge
 addInv('c40',12,8,0,100,'فاتورة متأخرة', new Date(Date.now()-5*864e5).toISOString().slice(0,10));
 addInv('c41',12,9,0,200,'فاتورة متأخرة جداً', new Date(Date.now()-20*864e5).toISOString().slice(0,10));
 // Edited flag test
 const editedInv=iv('i-ed','A100','c7',at(6,14,0),300,'فاتورة معدلة — تم التعديل');
 editedInv.edits=[{from:20000,to:30000,ts:Date.now()}];
 is.push(editedInv);
 // Amount with zero / negative edge via payment overpay
 addPay('c40',13,10,0,1000,'cash',[]);

 is.forEach(i=>i.amount=Math.round(i.amount*100));
 ps.forEach(pp=>{pp.amount=Math.round(pp.amount*100);pp.alloc.forEach(a=>a.amt=Math.round(a.amt*100))});
 // ensure customers with limits in halala
 cs.forEach(cobj=>{if(cobj.limit) cobj.limit=Math.round(cobj.limit);});
 return {meta:{schemaVersion:2},lang:((navigator.language||'').slice(0,2).toLowerCase()==='ar'?'ar':'en'),active:'a1',accounts:[{id:'a1',name:'بقالة الندى',type:'grocery',cur:'ر.س',minorUnit:2}],data:{a1:{customers:cs,invoices:is,payments:ps,seq:600}}};
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
