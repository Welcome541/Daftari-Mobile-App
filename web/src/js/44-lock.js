/* =====================================================================
 * Daftari · 44-lock.js
 * ---------------------------------------------------------------------
 * PIN lock, fingerprint, auto-lock
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
let pinBuf='';
const S_lock=()=>'<div class="padlock"><div class="logo-ic" style="width:64px;height:64px;border-radius:20px">'+ic('book',30)+'</div><h1 style="margin-top:14px">دَفتَري</h1><div class="muted" style="margin-top:6px">'+t('enterPin')+'</div><div class="pdots" id="pdots">'+[0,1,2,3].map(()=>'<i></i>').join('')+'</div>'
 +((sec.fps&&sec.fps.length)?'<button class="btn btn-line" style="width:auto;margin-top:18px;padding:10px 22px" onclick="fpUnlock()">'+ic('fp',18)+t('fpUse')+'</button>':'')
 +'<div class="kp">'+['1','2','3','4','5','6','7','8','9'].map(d=>'<button onclick="pinTap(\''+d+'\')">'+d+'</button>').join('')+'<button onclick="pinTap(\'x\')">'+ic('back',20)+'</button><button onclick="pinTap(\'0\')">0</button><button onclick="pinTap(\'c\')">'+ic('x',18)+'</button>'+'</div></div>';
function pinTap(d){if(d==='c')pinBuf='';else if(d==='x')pinBuf=pinBuf.slice(0,-1);else if(pinBuf.length<4)pinBuf+=d;
 const dots=document.querySelectorAll('#pdots i');dots.forEach((el,i)=>el.classList.toggle('f',i<pinBuf.length));
 if(pinBuf.length===4)verifyPin(pinBuf);}
async function verifyPin(pin){if(Date.now()<(sec.lockUntil||0)){toastMsg('⏳ '+Math.ceil((sec.lockUntil-Date.now())/1000)+'s');return}
 const h=await sha256hex(sec.salt+pin);
 if(h!==sec.pinHash){sec.failN=(sec.failN||0)+1;if(sec.failN>=5){sec.lockUntil=Date.now()+30000;sec.failN=0;saveSec()}toastMsg(t('wrongPin'));pinBuf='';setTimeout(()=>{const d2=document.querySelectorAll('#pdots i');d2.forEach(el=>el.classList.remove('f'))},300);return}
 const pk=await deriveKey(pin,sec.salt);const mk=await unwrapKey(sec.masterWrapPin,pk);if(!mk){toastMsg(t('wrongPin'));return}
 masterKey=mk;locked=false;pinBuf='';sec.failN=0;saveSec();
 if(window.__afterUnlock){await window.__afterUnlock()}else{stack=[{s:'home'}];render()}}
async function askPin(){const pin=prompt(db.lang==='ar'?'رمز جديد (4 أرقام):':'New PIN (4 digits):');if(!pin||!/^\d{4}$/.test(pin))return;
 sec.salt=uid()+uid();sec.pinHash=await sha256hex(sec.salt+pin);
 masterKey=masterKey||await newMaster();
 const pk=await deriveKey(pin,sec.salt);sec.masterWrapPin=await wrapKey(masterKey,pk);sec.enabled=true;saveSec();save();toastMsg('🔒 ✓');render()}
async function disableLock(){sec.enabled=false;masterKey=null;saveSec();save();render()}
function fpDel(i){if(!sec.fps)return;sec.fps.splice(i,1);if(!sec.fps.length){sec.credId=null;sec.fpWrap=null}saveSec();render()}
async function addFp(){try{if(!window.PublicKeyCredential||!navigator.credentials)throw 0;
 const chal=crypto.getRandomValues(new Uint8Array(16));const first=crypto.getRandomValues(new Uint8Array(32));
 const cred=await navigator.credentials.create({publicKey:{challenge:chal,rp:{name:'Daftar'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'owner',displayName:'Daftar'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},extensions:{prf:{eval:{first}}}}});
 const prf=cred.getClientExtensionResults&&cred.getClientExtensionResults().prf;if(!prf||!prf.results)throw 0;
 const fk=await crypto.subtle.importKey('raw',new Uint8Array(prf.results.first).slice(0,32),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const hex=[...new Uint8Array(cred.rawId)].map(b=>b.toString(16).padStart(2,'0')).join('');sec.fps=sec.fps||[];if(sec.fps.length>=5){toastMsg('🖐 5');return}sec.fps.push({id:hex,wrap:await wrapKey(masterKey,fk)});sec.credId=hex;sec.fpWrap=sec.fps[0].wrap;saveSec();toastMsg('✓');render()}catch(e){toastMsg(t('fpNo'))}}
async function fpUnlock(){try{const cred=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(16)),allowCredentials:(sec.fps||[]).map(f=>({type:'public-key',id:new Uint8Array((f.id.match(/../g)||[]).map(h=>parseInt(h,16)))})),extensions:{prf:{}}}});
 const prf=cred.getClientExtensionResults().prf;const fk=await crypto.subtle.importKey('raw',new Uint8Array(prf.results.first).slice(0,32),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const used=[...new Uint8Array(cred.rawId)].map(b=>b.toString(16).padStart(2,'0')).join('');const ent=(sec.fps||[]).find(f=>f.id===used)||(sec.fps||[])[0];
 const mk=await unwrapKey(ent.wrap,fk);if(!mk)throw 0;masterKey=mk;locked=false;
 if(window.__afterUnlock){await window.__afterUnlock()}else{stack=[{s:'home'}];render()}}catch(e){toastMsg(t('fpNo'))}}
