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
 const hdr=selMode?'<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1 style="font-size:17px"><span class="num">'+ui.sel.ids.length+'</span> '+t('selN')+'</h1></div><div style="width:42px"></div></div>'
 :'<div class="hdr"><div class="logo-ic" style="font-size:18px;font-weight:900">'+esc(accInit())+'</div><div class="sp"><h1 style="font-size:21px">'+esc(curAcc().name)+'</h1></div>'+accChip()+'</div>';
 return hdr
 +'<div style="height:6px"></div>'+statsCards()
 +'<div class="pad search" style="margin-top:12px"><div class="inp card">'+ic('search',17)+'<input placeholder="'+t('searchTx')+'" value="'+esc(ui.tq)+'" oninput="ui.tq=this.value;debTx()"></div>'+
 '<button class="hbtn" style="height:46px;position:relative" onclick="openHomeFilter()" aria-label="'+t('filter')+'">'+ic('sliders',18)+hfBadge()+'</button>'+
 '</div>'
 +'<div class="pad" style="margin:12px 20px 4px;font-weight:800;font-size:16.5px;display:flex;align-items:center;gap:8px">'+t('lastOps')+' <span class="chip" style="background:#efece6;color:var(--soft)"><span class="num" id="txn">'+n+'</span></span></div>'
 +'<div class="pad list" id="txlist" style="padding-bottom:14px">'+feedHtml()+'</div>';
};
function selBarHtml(){return '<button class="btn btn-line selin" style="flex:1.1;font-size:14.5px;white-space:nowrap" onclick="selExit()">'+ic('x',16)+t('cancel')+'</button><button class="btn btn-soft selin" style="flex:1.3;font-size:14.5px;white-space:nowrap" onclick="selAllVisible()">'+ic('checkc',16)+t('selAllS')+'</button><button class="btn btn-soft selin" style="flex:.9" onclick="selShare()" aria-label="'+t('share')+'">'+ic('share',18)+'</button><button class="btn btn-soft selin" style="flex:.9" onclick="selXlsx()" aria-label="'+t('repXlsx')+'">'+ic('excel',18)+'</button><button class="btn btn-red selin" style="flex:.9" onclick="selDelete()" aria-label="'+t('del')+'">'+ic('trash',18)+'</button>'}
