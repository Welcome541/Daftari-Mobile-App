/* =====================================================================
 * Daftari · 05-ledger.js
 * ---------------------------------------------------------------------
 * Pure ledger engine + data invariants
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const Ledger={bal(d,cid){let s=0;(d.invoices||[]).forEach(i=>{if(i.cust===cid&&!i.arch)s+=i.amount||0});(d.payments||[]).forEach(pp=>{if(pp.cust===cid&&!pp.arch)s-=pp.amount||0});return s},
 paid(d,cid){let s=0;(d.payments||[]).forEach(pp=>{if(pp.cust===cid&&!pp.arch)s+=pp.amount||0});return s},
 todayDebt(d,a,b){let s=0;(d.invoices||[]).forEach(i=>{if(!i.arch&&!i.k&&i.ts>=a&&i.ts<b)s+=i.amount});return s},
 todayPay(d,a,b){let s=0;(d.payments||[]).forEach(pp=>{if(!pp.arch&&pp.ts>=a&&pp.ts<b)s+=pp.amount});return s}};
const Invariants={check(x){if(!x||!x.accounts||!x.data)return 'no-accounts';const ids=new Set();for(const aid in x.data){const d=x.data[aid];const acc=(x.accounts||[]).find(a=>a.id===aid);for(const arr of [d.customers,d.invoices,d.payments])for(const e of arr||[]){if(ids.has(e.id))return 'dup-id:'+e.id;ids.add(e.id)}for(const i of d.invoices||[]){if(!Number.isInteger(i.amount)||i.amount<=0)return 'bad-amount:'+i.id;if(acc&&acc.type!=='personal'&&!((d.customers||[]).some(c=>c.id===i.cust)))return 'orphan-inv:'+i.id}for(const pp of d.payments||[]){if(!Number.isInteger(pp.amount)||pp.amount<=0)return 'bad-pay:'+pp.id;for(const a of pp.alloc||[])if(!Number.isInteger(a.amt)||a.amt<=0)return 'bad-alloc:'+pp.id}}return ''}};
