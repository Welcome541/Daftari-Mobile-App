/* =====================================================================
 * Daftari · 25-feed.js
 * ---------------------------------------------------------------------
 * Home feed rendering helpers
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function hfBadge(){const n=(ui.tf.kind!=='all'?1:0)+(ui.tf.period!=='month'?1:0);return n?'<span class="num" style="position:absolute;top:5px;inset-inline-end:5px;background:var(--red);color:#fff;border-radius:999px;font-size:10px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-weight:900">'+n+'</span>':''}
function openHomeFilter(){filteredTx();const tx=txAll();const seg=(cur,items,fn)=>'<div class="seg">'+items.map(k=>'<button class="'+(cur===k[0]?'on':'')+'" onclick="'+fn+'(\''+k[0]+'\')">'+k[1]+'</button>').join('')+'</div>';
 openSheet('<div class="grab"></div><div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('hfTitle')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<div class="lb" style="margin-top:0">'+t('hfKind')+'</div>'+seg(ui.tf.kind,[['all',t('all')+' · '+tx.length],['debt',t('debtsF')+' · '+tx.filter(x=>x.kind==='debt').length],['pay',t('paysF')+' · '+tx.filter(x=>x.kind==='pay').length]],'setHF')
 +'<div class="lb" style="margin:12px 0 7px">'+t('hfPeriod')+'</div>'+seg(ui.tf.period,[['today',t('pToday')+' · '+tx.filter(x=>isToday(x.ts)).length],['week',t('pWeek')+' · '+tx.filter(x=>Date.now()-x.ts<7*D).length],['month',t('pMonth')+' · '+tx.filter(x=>Date.now()-x.ts<30*D).length]],'setHP')
 +'<div class="muted" style="margin-top:12px;text-align:center;font-size:12px;font-weight:700"><span class="num">'+window.__txFull+'</span> '+t('hfShow')+'</div>'
 +((ui.tf.kind!=='all'||ui.tf.period!=='month')?'<button class="btn btn-line" style="margin-top:10px" onclick="ui.tf={kind:\'all\',period:\'month\'};ui.txLimit=60;closeSheet();render()">'+ic('x',15)+' '+t('clearF')+'</button>':''))}
function setHF(k){ui.tf.kind=k;ui.txLimit=60;closeSheet();render()}
function setHP(k){ui.tf.period=ui.tf.period===k?'month':k;ui.txLimit=60;closeSheet();render()}
window.refreshHome=()=>{const el=document.getElementById('txlist');if(el)el.innerHTML=feedHtml();const tn=document.getElementById('txn');if(tn)tn.textContent=window.__txFull;const pc=document.getElementById('pchips');if(pc)pc.innerHTML=pChipsHtml();const s1=document.getElementById('stats1');if(s1)s1.outerHTML=statsCards()};
function toggleDebt(){if(ui.tf.kind==='debt'){ui.tf={kind:'all',period:'today'}}else{ui.tf={kind:'debt',period:'month'}}refreshHome()}
function togglePay(){if(ui.tf.kind==='pay'){ui.tf={kind:'all',period:'today'}}else{ui.tf={kind:'pay',period:'month'}}refreshHome()}
function dayLabel(ts){const d=new Date(ts),n0=new Date();const a=new Date(d);a.setHours(0,0,0,0);const b=new Date(n0);b.setHours(0,0,0,0);const diff=Math.round((b-a)/864e5);
 if(diff<=0)return t('today');if(diff===1)return t('yest');
 return d.toLocaleDateString(db.lang==='ar'?'ar':'en-GB',{weekday:'long'})+' · '+d.getDate()+'/'+(d.getMonth()+1)}
function feedHtml(){const L=filteredTx();
 if(!L.length){const any=DD().invoices.length+DD().payments.length;
 if(any&&ui.tf.period==='today')return '<div class="muted" style="text-align:center;padding:24px 16px">'+t('noToday')+'<div style="margin-top:10px"><button class="btn btn-line" style="width:auto;padding:10px 18px;font-size:13.5px" onclick="ui.tf={kind:\'all\',period:\'all\'};ui.txLimit=60;refreshHome()">'+t('showAll')+'</button></div></div>';
 return '<div class="muted" style="text-align:center;padding:28px 16px">'+(any?t('noRes'):ic('mic',26)+'<div style="margin-top:10px;font-weight:700;line-height:1.7">'+t('emptyHome')+'</div>')+'</div>'}
 let out='',last='';L.forEach(x=>{const dl=dayLabel(x.ts);if(dl!==last){out+='<div class="lb" style="margin:2px 4px 2px;font-size:12px">'+dl+'</div>';last=dl}out+=txRow(x)});
 if(window.__txFull>L.length)out+='<div style="text-align:center;margin-top:10px"><button class="btn btn-line" style="width:auto;padding:10px 22px;font-size:13px" onclick="ui.txLimit='+L.length+'+60;refreshHome()">'+ic('chevD',15)+' '+t('showMore')+' (<span class="num">'+(window.__txFull-L.length)+'</span>)</button></div>';
 return out}
const privBtn=()=>'<button class="hbtn" onclick="sec.priv=!sec.priv;saveSec();render()" aria-label="'+t('hideAmt')+'">'+ic(sec.priv?'eyeoff':'eye',18)+'</button>';
