const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const web = 'app/src/main/assets/www/';
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function env() {
  const dom = new JSDOM('', { url:'https://appassets.androidplatform.net/assets/www/index.html', runScripts:'outside-only' });
  const w = dom.window, timers = new Map(); let id=0;
  w.setTimeout = (callback, ms) => { timers.set(++id, { callback, ms }); return id; };
  w.clearTimeout = id => timers.delete(id);
  return { dom, w, timers, load(file) { w.eval(fs.readFileSync(web+file,'utf8')); },
    fire(ms) { for (const [id,timer] of Array.from(timers)) if (timer.ms===ms) { timers.delete(id); timer.callback(); } } };
}
function audio(e) {
  const streams=[], contexts=[], processors=[];
  let media = () => Promise.resolve(stream());
  function stream() { const track={ stops:0, stop(){this.stops++;} }; const st={track,getTracks:()=>[track]}; streams.push(st); return st; }
  const node = () => ({ connect(){}, disconnect(){this.disconnected=true;} });
  e.w.AudioContext = class {
    constructor(){this.sampleRate=48000;this.destination={};this.closed=0;contexts.push(this);}
    resume(){return Promise.resolve();}
    close(){this.closed++;return Promise.resolve();}
    createMediaStreamSource(){return node();}
    createGain(){return {...node(),gain:{value:1}};}
    createScriptProcessor(){const n=node();processors.push(n);return n;}
  };
  Object.defineProperty(e.w.navigator,'mediaDevices',{value:{getUserMedia:()=>media()},configurable:true});
  return { streams, contexts, processors, stream, setMedia(fn){media=fn;},
    sample(){processors.at(-1).onaudioprocess({inputBuffer:{sampleRate:48000,numberOfChannels:1,getChannelData:()=>new Float32Array(4096)}});} };
}

test('controller cancels initialization immediately and discards its late completion', async () => {
  const e=env(); e.load('js/speech/controller.js');
  const pending=deferred(); let starts=0,releases=0;
  const controller=new e.w.DaftariSpeech.Controller({create:()=>({initialize:()=>pending.promise,start(){starts++;},release(){releases++;}})});
  try {
    const result=controller.start('vosk'); const cancelled=assert.rejects(result,{name:'AbortError'});
    await tick(); controller.cancel(); await cancelled;
    pending.resolve(); await tick();
    assert.equal(starts,0); assert.equal(releases,1); assert.equal(controller.state.status,'idle');
    assert.equal(e.timers.size,0);
  } finally { e.dom.window.close(); }
});

test('controller enforces one session, states, automatic stop, and stale-result isolation', async () => {
  const e=env();e.load('js/speech/controller.js'); const jobs=[],states=[];
  const engine={initialize:()=>Promise.resolve(),release(){},start(options){const d=deferred();const j={...d,stops:0};jobs.push(j);options.onStarted();return {result:d.promise,stop(){j.stops++;},cancel(){d.reject(e.w.DaftariSpeech.aborted());}};}};
  const c=new e.w.DaftariSpeech.Controller({create:()=>engine},s=>states.push(s.status));
  try {
    const first=c.start('vosk'); const cancelled=assert.rejects(first,{name:'AbortError'});
    await tick();assert.equal(c.state.status,'listening');
    await assert.rejects(c.start('whisper'),e=>e.code==='BUSY');
    c.cancel();await cancelled;
    const second=c.start('vosk');await tick();
    jobs[0].resolve('stale');await tick();assert.equal(c.state.status,'listening');
    e.fire(30000);assert.equal(c.state.status,'stopping');assert.equal(jobs[1].stops,1);
    c.stop();assert.equal(jobs[1].stops,1);
    jobs[1].resolve('نص جديد');assert.equal(await second,'نص جديد');assert.equal(c.state.status,'ready');
    assert.deepEqual(states.slice(0,3),['initializing','starting','listening']);assert.equal(e.timers.size,0);
  } finally { c.release();e.dom.window.close(); }
});

