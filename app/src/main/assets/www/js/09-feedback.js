/* =====================================================================
 * Daftari · 09-feedback.js
 * ---------------------------------------------------------------------
 * Haptics + speech feedback
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
let AC=null;
function speak(txt){if(!sec.speak||!('speechSynthesis' in window))return;try{const u=new SpeechSynthesisUtterance(txt);u.lang=db.lang==='ar'?'ar-SA':'en-US';u.rate=1.05;const vs=speechSynthesis.getVoices?speechSynthesis.getVoices():[];const v=vs.find(x=>x.lang&&x.lang.slice(0,2)===(db.lang==='ar'?'ar':'en'));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function feedback(kind){
 try{if(sec.vib&&navigator.vibrate)navigator.vibrate(kind==='debt'?[70,50,70]:[45])}catch(e){}
 if(!sec.sound)return;
 try{AC=AC||new AudioContext();const o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);o.frequency.value=kind==='debt'?520:760;g.gain.value=.07;o.start();o.stop(AC.currentTime+0.18)}catch(e){}
}
