/* =====================================================================
 * Daftari · 38-screen-wizard.js
 * ---------------------------------------------------------------------
 * SCREEN: guided debt/payment wizard
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function wizExit(){ui.wz=null;back()}
function wzSel(id){ui.wz.custId=id;ui.wz.step=1;render();setTimeout(()=>{const a=document.getElementById('wzA');if(a)a.focus()},80)}
function wzReList(){const el=document.getElementById('wzlist');if(el){const q=normAr(ui.wz.q||'');let cs=DD().customers.filter(c=>!c.archived);if(q)cs=cs.filter(c=>normAr(c.name).includes(q)||(pdig(ui.wz.q||'').length>=3&&pdig(c.phone).endsWith(pdig(ui.wz.q))));el.innerHTML=wzListHtml(cs)}}
function wzListHtml(cs){if(!cs.length)return '<div class="muted" style="text-align:center;padding:22px 0">'+t('noResC')(esc(ui.wz.q||''))+'</div>';
 return cs.map(c=>{const o=custOpen(c.id);return '<div class="card litem" style="margin-bottom:8px" onclick="wzSel(\''+c.id+'\')">'+avat(c.name,46)+'<div class="sp"><b>'+esc(c.name)+'</b>'+(c.phone?'<div class="muted num" style="font-size:12px;margin-top:2px">'+esc(c.phone)+'</div>':'')+'</div><div style="text-align:end">'+(o>0?'<span class="amt red"><span class="num">'+fmt(o)+'</span> '+CUR()+'</span>':'<span class="amt gray"><span class="num">0.00</span> '+CUR()+'</span>')+'</div><span style="color:var(--navy)">'+ic('fwd',18)+'</span></div>'}).join('')}
function wizCustCard(){const c=cust(ui.wz.custId);if(!c)return '';return '<div class="card litem" style="margin-bottom:12px;border:1.6px solid var(--navy)" onclick="ui.wz.step=0;render()">'+avat(c.name,44)+'<div class="sp"><b>'+esc(c.name)+'</b>'+(c.phone?'<div class="muted num" style="font-size:12px;margin-top:2px">'+esc(c.phone)+'</div>':'')+'</div><span class="chip" style="background:var(--navy-bg);color:var(--navy);padding:4px 10px;font-size:11px;font-weight:800">'+t('wzCust')+'</span></div>'}
function wizNext(){render()}
function wzLive(){const el=document.getElementById('wzLive');if(el)el.innerHTML=wzLiveHtml()}
function wizConfirm(){const wz=ui.wz;if(!wz)return;const c=isP()?null:cust(wz.custId);const amt=Money.parse(wz.amt);
 if(dedupe('wz|'+(c?c.id:'p')+'|'+amt))return;
 if(!isP()&&!c){toastMsg(t('chooseFirst'));return}if(amt<=0){toastMsg(t('enterAmt'));return}
 if(wz.kind==='debt'){const inv={id:uid(),code:'A'+(DD().seq++),cust:c?c.id:null,ts:Date.now(),amount:amt,note:(wz.note||'').trim(),due:wz.due?+new Date(wz.due):null,src:'manual'};DD().invoices.push(inv);save();feedback('debt');doneSnack('debt',inv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('newDebt')+' '+amt+' '+CUR())}
 else{const open=c?custInvoices(c.id).filter(i=>invRem(i)>0&&!i.k).sort((a,b)=>a.ts-b.ts):[];let left=amt;const alloc=[];
  open.forEach(i=>{if(left<=0)return;const use=Math.min(invRem(i),left);left-=use;alloc.push({inv:i.id,amt:use})});
  const pyv={id:uid(),cust:c?c.id:null,ts:Date.now(),amount:amt,method:wz.method,alloc,src:'manual'};DD().payments.push(pyv);save();feedback('pay');doneSnack('pay',pyv.id,c?c.id:null,amt);speak((c?c.name+'، ':'')+t('pay')+' '+amt+' '+CUR())}
 ui.wz=null;tab('home')}
const S_wiz=p=>{const wz=ui.wz;if(!wz)return '<div class="pad"></div>';
 const steps=isP()?['amt']:['cust','amt'];const si=Math.min(wz.step,steps.length-1);const cur=steps[si];
 const lab={cust:t('wzCust'),amt:t('wzConf')};
 let bar='<div style="display:flex;align-items:center;gap:8px;padding:12px 22px 2px">';
 steps.forEach((k,i)=>{const done=i<si,act=i===si;
  bar+='<div style="display:flex;align-items:center;gap:7px;'+(i<steps.length-1?'flex:1':'')+'"><span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex:none;'+(done?'background:var(--green);color:#fff':act?'background:var(--navy);color:#fff':'background:var(--card);border:1.5px solid var(--line);color:var(--soft)')+'">'+(done?ic('check',14):(i+1))+'</span><span style="font-weight:800;font-size:12px;'+(act?'color:var(--navy)':done?'color:var(--green)':'color:var(--soft)')+'">'+lab[k]+'</span>'+(i<steps.length-1?'<span style="flex:1;height:2px;border-radius:2px;background:'+(done?'var(--green)':'var(--line)')+'"></span>':'')+'</div>'});
 bar+='</div>';
 let body='';
 if(cur==='cust'){body='<div class="pad search" style="margin-top:10px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('wzSearchC')+'" value="'+esc(wz.q)+'" oninput="ui.wz.q=this.value;wzReList()"></div></div><div class="pad list" id="wzlist" style="padding-bottom:12px">'+wzListHtml(DD().customers.filter(c=>!c.archived))+'</div>'}
 else{const col=wz.kind==='debt'?'var(--red)':'var(--green)';
  body='<div class="pad" style="margin-top:12px">'+(isP()?'':wizCustCard())
  +'<label class="lb">'+(wz.kind==='debt'?t('debtAmt'):t('amountNow'))+' ('+CUR()+')</label><div class="card" style="display:flex;align-items:center;border:1.8px solid '+col+'"><input id="wzA" class="num" autofocus enterkeyhint="done" style="flex:1;min-width:0;border:none;outline:none;background:none;font-size:28px;font-weight:900;padding:12px 14px" inputmode="decimal" placeholder="0.00" value="'+esc(wz.amt)+'" oninput="ui.wz.amt=this.value;wzLive()"></div><div id="wzLive">'+wzLiveHtml()+'</div>'
  +(wz.kind==='debt'?'<label class="lb">'+t('remind')+' — '+t('optF')+'</label><input class="inp" id="wzN" placeholder="'+t('remindPh')+'" value="'+esc(wz.note)+'" oninput="ui.wz.note=this.value"><label class="lb">'+t('due')+' — '+t('optF')+'</label><input class="inp num" id="wzD" type="date" style="min-width:0;font-size:13px" value="'+esc(wz.due)+'" oninput="ui.wz.due=this.value">'
  :'<label class="lb">'+t('method')+'</label><div class="seg">'+['cash','transfer','cardpay'].map(m=>'<button class="'+(wz.method===m?'on':'')+'" onclick="ui.wz.method=\''+m+'\';render()">'+t(m)+'</button>').join('')+'</div>')+'</div>'}
 let nav='<div class="bottombar" style="display:flex;gap:10px">';
 if(cur==='cust')nav+='<button class="btn btn-line" style="flex:1" onclick="wizExit()">'+ic('x',16)+t('cancel')+'</button>';
 else{nav+='<button class="btn '+(wz.kind==='debt'?'btn-red':'btn-green')+'" style="flex:1.6" onclick="wizConfirm()">'+ic('checkc',18)+(wz.kind==='debt'?t('confirmReg'):t('confirmPay'))+'</button>';
  nav+=(si>0?'<button class="btn btn-line" style="flex:1" onclick="ui.wz.step=0;render()">'+ic('back',16)+t('wzBack')+'</button>':'<button class="btn btn-line" style="flex:1" onclick="wizExit()">'+ic('x',16)+t('cancel')+'</button>')}
 nav+='</div>';
 return headerBar(wz.kind==='debt'?t('wizDebtT'):t('wizPayT'),null,'wizExit()')+bar+body+nav};
function wzLiveHtml(){const wz=ui.wz;if(!wz)return '';const amt=Money.parse(wz.amt);const c=isP()?null:cust(wz.custId);
 const before=c?custOpen(c.id):null;const after=before==null?null:(wz.kind==='debt'?before+amt:Math.max(0,before-amt));
 const hint=wz.kind==='pay'&&amt>0&&before>0?(before-amt<=0?t('willPaid'):(after<before?t('willPart'):'')):'';
 return '<div class="card" style="margin-top:12px;padding:14px 16px;background:linear-gradient(135deg,var(--navy-bg),var(--card))">'
 +'<div style="display:flex;align-items:center;gap:12px">'+(isP()?'<span class="av" style="width:40px;height:40px;background:var(--green-bg);color:var(--green)">'+ic('user',18)+'</span>':c?avat(c.name,40):'')+'<div class="sp"><b style="font-size:14px">'+(isP()?esc(curAcc().name):esc(c?c.name:''))+'</b><div class="muted" style="font-size:11.5px;margin-top:2px">'+(wz.kind==='debt'?t('wizDebtT'):t('wizPayT'))+(wz.kind==='debt'&&wz.note?' · '+esc(wz.note):'')+'</div></div><div class="num" style="font-size:26px;font-weight:900;color:'+(amt>0?(wz.kind==='debt'?'var(--red)':'var(--green)'):'var(--soft)')+'">'+fmt(amt)+' <span style="font-size:12px">'+CUR()+'</span></div></div>'
 +(c&&amt>0?'<div class="muted" style="display:flex;align-items:center;gap:7px;margin-top:10px;padding-top:9px;border-top:1px dashed var(--line);font-size:12px;flex-wrap:wrap"><span>'+t('nowOwe')+': <b class="num">'+fmt(before)+'</b></span><span>←</span><span>'+t('afterOp')+': <b class="num" style="color:'+(wz.kind==='debt'?'var(--red)':'var(--green)')+'">'+fmt(after)+'</b></span>'+(hint?'<span style="font-weight:800;color:var(--green)">✓ '+hint+'</span>':'')+'</div>':'')
 +'</div>'}
