/* ================= ledger engine (pure, signed balances) ================= */
const Ledger={bal(d,cid){let s=0;(d.invoices||[]).forEach(i=>{if(i.cust===cid&&!i.arch)s+=i.amount||0});(d.payments||[]).forEach(pp=>{if(pp.cust===cid&&!pp.arch)s-=pp.amount||0});return s},
 paid(d,cid){let s=0;(d.payments||[]).forEach(pp=>{if(pp.cust===cid&&!pp.arch)s+=pp.amount||0});return s},
 todayDebt(d,a,b){let s=0;(d.invoices||[]).forEach(i=>{if(!i.arch&&!i.k&&i.ts>=a&&i.ts<b)s+=i.amount});return s},
 todayPay(d,a,b){let s=0;(d.payments||[]).forEach(pp=>{if(!pp.arch&&pp.ts>=a&&pp.ts<b)s+=pp.amount});return s}};
const Invariants={check(x){try{LedgerSchema.validate(x);return ''}catch(e){return e.message}}};
