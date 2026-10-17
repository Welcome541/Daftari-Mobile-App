/* Vosk browser adapter: create KaldiRecognizer and consume worker events. */
(function(){
  var model=null,ready=false,loading=false,active=null;
  function factory(){return window.createModel||(window.Vosk&&window.Vosk.createModel)||(window.vosk&&window.vosk.createModel)}
  function init(force){
    if(force){if(active)stopCapture();try{if(model&&model.terminate)model.terminate()}catch(e){}model=null;ready=false;loading=false}
    if(ready||loading)return;var mk=factory();if(!mk)return;loading=true;
    fetch('model-ar/model.tar.gz',{method:'HEAD'}).then(function(r){if(!r.ok)throw Error('Vosk model archive missing');return mk('model-ar/model.tar.gz')}).then(function(m){model=m;ready=true;loading=false}).catch(function(e){loading=false;console.error('Vosk initialization failed',e)});
  }
  function stopCapture(){var a=active;if(!a)return;active=null;try{if(a.proc)a.proc.disconnect();if(a.src)a.src.disconnect();if(a.stream)a.stream.getTracks().forEach(function(t){t.stop()});if(a.ctx)a.ctx.close()}catch(e){}}
  function deliver(text){text=String(text||'').trim();if(!text||!active)return;var a=active;stopCapture();var fn=window.voskOnText||window.onVoskText;if(fn)fn(a.kind,text,null)}
  window.voskReinit=init;window.voskEngine={
    get ready(){return ready&&!!model},get recording(){return !!active},
    start:function(kind,custId){
      if(!ready||!model||active)return;
      var K=model.KaldiRecognizer;if(!K){console.error('Vosk model exposes no KaldiRecognizer');return}
      var rec;try{rec=new K(16000)}catch(e){console.error('Vosk recognizer creation failed',e);return}
      active={kind:kind,custId:custId,rec:rec,stream:null,ctx:null,src:null,proc:null};
      rec.on('result',function(ev){var r=ev&&ev.result||{};if(r.text)deliver(r.text)});
      rec.on('partialresult',function(ev){var r=ev&&ev.result||{},el=document.getElementById('liveTx');if(el&&r.partial)el.textContent=(typeof t==='function'?t('heard'):'')+' «'+r.partial+'»'});
      var AC=window.AudioContext||window.webkitAudioContext;
      navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}}).then(function(st){
        if(!active||active.rec!==rec){st.getTracks().forEach(function(t){t.stop()});return}
        var ctx=new AC(),src=ctx.createMediaStreamSource(st),proc=ctx.createScriptProcessor(4096,1,1);active.stream=st;active.ctx=ctx;active.src=src;active.proc=proc;
        proc.onaudioprocess=function(e){if(!active||active.rec!==rec)return;try{rec.acceptWaveform(e.inputBuffer)}catch(err){console.error('Vosk audio chunk failed',err)}};
        src.connect(proc);proc.connect(ctx.destination);
      }).catch(function(e){console.error('Vosk microphone failed',e);stopCapture();if(typeof toastMsg==='function')toastMsg(typeof t==='function'?t('voskNo'):'Microphone unavailable')});
    },
    stop:function(){if(active){try{active.rec.retrieveFinalResult()}catch(e){}setTimeout(stopCapture,1200)}}
  };init();
})();