test('controller normalizes empty engine rejection and times out hung initialization', async () => {
  const e=env();e.load('js/speech/controller.js');let release=0;
  let initialize=()=>Promise.reject();
  const c=new e.w.DaftariSpeech.Controller({create:()=>({initialize:()=>initialize(),release(){release++;}})});
  try {
    await assert.rejects(c.start('vosk'),error=>error.code==='SPEECH_FAILED');assert.equal(c.state.status,'error');
    initialize=()=>new Promise(()=>{});
    const pending=c.start('vosk');const timedout=assert.rejects(pending,error=>error.code==='INITIALIZE_TIMEOUT');
    await tick();e.fire(90000);await timedout;assert.equal(release,1);assert.equal(c.job,null);
  } finally { c.release();e.dom.window.close(); }
});

function vosk(e) {
  const recognizers=[],models=[];
  function model(){ const m={terminations:0,terminate(){this.terminations++;},KaldiRecognizer:class {
    constructor(rate){this.rate=rate;this.events={};this.removes=0;this.finals=0;recognizers.push(this);}
    on(name,fn){this.events[name]=fn;} acceptWaveform(){} remove(){this.removes++;} retrieveFinalResult(){this.finals++;}
  }};models.push(m);return m;}
  let make=()=>Promise.resolve(model());
  e.w.createModel=()=>make();e.w.fetch=()=>Promise.resolve({ok:true});
  e.load('lib/vosk-adapter.js');
  return {models,recognizers,model,setFactory(fn){make=fn;}};
}

test('Vosk release terminates a model that finishes loading after cancellation', async () => {
  const e=env();const v=vosk(e),d=deferred();v.setFactory(()=>d.promise);
  try {
    const preparation=e.w.voskEngine.prepare();const cancelled=assert.rejects(preparation,{name:'AbortError'});
    await tick();e.w.voskEngine.release();const old=v.model();d.resolve(old);await cancelled;
    assert.equal(old.terminations,1);assert.equal(e.w.voskEngine.ready,false);
    v.setFactory(()=>Promise.resolve(v.model()));await e.w.voskEngine.prepare();assert.equal(e.w.voskEngine.ready,true);
  } finally {e.w.voskEngine.release();e.dom.window.close();}
});

test('Vosk cancellation closes late microphone streams without creating recognizers', async () => {
  const e=env(),a=audio(e),v=vosk(e),d=deferred();a.setMedia(()=>d.promise);
  try {
    await e.w.voskEngine.prepare();const session=e.w.voskEngine.start({});
    const cancelled=assert.rejects(session.result,{name:'AbortError'});
    await tick();session.cancel();await cancelled;const stream=a.stream();d.resolve(stream);await tick();
    assert.equal(stream.track.stops,1);assert.equal(v.recognizers.length,0);
  } finally {e.w.voskEngine.release();e.dom.window.close();}
});

test('Vosk final result and stop timeout each release every recording resource', async () => {
  const e=env(),a=audio(e),v=vosk(e);let started=0,partial='';
  try {
    await e.w.voskEngine.prepare();const session=e.w.voskEngine.start({onStarted(){started++;},onPartial(t){partial=t;}});await tick();
    assert.equal(started,1);assert.equal(v.recognizers[0].rate,48000);
    v.recognizers[0].events.partialresult({result:{partial:'دين'}});assert.equal(partial,'دين');
    session.stop();assert.equal(a.streams[0].track.stops,1);
    v.recognizers[0].events.result({result:{text:'عشرون ريال'}});assert.equal(await session.result,'عشرون ريال');
    assert.equal(v.recognizers[0].removes,1);assert.equal(a.contexts[0].closed,1);
    const next=e.w.voskEngine.start({});await tick();
    const timeout=assert.rejects(next.result,/مهلة/);next.stop();e.fire(3000);await timeout;
    assert.equal(v.recognizers[1].removes,1);assert.equal(a.streams[1].track.stops,1);
    // A queued result from the first recognizer cannot touch the next session.
    v.recognizers[0].events.result({result:{text:'late'}});assert.equal(e.w.voskEngine.recording,false);
  } finally {e.w.voskEngine.release();e.dom.window.close();}
});

