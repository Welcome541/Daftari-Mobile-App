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
/* Similar-name helpers for dozens of "محمد أحمد" — show phone when close */
function nameTokens(nm){let t=normAr(nm).toLowerCase().replace(/[\u0640]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();if(!t) return [];return t.split(/\s+/).map(w=>{if(w.length>3&&w.startsWith('\u0627\u0644')) return w.slice(2);return w;}).filter(Boolean);}
function levDist(a,b){const m=a.length,n=b.length;if(!m) return n;if(!n) return m;let p=new Array(n+1),c=new Array(n+1);for(let j=0;j<=n;j++) p[j]=j;for(let i=1;i<=m;i++){c[0]=i;for(let j=1;j<=n;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));}[p,c]=[c,p];}return p[n];}
function similarScore(a,b){const an=normAr(a).toLowerCase().trim(),bn=normAr(b).toLowerCase().trim();if(!an||!bn) return 0;if(an===bn) return 1;const at=nameTokens(a),bt=nameTokens(b);const as=new Set(at),bs=new Set(bt);let inter=0;for(const x of as) if(bs.has(x)) inter++;const uni=as.size+bs.size-inter;const jac=uni?inter/uni:0;const ld=levDist(an,bn),ml=Math.max(an.length,bn.length);const levS=ml?1-ld/ml:0;let sub=0;if(an.includes(bn)||bn.includes(an)){const r=Math.min(an.length,bn.length)/Math.max(an.length,bn.length);if(r>0.65) sub=r;}return Math.max(jac,levS,sub);}
function findSimilarCustomers(inputName,excludeId){if(!inputName||!inputName.trim()) return [];const res=[];for(const cc of DD().customers){if(cc.archived) continue;if(excludeId&&cc.id===excludeId) continue;const sc=similarScore(inputName,cc.name);if(sc>=0.6) res.push({c:cc,score:sc});}res.sort((a,b)=> b.score-a.score || a.c.name.localeCompare(b.c.name,'ar'));return res;}
const MU=()=>{try{const a=curAcc();return (a&&a.minorUnit)||2}catch(e){return 2}};
/* Whole amounts print without decimals ("150"); an amount that really
   has a fraction keeps its two decimals ("150.50"). */
