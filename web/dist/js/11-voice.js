/* =====================================================================
 * Daftari · 11-voice.js
 * ---------------------------------------------------------------------
 * Pluggable speech-recognition engine
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const VoiceEngine={listen(onText){
 if(window.voskEngine&&window.voskEngine.ready){window.voskOnText=(k,txt)=>{try{delete window.voskOnText}catch(e){}onText(txt)};window.voskEngine.start('debt');return}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){toastMsg(t('webNo'));ui.voice.st='idle';render();return}
 const r=new SR();try{r.lang='ar-SA'}catch(e){}r.interimResults=false;r.maxAlternatives=1;
 r.onresult=e=>{try{onText(e.results[0][0].transcript)}catch(err){}};
 r.onerror=()=>{toastMsg(t('warn_nospeech'));ui.voice.st='idle';render()};
 try{r.start()}catch(e){toastMsg(t('webNo'));ui.voice.st='idle';render()}
}};