async function whisper(e) {
  e.w.indexedDB=new IDBFactory();e.w.crossOriginIsolated=true;e.w.SharedArrayBuffer=SharedArrayBuffer;
  const runtime={frees:0,initializations:0,pcm:null};
  const append=e.w.document.head.appendChild.bind(e.w.document.head);
  e.w.document.head.appendChild=function(script){
    const result=append(script);
    if (script.src.endsWith('/main.js')) {
      Object.assign(e.w.Module,{init(){runtime.initializations++;return 1;},free(){runtime.frees++;},FS_createDataFile(){},FS_unlink(){},full_default(id,pcm){runtime.pcm=pcm;return 0;}});
      queueMicrotask(()=>e.w.Module.onRuntimeInitialized());
    }
    return result;
  };
  e.load('lib/whisper/engine.js');
  const file=new File([new Uint8Array([0x6c,0x6d,0x67,0x67]),new Uint8Array(8*1024*1024-4)],'ggml-tiny.bin');
  await e.w.whisperEngine.importModel(file);await e.w.whisperEngine.prepare();
  return runtime;
}

test('Whisper waits for final timing marker, resamples audio, and does not keep microphone open during inference', async () => {
  const e=env(),a=audio(e);const r=await whisper(e);
  try {
    const result=e.w.whisperEngine.start(null,null,'ar');await tick();a.sample();await e.w.whisperEngine.stop();
    assert.equal(a.streams[0].track.stops,1);assert.equal(a.contexts[0].closed,1);
    assert.equal(r.pcm.length,Math.floor(4096*16000/48000));
    let settled=false;result.then(()=>settled=true);
    e.w.Module.print('[00:00:00.000 --> 00:00:01.000] النص الصحيح');
    e.w.Module.printErr('whisper_print_timings: load time = 1 ms');await tick();assert.equal(settled,false);
    e.w.Module.printErr('whisper_print_timings: total time = 20 ms');assert.equal(await result,'النص الصحيح');
    assert.equal(e.w.whisperEngine.busy,false);assert.equal(e.timers.size,0);
  } finally {e.w.whisperEngine.release();e.dom.window.close();}
});

test('Whisper cancellation settles result but quarantines in-flight inference until completion', async () => {
  const e=env(),a=audio(e);const r=await whisper(e);
  try {
    const result=e.w.whisperEngine.start(null,null,'ar');const cancelled=assert.rejects(result,{name:'AbortError'});
    await tick();a.sample();await e.w.whisperEngine.stop();e.w.whisperEngine.release();await cancelled;
    assert.equal(r.frees,0,'Do not free an instance still used by native worker');
    await assert.rejects(e.w.whisperEngine.prepare(),/مشغول/);
    e.w.Module.print('[00:00:00.000 --> 00:00:01.000] stale text');
    e.w.Module.printErr('whisper_print_timings: total time = 40 ms');assert.equal(r.frees,1);
    await e.w.whisperEngine.prepare();
    const next=e.w.whisperEngine.start(null,null,'ar');await tick();a.sample();await e.w.whisperEngine.stop();
    e.w.Module.print('[00:00:00.000 --> 00:00:01.000] جديد');e.w.Module.printErr('whisper_print_timings: total time = 20 ms');
    assert.equal(await next,'جديد');assert.equal(e.w.whisperEngine.busy,false);
  } finally {e.w.whisperEngine.release();e.dom.window.close();}
});

test('Whisper late permission completion after cancel closes stream and never starts audio processing', async () => {
  const e=env(),a=audio(e);await whisper(e);const d=deferred();a.setMedia(()=>d.promise);
  try {
    const result=e.w.whisperEngine.start(null,null,'ar');const cancelled=assert.rejects(result,{name:'AbortError'});
    e.w.whisperEngine.cancel();await cancelled;
    const stream=a.stream();d.resolve(stream);await tick();
    assert.equal(stream.track.stops,1);assert.equal(a.processors.length,0);
  } finally {e.w.whisperEngine.release();e.dom.window.close();}
});

test('Whisper inference timeout requires reload instead of accepting late text as a new session', async () => {
  const e=env(),a=audio(e);await whisper(e);
  try {
    const result=e.w.whisperEngine.start(null,null,'ar');const timeout=assert.rejects(result,/مهلة/);
    await tick();a.sample();await e.w.whisperEngine.stop();e.fire(600000);await timeout;
    await assert.rejects(e.w.whisperEngine.prepare(),/أعد فتح/);
    e.w.Module.printErr('whisper_print_timings: total time = 600000 ms');
    await assert.rejects(e.w.whisperEngine.prepare(),/أعد فتح/);
  } finally {e.w.whisperEngine.release();e.dom.window.close();}
});

