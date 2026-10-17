/* =====================================================================
 * Daftari · 20-shell.js
 * ---------------------------------------------------------------------
 * Shell chrome: header, account chip, stat cards
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const accInit=()=>{const n=(curAcc()&&curAcc().name||'').trim();return n?n.charAt(0).toUpperCase():'د'};
function accChip(){const a=curAcc();return '<button class="hbtn accchip" aria-label="'+t('switchAcc')+'" style="gap:8px" onclick="openAccSheet()">'+(a.type==='grocery'?ic('store',18):ic('user',18))+'<span class="accn" style="font-weight:800;font-size:14px">'+esc(a.name)+'</span>'+ic('chevD',15)+'</button>'}
function headerBar(title,sub,backFn,menuFn,extra){
 return '<div class="hdr">'+(backFn?'<button class="hbtn" aria-label="'+t('back')+'" onclick="'+backFn+'">'+ic('back',20)+'</button>':'<span style="width:10px"></span>')+
 '<div class="sp" style="text-align:center"><h1>'+title+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'+
 (menuFn?'<button class="hbtn" aria-label="'+t('menu')+'" onclick="'+menuFn+'">'+ic('dots',20)+'</button>':(extra||'<span style="width:10px"></span>'))+'</div>';
}
const todayExp=()=>DD().invoices.filter(i=>isToday(i.ts)).reduce((x,i)=>x+i.amount,0);
function statsCards(){const p=isP();const d0=new Date();d0.setHours(0,0,0,0);const a=d0.getTime(),b=a+86400000;
const td=Ledger.todayDebt(DD(),a,b),tp=Ledger.todayPay(DD(),a,b);
return '<div class="stats pad" id="stats1"><div class="stat red" role="button" tabindex="0" onclick="ui.tf={kind:\'debt\',period:\'today\'};refreshHome()"><div class="t">'+ic('receipt',15)+(p?t('expToday'):t('todayDebt'))+'</div><div class="v">'+money(td)+'</div></div><div class="stat green" role="button" tabindex="0" onclick="ui.tf={kind:\'pay\',period:\'today\'};refreshHome()"><div class="t">'+ic('banknote',15)+(p?t('depToday'):t('sToday'))+'</div><div class="v">'+money(tp)+'</div></div></div>'}
const pdig=s0=>{let x=(s0||'').replace(/\D/g,'');if(x.startsWith('966'))x=x.slice(3);return x};
const custOverAmt=id=>DD().invoices.filter(i=>i.cust===id&&isOverdue(i)).reduce((x,i)=>x+invRem(i),0);
const custOverSince=id=>DD().invoices.filter(i=>i.cust===id&&isOverdue(i)).reduce((m,i)=>(!m||i.due<m)?i.due:m,0);
const NEARLIM=0.1;
const limitState=c=>{if(!c.limit)return 'ok';const o=custOpen(c.id);if(o>c.limit)return 'over';if(o>0&&(c.limit-o)<=c.limit*NEARLIM)return 'near';return 'ok'};
const lastOpTxt=ts=>(!ts?t('noOps'):(Date.now()-ts>14*D?dateStr(ts):rel(ts)));
