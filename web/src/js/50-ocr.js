/* =====================================================================
 * Daftari · 50-ocr.js
 * ---------------------------------------------------------------------
 * OCR import (Tesseract)
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function ocrPick(){
 if(typeof Tesseract==='undefined'){toastMsg(t('xlLoading'));busy(1);libLoad('lib/tesseract.min.js').then(()=>{busy(0);ocrPick()}).catch(()=>{busy(0);toastMsg(t('ocrNo'))});return}
 const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
 inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;toastMsg(t('ocrRun'));
  Tesseract.recognize(f,'ara+eng',{}).then(r=>{
    const txt=String(r&&r.data&&r.data.text||'');
    const rows=txt.split(/\n+/).map(l=>l.split(/[,،;\t]+/));
    importRows(rows);
  }).catch(()=>toastMsg(t('ocrNo')))};
 inp.click();
}