test('Vosk native Model constructor is terminated immediately while loading', async () => {
  const e=env();let model;
  e.w.Vosk={createModel(){throw new Error('Do not hide the pending worker in a Promise');},Model:class {
    constructor(){model=this;this.events={};this.terminated=0;this.worker={terminated:0,terminate(){this.terminated++;}};}on(name,fn){this.events[name]=fn;}terminate(){this.terminated++;}
  }};
  e.w.fetch=()=>Promise.resolve({ok:true});e.load('lib/vosk-adapter.js');
  try {
    const pending=e.w.voskEngine.prepare();const cancelled=assert.rejects(pending,{name:'AbortError'});
    await tick();e.w.voskEngine.release();await cancelled;assert.equal(model.terminated,1);assert.equal(model.worker.terminated,1);
    model.events.load({result:true});assert.equal(e.w.voskEngine.ready,false);
  } finally {e.w.voskEngine.release();e.w.close();}
});

test('browser adapter aborts on cancellation and does not request a second microphone', async () => {
  const e=env();e.load('js/speech/controller.js');let rec;
  e.w.SpeechRecognition=class {constructor(){rec=this;this.aborted=0;}start(){this.onstart();}abort(){this.aborted++;}stop(){this.onend();}};
  e.load('js/speech/engine-factory.js');const engine=e.w.SpeechEngineFactory.create('web');
  try {
    await engine.initialize();const session=engine.start({onStarted(){}});const cancelled=assert.rejects(session.result,{name:'AbortError'});
    session.cancel();await cancelled;assert.equal(rec.aborted,1);assert.equal(rec.onresult,null);
    assert.throws(()=>e.w.SpeechEngineFactory.create('invented'),error=>error.code==='UNKNOWN_ENGINE');
  } finally {engine.release();e.w.close();}
});

test('Whisper rejects model replacement while recording and preserves the current model on invalid import', async () => {
  const e=env(),a=audio(e);await whisper(e);
  try {
    const result=e.w.whisperEngine.start(null,null,'ar');const cancelled=assert.rejects(result,{name:'AbortError'});await tick();
    await assert.rejects(e.w.whisperEngine.removeModel(),/أوقف التسجيل/);
    e.w.whisperEngine.cancel();await cancelled;
    await assert.rejects(e.w.whisperEngine.importModel(new File(['bad'],'ggml-tiny.bin')),/حجم/);
    assert.equal(e.w.whisperEngine.ready,true);assert.equal(e.w.whisperEngine.modelName,'ggml-tiny.bin');
    assert.equal(a.streams[0].track.stops,1);
  } finally {e.w.whisperEngine.release();e.w.close();}
});

test('both local engines reject microphone denial without a dangling session', async () => {
  const e=env(),a=audio(e);vosk(e);
  a.setMedia(()=>Promise.reject(Object.assign(new Error('Permission denied'),{name:'NotAllowedError'})));
  try {
    await e.w.voskEngine.prepare();const v=e.w.voskEngine.start({});await assert.rejects(v.result,{name:'NotAllowedError'});
    assert.equal(e.w.voskEngine.recording,false);
    await whisper(e);await assert.rejects(e.w.whisperEngine.start(null,null,'ar'),{name:'NotAllowedError'});
    assert.equal(e.w.whisperEngine.busy,false);assert.equal(a.contexts.length,0);
  } finally {e.w.voskEngine.release();if(e.w.whisperEngine)e.w.whisperEngine.release();e.w.close();}
});

test('controller stopping while microphone permission is pending still settles cancellation once', async () => {
  const e=env();e.load('js/speech/controller.js');const d=deferred();let cancels=0;
  const c=new e.w.DaftariSpeech.Controller({create:()=>({initialize:()=>Promise.resolve(),release(){},start(){return {result:d.promise,stop(){d.reject(new Error('No audio'));},cancel(){cancels++;}};}})});
  try {
    const result=c.start('vosk');const failed=assert.rejects(result,/No audio/);await tick();assert.equal(c.state.status,'starting');
    c.stop();await failed;assert.equal(c.job,null);assert.equal(cancels,1);assert.equal(e.timers.size,0);
  } finally {c.release();e.w.close();}
});
