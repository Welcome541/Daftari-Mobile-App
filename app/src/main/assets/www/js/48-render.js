/* =====================================================================
 * Daftari · 48-render.js
 * ---------------------------------------------------------------------
 * Screen registry + render loop
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_trash=p=>{const list=(DD().trash||[]).slice().sort((a,b)=>b.ts-a.ts);
 return headerBar(t('trashT'),null,"stack=[{s:'settings'}];render()")
 +'<div class="pad list" style="margin-top:10px;padding-bottom:10px">'+(list.length?list.map(e=>{const o=e.o;const c=o.cust?cust(o.cust):null;
  const cc=e.k==='c'?e.o:c;
  return '<div class="card litem">'+(cc?avat(cc.name,44):'<span class="av" style="width:44px;height:44px;background:'+(e.k==='d'?'var(--red-bg);color:var(--red)':'var(--green-bg);color:var(--green)')+'">'+ic(e.k==='d'?'receipt':'banknote',18)+'</span>')+'<div class="sp"><b>'+esc(cc?cc.name:t(e.k==='d'?'debt':'pay'))+'</b>'+(e.k==='c'?'<div class="muted" style="font-size:11.5px;margin-top:2px">'+t('cust')+' · '+dateStr(e.ts)+'</div>':'<div class="muted" style="font-size:11.5px;margin-top:2px">'+(e.k==='d'?ic('receipt',12):ic('banknote',12))+' '+esc(o.note||(e.k==='p'?(o.method||''):''))+' · '+dateStr(o.ts)+'</div>')+'</div>'+(e.k==='c'?'':('<span class="amt '+(e.k==='d'?'red':'green')+'"><span class="num">'+fmt(o.amount)+'</span> '+CUR()+'</span>'))+'<button class="btn btn-soft" style="width:auto;padding:8px 12px;font-size:12.5px;white-space:nowrap" onclick="trashRestore(\''+o.id+'\')">'+ic('undo',14)+t('restore')+'</button></div>'}).join('')
 :'<div class="muted" style="text-align:center;padding:34px 0">'+ic('trash',28)+'<div style="margin-top:10px;font-weight:700">'+t('trashEmptyS')+'</div></div>')+'</div>'
 +(list.length?'<div class="pad" style="padding-top:0"><button class="btn btn-red" style="width:100%" onclick="trashPurge()">'+ic('trash',16)+' '+t('emptyTrash')+'</button></div>':'')};
const SCREENS={home:S_home,customers:S_customers,reports:S_reports,settings:S_settings,profile:S_profile,invoice:S_invoice,voice:S_voice,rec:S_rec,wiz:S_wiz,repb:S_repb,newcust:S_newcust,trash:S_trash,lock:()=>S_lock()};
const TABS=['home','customers','reports','settings'];
function render(){_IX=null;if(!db){document.getElementById('app').innerHTML='';return}
 applyLang();
 if(locked){document.getElementById('app').innerHTML=S_lock();document.getElementById('tabbar').style.display='none';document.getElementById('actionrow').innerHTML='';document.getElementById('fabAdd').classList.add('hide');return}
 const tp=curScr();const S=SCREENS[tp.s]||S_home;
 document.getElementById('app').innerHTML=S(tp.p||{});
 const isTab=['home','customers','reports','settings'].includes(tp.s);
 const tb=document.getElementById('tabbar');tb.style.display=isTab?'grid':'none';
 const tbBtn=x=>'<button class="'+(tp.s===x?'on':'')+'" aria-current="'+(tp.s===x?'true':'false')+'" onclick="tab(\''+x+'\')"><span class="tbind">'+ic(x==='home'?'home':x==='customers'?'users':x==='reports'?'pie':'gear',24)+'</span><span class="tblb">'+t(x)+'</span></button>';
 tb.innerHTML=tbBtn('home')+tbBtn('customers')+'<button class="tabplus" aria-label="'+t('addC')+'" onclick="ui.nc={name:\'\',phone:\'\',edit:null};go(\'newcust\',{})">'+ic('plus',24)+'</button>'+tbBtn('reports')+tbBtn('settings');
 const ar=document.getElementById('actionrow');
 ar.innerHTML=isTab?((tp.s==='home'&&(ui.sel&&ui.sel.on))?selBarHtml():((tp.s==='customers'&&(ui.csel&&ui.csel.on))?custSelBar():(tp.s==='home'?lpBtn('debt','btn-red','receipt',t('newDebt'))+lpBtn('pay','btn-green','coins',t('pay')):''))):'';
 document.getElementById('fabAdd').classList.add('hide');
 if(!locked&&typeof drawCharts==='function'&&['reports','repb'].includes((curScr()||{}).s))requestAnimationFrame(()=>{try{if(!locked&&['reports','repb'].includes((curScr()||{}).s))drawCharts()}catch(e){}});
 window.scrollTo(0,0);}
