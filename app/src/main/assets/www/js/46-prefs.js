/* =====================================================================
 * Daftari · 46-prefs.js
 * ---------------------------------------------------------------------
 * Language, currency, theme
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const COUNTRIES=[['السعودية','ر.س'],['العراق','د.ع'],['مصر','ج.م'],['اليمن','ر.ي'],['الإمارات','د.إ'],['سوريا','ل.س']];
const cName=c=>(COUNTRIES.find(x=>x[1]===c)||[])[0]||null;
function setCur(v){const a=curAcc();if(v){a.cur=v;save();render()}}
function setLang(l){db.lang=l;save();applyLang();render()}
function darkOn(){if(sec&&sec.darkAuto){try{if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)return true}catch(e){}const h=new Date().getHours();return h>=18||h<6}return !!(sec&&sec.dark)}
function applyLang(){document.documentElement.lang=db.lang;document.documentElement.dir=db.lang==='ar'?'rtl':'ltr';document.body.lang=db.lang;document.title=db.lang==='ar'?'دَفتَري':'Daftari';document.body.classList.toggle('dark',darkOn());document.body.classList.toggle('priv',!!(sec&&sec.priv))}
window.addEventListener('online',()=>render());
window.addEventListener('offline',()=>render());
try{if(window.matchMedia){const mq=matchMedia('(prefers-color-scheme: dark)');(mq.addEventListener?mq.addEventListener('change',()=>render()):mq.addListener(()=>render()))}}catch(e){}
