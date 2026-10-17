/* =====================================================================
 * Daftari · 34-screen-profile.js
 * ---------------------------------------------------------------------
 * SCREEN: customer profile + invoice
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function focusCard(key,o,c){const debt=key[0]==='d';const st=debt?invStatus(o):null;const rem=debt?invRem(o.id):0;
 return '<div class="pad" style="margin-top:12px"><div class="card" style="border:2px solid var(--navy);box-shadow:0 10px 24px rgba(13,31,58,.14);padding:14px 16px;animation:dockIn .25s ease both">'
 +'<div class="row"><span class="kic" style="background:'+(debt?'var(--red-bg);color:var(--red)':'var(--green-bg);color:var(--green)')+'">'+ic(debt?'receipt':'coins',19)+'</span><div class="sp"><div style="font-weight:800">'+(debt?t('invoice')+(o.code?' <span class="num">'+o.code+'</span>':''):t('pay'))+'</div><div class="muted" style="font-size:11.5px;margin-top:2px">'+ic('clock',11)+' '+dateStr(o.ts)+' · '+timeStr(o.ts)+(o.note?' · '+esc(o.note):'')+'</div></div>'+(debt?badge(st):'')+'<div class="amt '+(debt?(st==='paid'?'green':'red'):'green')+'" style="font-size:19px"><span class="num">'+fmt(o.amount)+'</span> '+CUR()+'</div></div>'
 +(debt?'<div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="chip" style="background:#efece6;color:var(--soft)">'+t('total')+': <span class="num">'+fmt(o.amount)+'</span></span><span class="chip" style="background:var(--green-bg);color:var(--green)">'+t('paidLbl')+': <span class="num">'+fmt(invPaid(o.id))+'</span></span><span class="chip" style="background:var(--red-bg);color:var(--red)">'+t('remaining')+': <span class="num">'+fmt(rem)+'</span></span></div>'
 :'<div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="chip" style="background:var(--green-bg);color:var(--green)">'+t('method')+': '+t(o.method||'cash')+'</span><span class="chip" style="background:#efece6;color:var(--soft)">'+((o.alloc&&o.alloc.length)||0)+' '+t('payLog')+'</span></div>')
 +'<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-soft" style="flex:1" onclick="shareOne(\''+key+'\')">'+ic('share',16)+t('share')+'</button>'
 +(debt&&c&&c.phone&&rem>0?'<button class="btn btn-soft" style="flex:1;color:var(--green)" onclick="waRemind(\''+o.id+'\')">'+ic('wa',16)+t('waRemind')+'</button>':'')
 +(debt&&rem>0?'<button class="btn btn-green" style="flex:1" onclick="go(\'pay\',{cust:\''+c.id+'\'})">'+ic('coins',16)+t('payRemaining')+'</button>':'')
 +(debt?'<button class="btn btn-line" style="flex:1" onclick="openInvEdit(\''+o.id+'\')">'+ic('edit',16)+t('editL')+'</button>':'<button class="btn btn-line" style="flex:1" onclick="openPayDet(\''+o.id+'\')">'+ic('fwd',16)+t('opDet')+'</button>')
 +'</div></div></div>'}
function shareOne(key){const o=selFind(key);if(!o)return;const c=o.cust?cust(o.cust):null;
 const txt=curAcc().name+' — '+(c?c.name+' · ':'')+(key[0]==='d'?t('debt'):t('pay'))+' '+fmt(o.amount)+' '+CUR()+' · '+dateStr(o.ts)+(key[0]==='d'&&o.note?' · '+o.note:'')+(key[0]==='p'?' · '+t(o.method||'cash'):'');
 if(navigator.share){navigator.share({text:txt}).catch(()=>{})}else if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toastMsg(t('copied'))).catch(()=>toastMsg(t('copied')))}else toastMsg(t('copied'))}
function custFeed(id){const evs=[];
 DD().invoices.filter(i=>i.cust===id).forEach(i=>{evs.push({ts:i.ts,k:i.k==='open'?'open':'debt',amt:i.amount,id:i.id,code:i.code,note:i.note});(i.edits||[]).forEach(e=>evs.push({ts:e.ts,k:'edit',from:e.from,to:e.to,id:i.id,code:i.code,note:e.note}))});
 DD().payments.filter(pp=>pp.cust===id).forEach(pp=>evs.push({ts:pp.ts,k:'pay',amt:pp.amount,id:pp.id,alloc:pp.alloc}));
 evs.sort((a,b)=>b.ts-a.ts);return evs}
function cfRow(e,cid){const icn=e.k==='pay'?'coins':e.k==='edit'?'undo':e.k==='open'?'hist':'receipt';
 const col=e.k==='pay'?'var(--green)':e.k==='edit'?'var(--amber)':'var(--red)';
 const bg=e.k==='pay'?'var(--green-bg)':e.k==='edit'?'var(--amber-bg)':'var(--red-bg)';
 const lb=e.k==='pay'?t('pay'):e.k==='edit'?t('ret'):e.k==='open'?t('opening'):t('newDebt');
 const amt=e.k==='pay'?'+ <span class="num">'+fmt(e.amt)+'</span> '+CUR():e.k==='edit'?'<span class="num">'+fmt(e.from)+' \u2190 '+fmt(e.to)+'</span>':'- <span class="num">'+fmt(e.amt)+'</span> '+CUR();
 const oc=(e.k==='pay'||e.k==='debt'||e.k==='open')&&cid?'go(\'profile\',{id:\''+cid+'\',focus:\''+(e.k==='pay'?'p:':'d:')+e.id+'\'})':(e.k==='pay'?'openPayDet(\''+e.id+'\')':'go(\'invoice\',{id:\''+e.id+'\'})');
 return '<div class="card litem" onclick="'+oc+'"><span class="kic" style="background:'+bg+';color:'+col+'">'+ic(icn,17)+'</span><div class="sp"><div style="font-weight:800;font-size:14px">'+lb+(e.code?' \u00b7 <span class="num">'+e.code+'</span>':'')+'</div><div class="muted" style="font-size:11.5px;margin-top:3px">'+ic('clock',11)+' '+rel(e.ts)+' \u00b7 '+dateStr(e.ts)+(e.note?' \u00b7 '+esc(e.note):'')+'</div></div><div style="text-align:end"><span class="amt" style="color:'+col+'">'+amt+'</span></div></div>';}
function openPayDet(id){const p=DD().payments.find(x=>x.id===id);if(!p)return;
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('payDet')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<div class="muted" style="margin-bottom:10px">'+dateStr(p.ts)+' \u00b7 '+timeStr(p.ts)+' \u00b7 '+money(p.amount)+'</div>'
 +((p.alloc&&p.alloc.length)?p.alloc.map(a=>{const i=DD().invoices.find(x=>x.id===a.inv);return '<button class="srow" onclick="closeSheet();go(\'invoice\',{id:\''+a.inv+'\'})"><span class="sic2">'+ic('receipt',18)+'</span><span class="sp" style="text-align:start"><span class="t">'+(i?t('invoice')+' <span class="num">'+i.code+'</span>':t('invoice'))+'</span></span><span class="amt green">'+money(a.amt)+'</span></button>'}).join(''):'<div class="muted">'+t('noRes')+'</div>'))}
function openInvEdit(id){const i=DD().invoices.find(x=>x.id===id);if(!i)return;
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+t('invEditT')+' <span class="num">'+i.code+'</span></h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div>'
 +'<label class="lb">'+t('debtAmt')+' ('+CUR()+')</label><input class="inp num" id="ieA" inputmode="decimal" value="'+fmt(i.amount)+'">'
 +'<label class="lb">'+t('remind')+' — '+t('optF')+'</label><input class="inp" id="ieN" value="'+esc(i.note||'')+'" placeholder="'+t('remindPh')+'">'
 +'<label class="lb">'+t('due')+' — '+t('optF')+'</label><input class="inp num" id="ieD" type="date" value="'+(i.due?new Date(i.due).toISOString().slice(0,10):'')+'">'
 +'<div class="row" style="gap:10px;margin-top:16px"><button class="btn btn-line" style="flex:1" onclick="closeSheet()">'+t('cancel')+'</button><button class="btn btn-navy" style="flex:1.4" onclick="saveInvEdit(\''+id+'\')">'+ic('save',17)+' '+t('saveC')+'</button></div>')}
function saveInvEdit(id){const i=DD().invoices.find(x=>x.id===id);if(!i)return;const na=Money.parse(document.getElementById('ieA').value);
 if(na<=0){toastMsg(t('enterAmt'));return}
 if(na!==i.amount){i.edits=i.edits||[];i.edits.push({ts:Date.now(),from:i.amount,to:na,note:t('editL')})}
 i.amount=na;i.note=(document.getElementById('ieN').value||'').trim();const dv=document.getElementById('ieD').value;i.due=dv?+new Date(dv+'T00:00:00'):null;
 save();closeSheet();render();toastMsg(t('savedC'))}
const S_profile=p=>{const c=cust(p.id);if(!c)return S_home();
 const invs=custInvoices(c.id);const evs=custFeed(c.id);
 return headerBar(t('custAcc'),null,'back()','openCustMenu(\''+c.id+'\')')
 +'<div class="pad"><div class="card" style="padding:17px"><div class="row"><span class="av" style="width:62px;height:62px;font-size:21px;padding:0;cursor:pointer;background:'+(c.photo?'none':avColor(c.name))+'" onclick="openPhotoSheet(\''+c.id+'\')" aria-label="'+t('photoT')+'">'+(c.photo?'<img src="'+c.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(initials(c.name)))+'</span><div class="sp"><div style="font-size:19px;font-weight:800">'+esc(c.name)+'</div>'+(c.phone?'<div class="muted" style="margin-top:3px">'+ic('phone',12)+' <span class="num">'+esc(c.phone)+'</span></div>':'')+'</div>'+(c.pinned?ic('pin',20):'')+'</div><div class="muted" style="margin-top:8px">'+t('since')(c.since)+'</div></div></div>'
 + (c.archived?'<div class="pad" style="margin-top:10px"><button class="btn btn-line" onclick="cust(\''+c.id+'\').archived=false;save();render()">'+ic('undo',17)+t('restore')+'</button></div>':'')+
 '<div class="pad stats" style="margin-top:12px"><div class="stat red"><div class="t">'+t('remaining')+'</div><div class="v">'+money(custOpen(c.id))+'</div></div><div class="stat green"><div class="t">'+t('totalPaid')+'</div><div class="v">'+money(custPaid(c.id))+'</div></div></div>'
 +(p.focus&&selFind(p.focus)?focusCard(p.focus,selFind(p.focus),c):'')
 +'<div class="pad" style="margin:14px 20px 4px;font-weight:800;font-size:16.5px;display:flex;align-items:center;gap:8px">'+ic('hist',16)+' '+t('txAll')+' <span class="chip" style="background:#efece6;color:var(--soft)"><span class="num">'+evs.length+'</span></span></div>'
 +'<div class="pad list" id="pfeed" style="margin-top:6px;padding-bottom:4px">'+(evs.length?evs.map(x=>cfRow(x,c.id)).join(''):'<div class="muted" style="text-align:center;padding:22px 0">'+t('noOps')+'</div>')+'</div>'
 +'<div class="pad" style="margin:14px 20px 4px;font-weight:800;font-size:16.5px">'+ic('receipt',16)+' '+t('invoices')+'</div>'

 +'<div class="pad list" style="margin-top:14px;padding-bottom:8px">'+(invs.length?invs.map(invCard).join(''):'<div class="muted" style="text-align:center;padding:22px 0">'+t('noInv')+'</div>')+'</div>'
 +'<div class="bottombar">'+lpBtn('debt','btn-red','receipt',t('newDebt'))+lpBtn('pay','btn-green','coins',t('pay'))+'</div>';
};
function invCard(i){const st=invStatus(i),rem=invRem(i);
 return '<div class="card inv '+st+'" onclick="go(\'invoice\',{id:\''+i.id+'\'})"><div class="row"><span class="kic" style="background:'+(st==='paid'?'var(--green-bg);color:var(--green)':st==='part'?'var(--amber-bg);color:var(--amber)':'var(--red-bg);color:var(--red)')+'">'+(st==='paid'?ic('checkc',19):ic('receipt',19))+'</span><div class="sp"><div style="font-weight:800">'+t('invoice')+' <span class="num">'+i.code+'</span></div><div class="muted" style="margin-top:3px">'+ic('clock',12)+' '+rel(i.ts)+' · '+dateStr(i.ts)+' · '+timeStr(i.ts)+'</div>'+(i.note?'<div class="soft" style="font-size:13px;margin-top:5px;border-top:1px dashed var(--line);padding-top:5px">'+ic('tag',12)+' '+esc(i.note)+'</div>':'')+'</div><div style="text-align:end">'+badge(st)+'<div class="amt '+(st==='paid'?'green':'red')+'" style="margin-top:7px">'+money(st==='paid'?i.amount:rem)+'</div></div></div></div>';
}
const S_invoice=p=>{const i=DD().invoices.find(x=>x.id===p.id);if(!i)return S_home();const c=cust(i.cust),st=invStatus(i),paid=invPaid(i.id),rem=invRem(i);
 const pays=DD().payments.filter(x=>x.alloc.some(a=>a.inv===i.id)).sort((a,b)=>a.ts-b.ts);
 return headerBar(t('invoice')+' <span class="num">'+i.code+'</span>',null,'back()','openExport(\''+c.id+'\')')
 +'<div class="pad"><div class="card" style="padding:17px"><div class="row">'+(c?avat(c.name,50):'<span class="av" style="width:50px;height:50px;background:var(--red-bg);color:var(--red)">'+ic('receipt',20)+'</span>')+'<div class="sp"><div style="font-weight:800;font-size:16.5px">'+(c?esc(c.name):esc(i.note||t('expense')))+'</div><div class="muted" style="margin-top:3px">'+dateStr(i.ts)+' · '+timeStr(i.ts)+'</div></div>'+badge(st)+'</div>'
 +'<div class="stats" style="margin-top:15px;grid-template-columns:1fr 1fr 1fr"><div style="text-align:center"><div class="muted">'+t('total')+'</div><div class="amt" style="font-size:17px;margin-top:4px">'+money(i.amount)+'</div></div><div style="text-align:center;border-inline:1px solid var(--line2)"><div class="muted">'+t('paidLbl')+'</div><div class="amt green" style="font-size:17px;margin-top:4px">'+money(paid)+'</div></div><div style="text-align:center"><div class="muted">'+t('remaining')+'</div><div class="amt red" style="font-size:17px;margin-top:4px">'+money(rem)+'</div></div></div></div></div>'
 +'<div class="pad" style="margin-top:12px"><button class="btn" style="width:100%;background:var(--amber-bg);color:var(--amber)" onclick="openReturnSheet(\''+i.id+'\')">'+ic('undo',16)+t('retT')+'</button></div>'
 +((i.edits&&i.edits.length)?'<div class="pad" style="margin:14px 20px 7px;font-weight:800;color:var(--amber)">'+ic('edit',16)+' '+t('editsLog')+'</div><div class="pad" style="margin-top:0"><div class="card" style="padding:4px 16px">'+i.edits.slice().reverse().map(e=>'<div class="kv"><span class="kic" style="background:var(--amber-bg);color:var(--amber)">'+ic('undo',15)+'</span><div class="k">'+t('ret')+'<div class="muted" style="font-size:11px">'+dateStr(e.ts)+' · '+timeStr(e.ts)+(e.note?' · '+esc(e.note):'')+'</div></div><span class="v amt" style="color:var(--amber)">'+fmt(e.from)+' ← '+fmt(e.to)+'</span></div>').join('')+'</div></div>':'')
 +(i.due?'<div class="pad" style="margin-top:12px"><div class="card" style="padding:11px 16px;display:flex;align-items:center;gap:10px;border-color:'+(isOverdue(i)?'var(--red-line)':'var(--line2)')+'"><span style="width:36px;height:36px;border-radius:11px;background:'+(isOverdue(i)?'var(--red-bg);color:var(--red)':'var(--amber-bg);color:var(--amber)')+';display:flex;align-items:center;justify-content:center;flex:none">'+ic('cal',17)+'</span><div class="sp"><div class="muted" style="font-size:11.5px">'+t('due')+'</div><div style="font-weight:700">'+dateStr(i.due)+(isOverdue(i)?' · <b style="color:var(--red)">'+t('overdue')+'</b>':'')+'</div></div></div></div>':'')
 +(c&&c.phone&&rem>0?'<div class="pad" style="margin-top:12px"><button class="btn btn-green" onclick="waRemind(\''+i.id+'\')">'+ic('wa',18)+t('waRemind')+'</button></div>':'')
 +'<div class="pad" style="margin:16px 20px 7px;font-weight:800">'+ic('hist',16)+' '+t('payLog')+'</div>'
 +'<div class="pad"><div class="card" style="padding:4px 16px">'+(pays.length?pays.map((x,n)=>'<div class="kv"><span class="kic" style="background:var(--green-bg);color:var(--green)">'+ic('checkc',17)+'</span><span class="k">'+t('payOf')+' <span class="num">'+(n+1)+'</span><br><span style="font-size:11.5px">'+dateStr(x.ts)+' · '+timeStr(x.ts)+'</span></span><span class="v amt green">'+money(x.alloc.find(a=>a.inv===i.id).amt)+'</span></div>').join(''):'<div class="muted" style="text-align:center;padding:20px 0">'+t('noPay')+'</div>')+'</div></div>'
 +'<div class="bottombar" style="flex-direction:column">'+(rem>0?'<button class="btn btn-green" onclick="go(\'pay\',{cust:\''+c.id+'\'})">'+ic('coins',18)+t('payRemaining')+'</button>':'')+'<button class="btn btn-line" onclick="openExport(\''+c.id+'\')">'+ic('share',17)+t('shareReceipt')+'</button></div>';
};