const fmt=m=>{const mu=MU(),pw=Math.pow(10,mu);m=Math.round(Number(m)||0);const neg=m<0;m=Math.abs(m);const i=Math.floor(m/pw),f=String(m%pw).padStart(mu,'0');return (neg?'−':'')+i.toLocaleString('en-US')+(mu>0&&/[1-9]/.test(f)?'.'+f:'');};
const Money={parse(v){const mu=MU(),pw=Math.pow(10,mu);let t=String(v==null?'':v).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[،\s]/g,'').replace(/٫/g,'.').replace(/,(?=\d{3}(?!\d))/g,'').replace(/,/g,'.');const neg=/^-/.test(t);t=t.replace(/[-+]/g,'');if(!/^\d*(\.\d*)?$/.test(t))return 0;const pp=t.split('.');const fr=(pp[1]||'').slice(0,mu).padEnd(mu,'0');return (neg?-1:1)*((parseInt(pp[0]||'0',10)||0)*pw+parseInt(fr||'0',10))},fromNumber(x){return Math.round((Number(x)||0)*Math.pow(10,MU()))},dec(m){const mu=MU(),pw=Math.pow(10,mu);m=Math.round(Number(m)||0);const neg=m<0;m=Math.abs(m);return (neg?'-':'')+Math.floor(m/pw)+'.'+String(m%pw).padStart(mu,'0')}};
const CUR=()=>curAcc().cur;
const money=n=>'<span class="num">'+fmt(n)+'</span> '+CUR();
const MON={ar:['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
const dateStr=ts=>{const d=new Date(ts);return '<span class="num">'+d.getDate()+'</span> '+MON[db.lang][d.getMonth()]+' <span class="num">'+d.getFullYear()+'</span>';};
const timeStr=ts=>{const d=new Date(ts);let h=d.getHours();const ap=h<12?(db.lang==='ar'?'ص':'AM'):(db.lang==='ar'?'م':'PM');h=((h+11)%12)+1;return '<span class="num">'+h+':'+String(d.getMinutes()).padStart(2,'0')+'</span> '+ap};
/* Operation time helpers: hasTime indicates whether ts carries a real clock time.
   Legacy records without hasTime are inferred: midnight => no time, otherwise has time.
   Paper imports set hasTime=false + midnight ts + createdAt=now. */
const opHasTime=o=>{
  if(!o) return false;
  if(typeof o.hasTime==='boolean') return o.hasTime;
  if(o.ts==null) return false;
  const d=new Date(o.ts);
  return !(d.getHours()===0 && d.getMinutes()===0 && d.getSeconds()===0);
};
const opTimeStr=o=> opHasTime(o) ? timeStr(o.ts) : '';
const rel=ts=>{const df=Date.now()-ts;if(df<90e3)return t('justNow');if(df<H)return t('minAgo')(Math.max(1,Math.round(df/MIN)));if(df<D&&new Date(ts).getDate()!==new Date().getDate())return t('yest');if(df<D)return t('hrAgo')(Math.round(df/H));if(df<2*D)return t('yest');return t('dayAgo')(Math.round(df/D))};
/* Avatar: fixed navy color (no semantic debt/pay color) + one distinct Arabic letter.
   _buildAvCache assigns a unique letter per customer to avoid repeats like "م. ع". */
const _arabicABC=['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
let _avCache=null,_avCacheSize=-1;
function _avatarCandidates(name){
  const n=String(name||'').trim();
  if(!n) return [];
  const words=n.split(/\s+/).filter(Boolean);
  const cands=[];
  const push=ch=>{ if(ch && !cands.includes(ch)) cands.push(ch); };
  words.forEach(w=>push(w[0]));
  for(const ch of n.replace(/\s+/g,'')){
    if(/\p{L}/u.test(ch)) push(ch);
  }
  for(const ch of n.replace(/\s+/g,'')){
    push(ch);
  }
  words.forEach(w=>{ for(let i=1;i<w.length;i++) push(w[i]); });
  return cands.filter(ch=>ch && ch.trim());
}
function _buildAvCache(){
  _avCache={};
  let customers=[];
  try{ customers=(typeof DD==='function'&&DD()&&DD().customers)?DD().customers:[]; }catch(e){ customers=[]; }
  const used=new Set();
  const list=customers.filter(c=>!c.archived);
  for(const c of list){
    const cands=_avatarCandidates(c.name);
    let pick=null;
    for(const cand of cands) if(!used.has(cand)){ pick=cand; break; }
    if(!pick){
      for(const a of _arabicABC) if(!used.has(a)){ pick=a; break; }
    }
    if(!pick) pick=cands[0]|| (String(c.name||'').trim()[0]||'?');
    _avCache[c.id]=pick;
    used.add(pick);
  }
  _avCacheSize=list.length;
}
function ensureAvCache(){
  try{
    const cs=(typeof DD==='function'&&DD()&&DD().customers)?DD().customers:null;
    const sz=cs?cs.filter(c=>!c.archived).length:-1;
    if(_avCache===null || _avCacheSize!==sz) _buildAvCache();
  }catch(e){}
}
function avatarLetter(cid, fallbackName){
  ensureAvCache();
  if(cid && _avCache && _avCache[cid]) return _avCache[cid];
  if(fallbackName){
    try{
      const cust=(typeof DD==='function'&&DD())?DD().customers.find(x=>x.name===fallbackName && !x.archived):null;
      if(cust && _avCache[cust.id]) return _avCache[cust.id];
    }catch(e){}
    const cands=_avatarCandidates(fallbackName);
    return cands[0]||String(fallbackName).trim()[0]||'?';
  }
  return '?';
}
const initials=n=>{
  const s=String(n||'').trim();
  if(!s) return '';
  ensureAvCache();
  try{
    const cust=(typeof DD==='function'&&DD())?DD().customers.find(x=>x.name===s && !x.archived):null;
    if(cust && _avCache[cust.id]) return esc(_avCache[cust.id]);
  }catch(e){}
  return esc(s[0]);
};
const avColor=n=>'var(--navy)';
/* `size` is either a number (pixels) or a CSS length, so a row that
   follows the reference frame can size its avatar from a token
   (e.g. 'var(--row-av)') instead of a hard-coded pixel value. */
const avat=(name,size,cid)=>{
 const custObj=(cid && typeof DD==='function' && DD())? DD().customers.find(x=>x.id===cid) : null;
 const byName=(typeof DD==='function'&&DD())? DD().customers.find(x=>x.name===name && !x.archived) : null;
 const effCid=cid || (custObj?custObj.id:null) || (byName?byName.id:null);
 const c=(effCid && typeof DD==='function' && DD()) ? DD().customers.find(x=>x.id===effCid) : (byName||custObj||null);
 const len=typeof size==='number'?size+'px':size;
 const fs=typeof size==='number'?Math.round(size*0.34)+'px':'calc('+size+' * 0.34)';
 if(c&&c.photo)return '<span class="av" style="width:'+len+';height:'+len+';padding:0"><img src="'+c.photo+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></span>';
 const letter = effCid ? avatarLetter(effCid, name) : avatarLetter(null, name);
 return '<span class="av" style="width:'+len+';height:'+len+';font-size:'+fs+';background:'+avColor(name)+'">'+esc(letter)+'</span>'};
const esc=s=>String(s).replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
const STLBL={open:()=>t('open'),part:()=>t('part'),paid:()=>t('paid')};
const badge=st=>'<span class="chip b-'+st+'"><span class="dot"></span>'+STLBL[st]()+'</span>';
