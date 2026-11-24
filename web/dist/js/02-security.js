/* =====================================================================
 * Daftari · 02-security.js
 * ---------------------------------------------------------------------
 * App state + secure-at-rest crypto primitives
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const PLAIN='dafter_v3',SECK='dafter_v3_sec',ENC='dafter_v3_enc';
const MIN=6e4,H=36e5,D=864e5;
const uid=()=>Math.random().toString(36).slice(2,9);
let db=null,sec={enabled:false,salt:'',pinHash:'',autoMin:2,sound:true,vib:true,credId:null,fpWrap:null,fps:[],dark:false,speak:false,vosk:false,btName:''},sessionKey=null,masterKey=null,locked=false;
try{sec=Object.assign(sec,JSON.parse(localStorage.getItem(SECK)||'null')||{})}catch(e){}
if(!sec.fps)sec.fps=[];
if(sec.credId&&sec.fpWrap&&!sec.fps.length)sec.fps=[{id:sec.credId,wrap:sec.fpWrap}];
const saveSec=()=>{try{localStorage.setItem(SECK,JSON.stringify(sec))}catch(e){}};
function save(){_IX=null;
 if(sec.enabled&&masterKey){encJSON(db,masterKey).then(p=>{try{localStorage.setItem(ENC,JSON.stringify(p));localStorage.removeItem(PLAIN)}catch(e){toastMsg(t('quota'))}})}
 else{try{localStorage.setItem(PLAIN,JSON.stringify(db));localStorage.removeItem(ENC)}catch(e){toastMsg(t('quota'))}}
 Store.persist();
 try{let tot=0;for(const k in localStorage)tot+=localStorage[k].length*2;if(tot>4*1024*1024&&!window.__qw){window.__qw=1;setTimeout(()=>toastMsg('⚠ '+t('quotaWarn')),60)}}catch(e){}
}
const te=new TextEncoder(),td=new TextDecoder();
async function sha256hex(s){try{if(crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',te.encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}
 let out='';for(let r=0;r<4;r++){let h=(0x811c9dc5^ (r*0x9e3779b9))>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}out+=h.toString(16).padStart(8,'0')}return out}
async function deriveKey(pin,salt){const km=await crypto.subtle.importKey('raw',te.encode(pin),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:te.encode(salt),iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function newMaster(){return crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt'])}
async function wrapKey(mk,withKey){const raw=await crypto.subtle.exportKey('raw',mk);const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},withKey,raw);return{iv:[...iv],ct:[...new Uint8Array(ct)]}}
async function unwrapKey(pack,withKey){try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(pack.iv)},withKey,new Uint8Array(pack.ct));return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}catch(e){return null}}
async function encJSON(obj,key){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,te.encode(JSON.stringify(obj)));return{iv:[...iv],ct:[...new Uint8Array(ct)]}}
async function decJSON(pack,key){try{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(pack.iv)},key,new Uint8Array(pack.ct));return JSON.parse(td.decode(pt))}catch(e){return null}}
