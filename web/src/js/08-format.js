/* =====================================================================
 * Daftari · 08-format.js
 * ---------------------------------------------------------------------
 * Money / date / avatar formatting
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const normAr=v=>{const AR='٠١٢٣٤٥٦٧٨٩';let t=String(v||'').replace(/[\u064B-\u0652\u0670]/g,'').replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627');return t.split('').map(ch=>{const i=AR.indexOf(ch);return i>=0?String(i):ch}).join('').replace(/\s+/g,' ').trim()};
const MU=()=>{try{const a=curAcc();return (a&&a.minorUnit)||2}catch(e){return 2}};
const fmt=m=>{const mu=MU(),pw=Math.pow(10,mu);m=Math.round(Number(m)||0);const neg=m<0;m=Math.abs(m);const i=Math.floor(m/pw),f=String(m%pw).padStart(mu,'0');return (neg?'−':'')+i.toLocaleString('en-US')+(mu>0?'.'+f:'')};
const Money={parse(v){const mu=MU(),pw=Math.pow(10,mu);let t=String(v==null?'':v).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[،\s]/g,'').replace(/٫/g,'.').replace(/,(?=\d{3}(?!\d))/g,'').replace(/,/g,'.');const neg=/^-/.test(t);t=t.replace(/[-+]/g,'');if(!/^\d*(\.\d*)?$/.test(t))return 0;const pp=t.split('.');const fr=(pp[1]||'').slice(0,mu).padEnd(mu,'0');return (neg?-1:1)*((parseInt(pp[0]||'0',10)||0)*pw+parseInt(fr||'0',10))},fromNumber(x){return Math.round((Number(x)||0)*Math.pow(10,MU()))},dec(m){const mu=MU(),pw=Math.pow(10,mu);m=Math.round(Number(m)||0);const neg=m<0;m=Math.abs(m);return (neg?'-':'')+Math.floor(m/pw)+'.'+String(m%pw).padStart(mu,'0')}};
const CUR=()=>curAcc().cur;
const money=n=>'<span class="num">'+fmt(n)+'</span> '+CUR();
const MON={ar:['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
const dateStr=ts=>{const d=new Date(ts);return '<span class="num">'+d.getDate()+'</span> '+MON[db.lang][d.getMonth()]+' <span class="num">'+d.getFullYear()+'</span>'};
const timeStr=ts=>{const d=new Date(ts);let h=d.getHours();const ap=h<12?(db.lang==='ar'?'ص':'AM'):(db.lang==='ar'?'م':'PM');h=((h+11)%12)+1;return '<span class="num">'+h+':'+String(d.getMinutes()).padStart(2,'0')+'</span> '+ap};
const rel=ts=>{const df=Date.now()-ts;if(df<90e3)return t('justNow');if(df<H)return t('minAgo')(Math.max(1,Math.round(df/MIN)));if(df<D&&new Date(ts).getDate()!==new Date().getDate())return t('yest');if(df<D)return t('hrAgo')(Math.round(df/H));if(df<2*D)return t('yest');return t('dayAgo')(Math.round(df/D))};
const initials=n=>{const w=n.trim().split(/\s+/);return w.length>1?w[0][0]+'. '+w[w.length-1][0]:n.slice(0,2)};
const AVC=['#1d4ed8','#0e6b47','#5b21b6','#9f1239','#8a5a12','#0f6472','#a71949','#4b5563'];
const avColor=n=>{let h=7;for(let k=0;k<n.length;k++)h=(h*31+n.charCodeAt(k))>>>0;const a=AVC[h%AVC.length];let b=AVC[(h>>>4)%AVC.length];if(b===a)b=AVC[(h>>>4)%AVC.length^1];return 'linear-gradient(135deg,'+a+','+b+')';};
const avat=(name,size)=>{const c=(typeof db!=='undefined'&&db&&db.data)?(DD().customers.find(x=>x.name===name)||null):null;
 if(c&&c.photo)return '<span class="av" style="width:'+size+'px;height:'+size+'px;padding:0"><img src="'+c.photo+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></span>';
 return '<span class="av" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*0.34)+'px;background:'+avColor(name)+'">'+esc(initials(name))+'</span>'};
const esc=s=>String(s).replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const STLBL={open:()=>t('open'),part:()=>t('part'),paid:()=>t('paid')};
const badge=st=>'<span class="chip b-'+st+'"><span class="dot"></span>'+STLBL[st]()+'</span>';
