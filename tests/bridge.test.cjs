const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
function setup(nativeOverride) {
  const dom=new JSDOM('',{url:'https://appassets.androidplatform.net/assets/www/index.html',runScripts:'outside-only'});
  const w=dom.window, frames=[], timers=new Map();let counter=0;
  w.setTimeout=(fn,ms)=>{timers.set(++counter,{fn,ms});return counter;};w.clearTimeout=id=>timers.delete(id);
  w.Daftari=nativeOverride||{dispatch:raw=>frames.push(JSON.parse(raw))};
  w.eval(fs.readFileSync('app/src/main/assets/www/js/bridge.js','utf8'));
  return {w,frames,timers,bridge:w.DaftariBridge,reply(id,data){w.DaftariBridge.onResponse({version:2,id,type:'success',data});},
    fire(ms){for(const [id,timer] of Array.from(timers))if(timer.ms===ms){timers.delete(id);timer.fn();}},close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}
const contact={name:'أحمد',phone:'123'};
const model={kind:'vosk',files:3};

test('RPC correlates out-of-order replies, ignores duplicates, and progress does not settle', async()=>{
  const e=setup();let progress=[];
  try{
    const a=e.bridge.pickModel({onProgress:m=>progress.push(m)}),b=e.bridge.pickContact();
    assert.notEqual(a.requestId,b.requestId);
    assert.equal(e.frames[0].method,'model.import');assert.deepEqual(e.frames[0].params,{});
    e.bridge.onResponse({version:2,id:a.requestId,type:'progress',message:'copying'});
    assert.equal(e.timers.size,2);assert.deepEqual(progress,['copying']);
    e.reply(b.requestId,contact);assert.deepEqual(await b,contact);assert.equal(e.timers.size,1);
    e.reply(a.requestId,model);assert.deepEqual(await a,model);
    e.reply(a.requestId,{kind:'vosk',files:100});e.reply('unknown',{});assert.equal(e.timers.size,0);
  }finally{e.close();}
});

test('RPC timeout and explicit cancel settle locally and send best-effort native cancellation', async()=>{
  const e=setup();
  try{
    const p=e.bridge.pickProject({timeoutMs:20});const timedout=assert.rejects(p,error=>error.code==='TIMEOUT');
    e.fire(20);await timedout;assert.equal(e.frames.at(-1).type,'cancel');assert.equal(e.frames.at(-1).id,p.requestId);
    e.reply(p.requestId,{kind:'project',files:1});
    const next=e.bridge.pickModel();const cancelled=assert.rejects(next,error=>error.code==='CANCELLED');next.cancel();next.cancel();await cancelled;
    assert.equal(e.frames.filter(f=>f.type==='cancel'&&f.id===next.requestId).length,1);assert.equal(e.timers.size,0);
  }finally{e.close();}
});

test('RPC checks wall-clock deadlines even if background timers were suspended',async()=>{
  const e=setup();let time=1000;e.w.Date.now=()=>time;
  try{
    const task=e.bridge.pickContact({timeoutMs:100});const rejected=assert.rejects(task,error=>error.code==='TIMEOUT');
    time=1200;e.reply(task.requestId,contact);await rejected;assert.equal(e.timers.size,0);
  }finally{e.close();}
});

test('RPC abort signals and page teardown clean pending timers without cancelling on ordinary background',async()=>{
  const e=setup();
  try{
    const signal=new e.w.AbortController();const p=e.bridge.pickModel({signal:signal.signal});const cancelled=assert.rejects(p,error=>error.code==='CANCELLED');
    signal.abort();await cancelled;
    const q=e.bridge.pickContact();const closed=assert.rejects(q,error=>error.code==='CLOSED');
    e.w.dispatchEvent(new e.w.Event('daftari-background'));assert.equal(e.timers.size,1,'Picker pauses must not cancel RPC');
    e.w.dispatchEvent(new e.w.Event('pagehide'));await closed;assert.equal(e.timers.size,0);
    await assert.rejects(e.bridge.pickModel(),error=>error.code==='CLOSED');
  }finally{e.close();}
});

test('RPC rejects malformed and cross-method data, unsupported versions, and native errors',async()=>{
  const e=setup();
  try{
    const p=e.bridge.pickContact();const invalid=assert.rejects(p,error=>error.code==='PROTOCOL_ERROR');e.reply(p.requestId,model);await invalid;
    const q=e.bridge.listModels();const version=assert.rejects(q,error=>error.code==='PROTOCOL_ERROR');
    e.bridge.onResponse({id:q.requestId,version:99,type:'success',data:{version:1,models:[]}});await version;
    const r=e.bridge.pickModel();const denied=assert.rejects(r,error=>error.code==='INVALID_SELECTION'&&error.message==='choose one');
    e.bridge.onResponse({id:r.requestId,version:2,type:'error',error:{code:'INVALID_SELECTION',message:'choose one'}});await denied;
    assert.equal(e.timers.size,0);
  }finally{e.close();}
});

test('RPC bounds pending requests, validates methods/params/timeouts, and handles transport failures',async()=>{
  const e=setup();
  try{
    await assert.rejects(e.bridge.request('__proto__'),error=>error.code==='UNKNOWN_METHOD');
    await assert.rejects(e.bridge.request('model.import',{path:'../a'}),error=>error.code==='INVALID_PARAMS');
    await assert.rejects(e.bridge.pickModel({timeoutMs:0}),error=>error.code==='INVALID_TIMEOUT');assert.equal(e.frames.length,0);
    const waiting=[];for(let i=0;i<16;i++)waiting.push(e.bridge.listModels().catch(error=>error.code));
    await assert.rejects(e.bridge.listModels(),error=>error.code==='BUSY');e.close();
    assert.ok((await Promise.all(waiting)).every(code=>code==='CLOSED'));
  }finally{e.close();}
  const broken=setup({dispatch(){throw new Error('offline bridge');}});
  try{await assert.rejects(broken.bridge.listModels(),error=>error.code==='TRANSPORT_ERROR');assert.equal(broken.timers.size,0);}finally{broken.close();}
});

test('legacy contact cancellation quarantines callback until the original result is drained',async()=>{
  const e=setup({pickContact(){}});
  try{
    const first=e.bridge.pickContact();const cancelled=assert.rejects(first,error=>error.code==='CANCELLED');first.cancel();await cancelled;
    await assert.rejects(e.bridge.pickContact(),error=>error.code==='BUSY');
    e.w.contactPicked('old','000');
    const next=e.bridge.pickContact();e.w.contactPicked('new','123');assert.equal((await next).name,'new');assert.equal(e.timers.size,0);
  }finally{e.close();}
});
