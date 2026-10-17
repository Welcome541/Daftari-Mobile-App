/* =====================================================================
 * Daftari · 49-charts.js
 * ---------------------------------------------------------------------
 * Chart.js rendering (graceful fallback)
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function chartOK(){try{return typeof Chart!=='undefined'&&!!document.createElement('canvas').getContext('2d')}catch(e){return false}}
let __chW=null,__chM=null;
function drawCharts(){if(!chartOK())return;
 const pays=DD().payments;
 const days=[...Array(7)].map((_,i)=>{const d0=new Date();d0.setHours(0,0,0,0);const s0=d0.getTime()-(6-i)*864e5;return pays.filter(pp=>pp.ts>=s0&&pp.ts<s0+864e5).reduce((x,pp)=>x+pp.amount,0)});
 const isRep=['reports','repb'].includes((curScr()||{}).s);
 const cw=document.getElementById('chW');
 if(cw){if(__chW)__chW.destroy();let lb,ds,lg=false;
  if(isRep){const r=repData();const n=Math.min(31,Math.max(1,Math.round((r.b-r.a)/864e5)));const bw=(r.b-r.a)/n;const bk=[...Array(n)].map(()=>({d:0,p:0}));
   r.invs.forEach(x=>{bk[Math.min(n-1,Math.floor((x.ts-r.a)/bw))].d+=x.amount});r.pays.forEach(x=>{bk[Math.min(n-1,Math.floor((x.ts-r.a)/bw))].p+=x.amount});
   const st=Math.ceil(n/8);lb=bk.map((_,k)=>k%st?'':new Date(r.a+k*bw).toLocaleDateString(db.lang==='ar'?'ar':'en-GB',{day:'numeric',month:'numeric'}));
   ds=[{label:t('debtsF'),data:bk.map(x=>x.d),backgroundColor:'#e08585',borderRadius:4,maxBarThickness:14},{label:t('paysF'),data:bk.map(x=>x.p),backgroundColor:'#7fc8a4',borderRadius:4,maxBarThickness:14}];lg=true;}
  else{lb=[...Array(7)].map((_,i)=>i===6?'·':String(6-i));ds=[{data:days,backgroundColor:days.map((v,i)=>i===6?'#0e7a52':'#bfe0d2'),borderRadius:6,maxBarThickness:34}];}
  __chW=new Chart(cw,{type:'bar',data:{labels:lb,datasets:ds},options:{maintainAspectRatio:false,plugins:{legend:{display:lg,labels:{boxWidth:12,font:{size:10}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(128,128,128,.15)'}}}}});}
 const now=new Date();const lbls=[],debtD=[],collD=[];
 for(let k=5;k>=0;k--){const m=new Date(now.getFullYear(),now.getMonth()-k,1);
  lbls.push(m.toLocaleDateString(db.lang==='ar'?'ar':['en'],{month:'short'}));
  debtD.push(DD().invoices.filter(i=>{const d=new Date(i.ts);return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear()}).reduce((x,i)=>x+i.amount,0));
  collD.push(pays.filter(pp=>{const d=new Date(pp.ts);return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear()}).reduce((x,pp)=>x+pp.amount,0));}
 const cm=document.getElementById('chM');
 if(cm){if(__chM)__chM.destroy();
  __chM=new Chart(cm,{type:'bar',data:{labels:lbls,datasets:[{label:t('owed'),data:debtD,backgroundColor:'#e08585',borderRadius:5,maxBarThickness:22},{label:t('collToday'),data:collD,backgroundColor:'#7fc8a4',borderRadius:5,maxBarThickness:22}]},options:{maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:12,font:{size:11}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(128,128,128,.15)'}}}}});}
}
