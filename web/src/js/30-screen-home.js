/* =====================================================================
 * Daftari · 30-screen-home.js
 * ---------------------------------------------------------------------
 * SCREEN: home
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_home=()=>{
 filteredTx();const n=window.__txFull;
 const selMode=ui.sel&&ui.sel.on;
 /* The header never changes with the selection: the count of the
    selected items lives in the action bar under the last operation. */
 const hdr='<div class="hdr"><div class="accid" role="button" tabindex="0" onclick="openAccSheet()" onkeydown="if(event.key===\'Enter\')openAccSheet()"><div class="logo-ic">'+ic(curAcc().type==='grocery'?'store':'user',22)+'</div><h1 style="font-size:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(curAcc().name)+'</h1><span class="accchev">'+ic('chevD',15)+'</span></div>'+notifBtn()+'</div>';
 return hdr
 +'<div style="height:6px"></div>'+statsCards()
 +'<div class="pad search" style="margin-top:12px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('searchTx')+'" value="'+esc(ui.tq)+'" oninput="ui.tq=this.value;debTx()"></div>'+
 '<button class="hbtn" style="height:46px;position:relative" onclick="openHomeFilter()" aria-label="'+t('filter')+'">'+ic('sliders',18)+hfBadge()+'</button>'+
 '</div>'
 /* The red-marked area: normally the title with the count;
    while selecting it becomes the action bar so the icons appear
    exactly where the title was. */
 +(selMode
   ?'<div class="pad" style="margin:12px 20px 4px">'+selHeadHtml()+'</div>'
   :'<div class="pad" style="margin:12px 20px 4px;font-weight:800;font-size:16.5px;display:flex;align-items:center;gap:8px">'+t('lastOps')+' <span class="chip" style="background:#efece6;color:var(--soft)"><span class="num" id="txn">'+n+'</span></span></div>')
 +'<div class="pad list ops" id="txlist" style="padding-bottom:14px">'+feedHtml()+'</div>';
};
/* The selection bar - kept for customers screen (under list).
   Home now uses selHeadHtml in the title slot instead. */
function selBarHtml(){return '<div class="selbar">'
 +'<div class="selbar-top"><span class="selbar-n">'+t('selN')+' <span class="num">'+ui.sel.ids.length+'</span></span><span class="sp"></span>'
 +'<button class="btn btn-line selin" style="flex:none;padding:0 14px;font-size:13.5px" onclick="selExit()">'+ic('x',16)+t('cancel')+'</button></div>'
 +'<div class="selbar-acts">'
 +'<button class="btn btn-soft selin" style="flex:1.2;font-size:13.5px" onclick="selAllVisible()">'+ic('checkc',16)+t('selAllS')+'</button>'
 +'<button class="btn btn-soft selin" style="flex:.9" onclick="selShare()" aria-label="'+t('share')+'">'+ic('share',18)+'</button>'
 +'<button class="btn btn-soft selin" style="flex:.9" onclick="selXlsx()" aria-label="'+t('repXlsx')+'">'+ic('excel',18)+'</button>'
 +'<button class="btn btn-red selin" style="flex:.9" onclick="selDelete()" aria-label="'+t('del')+'">'+ic('trash',18)+'</button>'
 +'</div></div>'}
/* Top bar: replaces "آخر العمليات" when selecting, with count and all
   action icons visible in the red-marked area. */
function selHeadHtml(){
 return '<div class="selhead">'
 +'<span class="selbar-n">'+t('selN')+' <span class="num">'+ui.sel.ids.length+'</span></span>'
 +'<div class="selhead-acts">'
 +'<button class="btn btn-soft selin" onclick="selAllVisible()">'+ic('checkc',14)+' '+t('selAllS')+'</button>'
 +'<button class="btn btn-soft selin" onclick="selShare()" aria-label="'+t('share')+'">'+ic('share',14)+'</button>'
 +'<button class="btn btn-soft selin" onclick="selXlsx()" aria-label="'+t('repXlsx')+'">'+ic('excel',14)+'</button>'
 +'<button class="btn btn-red selin" onclick="selDelete()" aria-label="'+t('del')+'">'+ic('trash',14)+'</button>'
 +'<button class="btn btn-line selin" onclick="selExit()">'+ic('x',12)+' '+t('cancel')+'</button>'
 +'</div>'
 +'</div>'
}
