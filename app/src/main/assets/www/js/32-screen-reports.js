/* =====================================================================
 * Daftari · 32-screen-reports.js
 * ---------------------------------------------------------------------
 * SCREEN: reports
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function repBody(){const rp=ui.rp=ui.rp||{mode:'week',day:'',month:'',from:'',to:'',cust:null};const r=repData();
 const seg='<div class="seg">'+[['day',t('repDay')],['week',t('repWeek')],['month',t('repMonth')],['range',t('repRange')]].map(k=>'<button class="'+(rp.mode===k[0]?'on':'')+'" onclick="ui.rp.mode=\''+k[0]+'\';render()">'+k[1]+'</button>').join('')+'</div>';
 let inp='';
 if(rp.mode==='day'||rp.mode==='week')inp='<label class="lb">'+(rp.mode==='day'?t('repPickDay'):t('repWeekStart'))+'</label><input class="inp num" type="date" value="'+esc(rp.day)+'" oninput="ui.rp.day=this.value;render()">';
 else if(rp.mode==='month')inp='<label class="lb">'+t('repPickMonth')+'</label><input class="inp num" type="month" value="'+esc(rp.month)+'" oninput="ui.rp.month=this.value;render()">';
 else inp='<div class="row" style="gap:8px"><div style="flex:1;min-width:0"><label class="lb">'+t('repFrom')+'</label><input class="inp num" style="min-width:0;font-size:13px" type="date" value="'+esc(rp.from)+'" oninput="ui.rp.from=this.value;render()"></div><div style="flex:1;min-width:0"><label class="lb">'+t('repTo')+'</label><input class="inp num" style="min-width:0;font-size:13px" type="date" value="'+esc(rp.to)+'" oninput="ui.rp.to=this.value;render()"></div></div>';
 const cc=rp.cust?cust(rp.cust):null;
 return '<div class="pad" style="margin-top:8px">'+seg+'<div class="card" style="padding:12px 14px;margin-top:10px">'+inp
 +'<div class="row" style="margin-top:12px"><span class="lb" style="margin:0">'+t('cust')+'</span><span class="sp"></span><button class="chip" style="border:1.5px solid var(--navy);color:var(--navy);background:var(--card);font-weight:800;padding:7px 12px" onclick="openRepCust()">'+(cc?esc(cc.name):t('repCustAll'))+' '+ic('chevD',14)+'</button></div></div>'
 +'<div class="pad stats" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div class="stat red"><div class="t">'+t('repDebtSum')+'</div><div class="v">'+fmt(r.debt)+'</div></div><div class="stat green"><div class="t">'+t('repPaySum')+'</div><div class="v">'+fmt(r.pay)+'</div></div><div class="stat" style="background:var(--navy-bg);color:var(--navy)"><div class="t">'+t('repOps')+'</div><div class="v"><span class="num">'+(r.invs.length+r.pays.length)+'</span></div></div><div class="stat" style="background:'+(r.pay-r.debt>=0?'var(--green-bg)':'var(--red-bg)')+';color:'+(r.pay-r.debt>=0?'var(--green)':'var(--red)')+'"><div class="t">'+t('repNet')+'</div><div class="v">'+fmt(r.pay-r.debt)+'</div></div></div>'
 +'<div class="pad"><div class="card" style="padding:14px 16px"><div class="row">'+ic('pie',17)+'<b style="font-size:13.5px">'+t('repDay')+'/'+t('repWeek')+'</b><span class="sp"></span><span class="muted num" style="font-size:10.5px;white-space:nowrap">'+dateStr(r.a)+' ← '+dateStr(r.b-1)+'</span></div>'+(chartOK()?'<div style="position:relative;height:120px;margin-top:10px"><canvas id="chW"></canvas></div>':repBars(r))+'</div></div>'
 +(r.invs.length+r.pays.length?'<div class="pad list" style="padding-bottom:6px">'+[...r.invs.map(i=>({ts:i.ts,nm:repNm(i.cust),amt:i.amount,k:'debt',note:i.note})),...r.pays.map(pp=>({ts:pp.ts,nm:repNm(pp.cust),amt:pp.amount,k:'pay',note:''}))].sort((x,y)=>y.ts-x.ts).slice(0,12).map(x=>'<div class="card litem" style="margin-bottom:8px"><div class="sp"><b>'+esc(x.nm)+'</b><div class="muted" style="font-size:11.5px;margin-top:2px">'+(x.k==='debt'?ic('receipt',12):ic('banknote',12))+' '+esc(x.note||'')+' · '+dateStr(x.ts)+'</div></div><span class="amt '+(x.k==='debt'?'red':'green')+'"><span class="num">'+fmt(x.amt)+'</span> '+CUR()+'</span></div>').join('')+'</div>'
 :'<div class="muted" style="text-align:center;padding:18px 0">'+t('repEmpty')+'</div>')
 +'<div class="pad" style="display:flex;gap:10px;padding-top:4px;padding-bottom:18px"><button class="btn btn-line" style="flex:1" onclick="printRep()">'+ic('print',17)+t('repPrint')+'</button><button class="btn btn-navy" style="flex:1.3" onclick="exportRepXlsx()">'+ic('excel',17)+' '+t('repXlsx')+'</button></div></div>'}
const S_reports=()=>headerBar(t('repB'))+repBody();
