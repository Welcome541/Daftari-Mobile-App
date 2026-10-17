/* =====================================================================
 * Daftari · 10-router.js
 * ---------------------------------------------------------------------
 * Navigation stack + UI state
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
let stack=[{s:'home'}];
window.__BUILD=(window.__DF_BUILD&&window.__DF_BUILD.version)||'3.0.0';
window.__BUILD_INFO=window.__DF_BUILD||{version:window.__BUILD,build:0,channel:'dev'};
const ui={f:{status:'all',period:'all',sort:'recent',near:false,over:false},cmax:60,archQ:'',tf:{kind:'all',period:'month'},pOpen:false,repMore:false,tq:'',arch:false,cq:'',pf:'all',sel:{on:false,ids:[]},nc2:null,voice:{st:'idle',demo:0,edit:false,d:{},cands:[]},pay:{cust:null,amt:'',method:'cash',done:null},nc:{name:'',phone:'',edit:null},accEdit:null,voskOpen:false};
function tab(s){stack=[{s}];ui.sel={on:false,ids:[]};ui.csel={on:false,ids:[]};render()}
function go(s,p){stack.push({s,p});render()}
function back(){if(stack.length>1)stack.pop();else stack=[{s:'home'}];render()}
const curScr=()=>stack[stack.length-1];
const ctxCust=()=>{const tp=curScr();return tp.s==='profile'?tp.p.id:((tp.s==='voice'||tp.s==='pay')?(tp.p&&tp.p.cust)||null:null)};
