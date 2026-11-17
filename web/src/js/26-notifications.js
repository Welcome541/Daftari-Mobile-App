/* =====================================================================
 * Daftari · 26-notifications.js
 * ---------------------------------------------------------------------
 * The attention bell.
 *
 * A round navy button with a white bell and a red count badge, pinned
 * to the top-left corner of the main screens - the leading edge is
 * where the eye starts in an RTL layout, so the bell sits opposite
 * the title rather than sharing its row.
 *
 * It counts the customers that need chasing (the ones who still owe
 * money) and opens a sheet listing them, the overdue ones first.
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */

/* Customers with an unpaid balance - the collection list. */
const notifDue=()=>DD().customers.filter(c=>!c.archived&&custOpen(c.id)>0);
const notifCount=()=>notifDue().length;

const notifBtn=()=>{
 const n=notifCount();
 return '<button class="notif" onclick="openNotifSheet()" aria-label="'+esc(t('notifT'))+'">'+ic('bellf',21)
 +(n?'<span class="notif-badge"><span class="num">'+n+'</span></span>':'')+'</button>';
};

function openNotifSheet(){
 const list=notifDue().sort((a,b)=>
  (custOverdue(b.id)?1:0)-(custOverdue(a.id)?1:0)   /* overdue first */
  ||custOpen(b.id)-custOpen(a.id));                 /* then the largest debt */
 openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">'+esc(t('notifT'))+'</h3><span class="sp"></span>'
 +'<button class="hbtn" onclick="closeSheet()" aria-label="'+esc(t('close'))+'">'+ic('x',17)+'</button></div>'
 +'<div class="muted" style="font-size:12.5px;margin-bottom:14px;line-height:1.8">'+esc(t('notifD'))+'</div>'
 +(list.length
   ?list.map(c=>'<button class="srow" onclick="closeSheet();go(\'profile\',{id:\''+c.id+'\'})">'
     +avat(c.name,44)
     +'<span class="sp" style="text-align:start"><span class="t">'+esc(c.name)+'</span>'
     +'<span class="d">'+(custOverdue(c.id)?'<span class="chip b-open" style="padding:2px 8px;font-size:10.5px"><span class="dot"></span>'+esc(t('lateF'))+'</span> ':'')
     +esc(t('totalDue'))+': <span class="num">'+fmt(custOpen(c.id))+'</span> '+esc(CUR())+'</span></span>'
     +'<span class="amt red"><span class="num">'+fmt(custOpen(c.id))+'</span></span></button>').join('')
   :'<div class="muted" style="text-align:center;padding:26px 0">'+esc(t('notifEmpty'))+'</div>'));
}
