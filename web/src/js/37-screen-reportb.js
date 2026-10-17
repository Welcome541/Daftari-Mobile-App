/* =====================================================================
 * Daftari · 37-screen-reportb.js
 * ---------------------------------------------------------------------
 * SCREEN: custom report builder
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const __dd={};
const dedupe=k=>{const n=Date.now();if(__dd.k===k&&n-(__dd.t||0)<700)return true;__dd.k=k;__dd.t=n;return false};
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
const S_repb=p=>headerBar(t('repB'),null,'back()')+repBody();
function goWiz(kind,preId){if(!isP()&&!DD().customers.some(c=>!c.archived)){toastMsg(t('noCustomers'));go('newcust',{});return}
 const solo=(()=>{const a=DD().customers.filter(c=>!c.archived);return a.length===1?a[0].id:null})();
 ui.wz={kind,step:isP()?0:((preId||solo)?1:0),custId:preId||solo,amt:'',note:'',due:'',q:'',method:'cash'};go('wiz',{});setTimeout(()=>{const a=document.getElementById('wzA');if(a)a.focus()},80)}
