const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const web = path.resolve('app/src/main/assets/www');

class LocalAssets extends ResourceLoader {
  fetch(url) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://appassets.androidplatform.net', 'No external boot dependency');
    const file = path.resolve(web, parsed.pathname.replace(/^\/assets\/www\//, ''));
    assert.ok(file.startsWith(web + path.sep));
    return Promise.resolve(fs.readFileSync(file));
  }
}

function boot(native = undefined) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(path.join(web, 'index.html'), 'utf8'), {
    url: 'https://appassets.androidplatform.net/assets/www/index.html',
    runScripts: 'dangerously', resources: new LocalAssets(), pretendToBeVisual: true, virtualConsole: console,
    beforeParse(window) {
      window.indexedDB = new IDBFactory();
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.Daftari = native;
      window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollTo = () => {};
    }
  });
  return { dom, errors };
}

async function ready(dom) {
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  for (let i = 0; i < 50; i++) {
    if (dom.window.document.querySelector('#app').children.length) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Application did not render');
}

test('all extracted app scripts parse; HTML contains no inline script or style blocks', () => {
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  function checkScripts(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) checkScripts(file);
      else new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    }
  }
  checkScripts(path.join(web, 'js'));
});

test('offline boot and settings render with extracted scripts', async () => {
  const { dom, errors } = boot();
  try {
    await ready(dom);
    assert.ok(dom.window.document.querySelector('#tabbar').children.length);
    dom.window.go('settings');
    assert.ok(dom.window.document.getElementById('whisperSettingsCard'));
    assert.equal(dom.window.DaftariBridge, undefined);
    assert.deepEqual(errors.map(e => e.message), []);
  } finally { dom.window.close(); }
});

test('native bridge dispatches fixed methods and data events', async () => {
  const calls = [];
  const { dom, errors } = boot({
    pickVosk: () => calls.push('model'), pickProject: () => calls.push('project'),
    pickContact: () => calls.push('contact'), importedList: () => 'model.tar.gz'
  });
  try {
    await ready(dom);
    const bridge = dom.window.DaftariBridge;
    bridge.pickModel(); bridge.pickProject(); bridge.pickContact();
    assert.deepEqual(calls, ['model', 'project', 'contact']);
    assert.equal(bridge.importedList(), 'model.tar.gz');
    let result;
    dom.window.addEventListener('daftari-native-event', e => result = e.detail);
    bridge.receive('error', '<img src=x onerror="alert(1)">');
    assert.equal(result.type, 'error');
    assert.equal(dom.window.document.querySelector('#toast img'), null, 'Native messages must be rendered as text');
    assert.deepEqual(errors.map(e => e.message), []);
  } finally { dom.window.close(); }
});

test('versioned native inventory renders as text and refreshes on import', async () => {
  let models = [];
  const { dom, errors } = boot({ getModelList: () => JSON.stringify({ version: 1, models }) });
  try {
    await ready(dom);
    dom.window.go('settings');
    await new Promise(resolve => setImmediate(resolve));
    let card = dom.window.document.getElementById('nativeModelCatalog');
    assert.ok(card);
    assert.match(card.textContent, /No Vosk model|لم يُستورد/);
    models = [{ id: 'vosk-active', engine: 'vosk', name: '<img src=x onerror=alert(1)>', size: 1048576, state: 'installed' }];
    dom.window.DaftariBridge.receive('modelImported', '');
    await new Promise(resolve => setImmediate(resolve));
    assert.match(card.textContent, /1.0 MB/);
    assert.equal(card.querySelector('img'), null);
    assert.equal(dom.window.DaftariBridge.getModelList()[0].id, 'vosk-active');
    dom.window.go('home'); dom.window.go('settings');
    assert.equal(dom.window.document.querySelectorAll('#nativeModelCatalog').length, 1);
    assert.deepEqual(errors.map(e => e.message), []);
  } finally { dom.window.close(); }
});

test('native inventory rejects unsupported envelopes and handles old native versions', async () => {
  let response = JSON.stringify({ version: 2, models: [] });
  const { dom } = boot({ getModelList: () => response });
  try {
    await ready(dom);
    assert.throws(() => dom.window.DaftariBridge.getModelList(), /INVALID_MODEL_LIST/);
    response = JSON.stringify({ version: 1, models: [], error: 'MODEL_LIST_FAILED' });
    assert.throws(() => dom.window.DaftariBridge.getModelList(), /MODEL_LIST_FAILED/);
    response = 'not json';
    assert.throws(() => dom.window.DaftariBridge.getModelList());
  } finally { dom.window.close(); }
  const old = boot({ importedList: () => '' });
  try {
    await ready(old.dom);
    assert.equal(old.dom.window.DaftariBridge.getModelList().length, 0);
  } finally { old.dom.window.close(); }
});

test('recording UI uses the shared service, requires confirmation, and cancels on background', async () => {
  const { dom, errors } = boot(); const w=dom.window;
  try {
    await ready(dom);
    w.eval("sec.vosk=true;DD().customers.push({id:'test-c',name:'أبو خالد',archived:false});");
    let job, starts=0,cancels=0,releases=0;
    w.voskEngine={prepare:()=>Promise.resolve(),release(){releases++;if(job)job.reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));},start(options){
      starts++;const result=new Promise((resolve,reject)=>{job={resolve,reject};});options.onStarted();
      return {result,stop(){job.resolve('أبو خالد عشرين ريال');},cancel(){cancels++;job.reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));}};}};
    w.startRec('debt','test-c');await new Promise(r=>setImmediate(r));
    assert.equal(starts,1);assert.equal(w.SpeechService.state.status,'listening');
    w.endRec();await new Promise(r=>setImmediate(r));
    assert.equal(w.eval('ui.rec.st'),'edit');assert.equal(w.eval('DD().invoices.length'),0,'Recognition must not save a ledger entry');
    w.retryRec();await new Promise(r=>setImmediate(r));assert.equal(starts,2);
    const previous=job;
    w.dispatchEvent(new w.Event('daftari-background'));await new Promise(r=>setImmediate(r));
    assert.equal(w.SpeechService.busy,false);assert.equal(w.eval('ui.rec'),null);assert.equal(releases,1);
    previous.resolve('late');await new Promise(r=>setImmediate(r));assert.equal(w.eval('DD().invoices.length'),0);
    assert.ok(cancels>=1);assert.deepEqual(errors.map(e=>e.message),[]);
  } finally {if(w.SpeechService)w.SpeechService.release();w.close();}
});

test('pasted speech text never requests microphone and navigating away cancels pending recording', async () => {
  const { dom, errors } = boot();const w=dom.window;
  try {
    await ready(dom);w.eval('sec.vosk=true;');let starts=0;
    w.voskEngine={prepare:()=>new Promise(()=>{}),start(){starts++;},release(){}};
    w.extSay('أبو خالد عشرين ريال');assert.equal(starts,0);assert.equal(w.SpeechService.busy,false);assert.equal(w.eval('ui.rec.st'),'edit');
    w.retryRec();assert.equal(w.SpeechService.busy,true);
    w.go('settings');await new Promise(r=>setImmediate(r));
    assert.equal(w.SpeechService.busy,false);assert.equal(w.eval('ui.rec'),null);assert.equal(starts,0);
    assert.deepEqual(errors.map(e=>e.message),[]);
  } finally {w.SpeechService.release();w.close();}
});

test('Whisper file input change passes the actual input without monkey-patching recording functions', async () => {
  const { dom, errors } = boot();const w=dom.window;
  try {
    await ready(dom);const before=w.startRec;w.go('settings');
    const input=w.document.getElementById('whisperModelFile'),file=new w.File(['model'],'ggml-tiny.bin');let imported;
    w.whisperEngine={importModel:async f=>{imported=f;},loadMeta:async()=>null,hasModel:false};
    Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new w.Event('change'));
    await new Promise(r=>setImmediate(r));assert.equal(imported,file);assert.equal(w.startRec,before);
    w.render();assert.equal(w.document.querySelectorAll('#whisperSettingsCard').length,1);
    assert.deepEqual(errors.map(e=>e.message),[]);
  } finally {w.close();}
});

test('modern inventory uses asynchronous RPC and ignores stale responses after re-render', async () => {
  const frames=[];const {dom,errors}=boot({dispatch:raw=>frames.push(JSON.parse(raw)),getModelList(){throw new Error('Must use RPC');}});const w=dom.window;
  try{
    await ready(dom);w.go('settings');w.render();
    const requests=frames.filter(f=>f.method==='models.list');assert.equal(requests.length,2);
    function response(id,name){w.DaftariBridge.onResponse({version:2,id,type:'success',data:{version:1,models:[{name,size:1048576}]}});}
    response(requests[1].id,'new-model');await new Promise(r=>setImmediate(r));
    response(requests[0].id,'old-model');await new Promise(r=>setImmediate(r));
    const card=w.document.getElementById('nativeModelCatalog');assert.match(card.textContent,/new-model/);assert.doesNotMatch(card.textContent,/old-model/);
    assert.deepEqual(errors.map(e=>e.message),[]);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('late contact RPC cannot overwrite a different customer form', async () => {
  const frames=[];const {dom}=boot({dispatch:raw=>frames.push(JSON.parse(raw))});const w=dom.window;
  try{
    await ready(dom);w.go('newcust');const operation=w.NativeActions.pickContact();
    const request=frames.find(f=>f.method==='contact.pick');assert.ok(request);
    w.eval("ui.nc={name:'new draft',phone:'',edit:null};");w.go('newcust');
    w.DaftariBridge.onResponse({version:2,id:request.id,type:'success',data:{name:'old contact',phone:'123'}});
    await operation;assert.equal(w.eval('ui.nc.name'),'new draft');
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('recording screen delegates nested clicks, escapes customer attributes, and has no inline handlers', async () => {
  const {dom,errors}=boot();const w=dom.window;
  try{
    await ready(dom);w.extSay('أبو خالد عشرين ريال');
    w.eval('ui.rec.cands=[{id:"customer-id",name:"اسم \\\" خاص"}];DD().customers.push(ui.rec.cands[0]);render();');
    const app=w.document.getElementById('app');
    assert.equal(app.querySelector('[onclick],[onchange],[onpointerdown]'),null);
    const candidate=app.querySelector('[data-action="record.customer"]');candidate.click();assert.equal(w.eval('ui.rec.d.custId'),'customer-id');
    const before=w.eval('stack.length');let prepared=0;
    w.eval('sec.vosk=true;');w.voskEngine={prepare(){prepared++;return new Promise(()=>{});},release(){}};
    w.document.querySelector('[data-action="record.retry"] svg').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    await new Promise(r=>setImmediate(r));assert.equal(prepared,1);assert.equal(w.eval('stack.length'),before,'Retry must replace, not push, a recording route');
    w.document.querySelector('[data-action="record.cancel"]').click();assert.equal(w.SpeechService.busy,false);
    assert.deepEqual(errors.map(e=>e.message),[]);
  }finally{w.SpeechService.release();w.close();}
});

test('delegated actions ignore unknown/disabled commands and HTML project execution is disabled',async()=>{
  const {dom}=boot();const w=dom.window;
  try{
    await ready(dom);w.go('settings');const app=w.document.getElementById('app');
    const fake=w.document.createElement('button');fake.setAttribute('data-action','window.hacked=true');app.appendChild(fake);fake.click();assert.equal(w.hacked,undefined);
    const toggle=app.querySelector('[data-action="vosk.expand"]');toggle.setAttribute('aria-disabled','true');toggle.click();assert.equal(w.eval('ui.voskOpen'),false);
    toggle.removeAttribute('aria-disabled');toggle.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(w.eval('ui.voskOpen'),true);
    const documentBefore=w.document.documentElement;w.projPick();assert.equal(w.document.documentElement,documentBefore);assert.equal(w.projPickFile,undefined);
  }finally{w.close();}
});

test('native import progress is text-only and UI cancellation suppresses a late success',async()=>{
  const frames=[];let windowRef;
  const {dom}=boot({dispatch(raw){
    const frame=JSON.parse(raw);frames.push(frame);
    if(frame.method==='models.list')queueMicrotask(()=>windowRef.DaftariBridge.onResponse({version:2,id:frame.id,type:'success',data:{version:1,models:[]}}));
  }});const w=dom.window;windowRef=w;
  try{
    await ready(dom);w.go('settings');w.document.querySelector('[data-action="vosk.expand"]').click();
    w.document.querySelector('[data-action="native.model.import"]').click();
    const task=frames.find(f=>f.method==='model.import');assert.ok(task);
    w.DaftariBridge.onResponse({version:2,id:task.id,type:'progress',message:'<img src=x onerror=alert(1)>'});
    assert.equal(w.document.querySelector('#nativeOperation img'),null);
    assert.match(w.document.querySelector('#nativeOperation').textContent,/<img/);
    w.document.querySelector('#nativeOperation button').click();await new Promise(r=>setImmediate(r));
    assert.ok(frames.some(f=>f.type==='cancel'&&f.id===task.id));assert.equal(w.document.getElementById('nativeOperation'),null);
    let succeeded=0;w.addEventListener('daftari-native-event',e=>{if(e.detail.type==='modelImported')succeeded++;});
    w.DaftariBridge.onResponse({version:2,id:task.id,type:'success',data:{kind:'vosk',files:10}});
    await new Promise(r=>setImmediate(r));assert.equal(succeeded,0);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('recovery screen uses explicit controls and cancellation never replaces ledger', async () => {
  const { dom, errors } = boot();
  try {
    await ready(dom);
    const w=dom.window;
    await w.eval('Store.tail');
    const before=await w.eval('Store.load().then(JSON.stringify)');
    w.confirm=()=>false;
    w.eval('locked=true;Recovery.show()');
    const root=w.document.getElementById('app');
    assert.ok(root.querySelector('input[type="password"]'));
    assert.ok(root.querySelector('[role="status"][aria-live="polite"]'));
    assert.equal(root.querySelectorAll('[onclick]').length,0);
    const buttons=[...root.querySelectorAll('button')];
    assert.equal(buttons.length,3);
    buttons[0].click();buttons[1].click();
    assert.equal(await w.eval('Store.load().then(JSON.stringify)'),before);
    assert.equal(w.eval('locked'),true);
    assert.equal(errors.length,0);
  } finally { dom.window.close(); }
});

test('manual debt submission keeps form and ledger unchanged when storage fails',async()=>{
  const { dom, errors }=boot();
  try {
    await ready(dom);const w=dom.window;await w.eval('Store.tail');
    w.eval(`db=demoFixtures();ui.wz={kind:'debt',custId:'c1',amt:'12.50',note:'test',due:'',step:1};stack=[{s:'wiz'}];render();window.beforeLedger=JSON.stringify(db);Store.open=async()=>{throw new Error('disk-full')}`);
    await w.eval('wizConfirm()');
    assert.equal(w.eval('JSON.stringify(db)'),w.beforeLedger);
    assert.equal(w.eval('ui.wz.amt'),'12.50');
    assert.equal(w.eval('stack[0].s'),'wiz');
    assert.match(w.document.getElementById('toast').textContent,/Save failed|تعذّر الحفظ/);
    assert.equal(errors.length,0);
  } finally { dom.window.close(); }
});

test('customer and bulk-import failures preserve ledger and form data',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 w.eval(`ui.nc={name:'Test customer',phone:'123',photo:null,edit:null};window.beforeLedger=JSON.stringify(db);Store.open=async()=>{throw new Error('quota')}`);
 await w.eval('saveCustomer()');assert.equal(w.eval('JSON.stringify(db)'),w.beforeLedger);assert.equal(w.eval('ui.nc.name'),'Test customer');
 assert.equal(await w.eval("importRows([['Another customer','12.50']])"),0);assert.equal(w.eval('JSON.stringify(db)'),w.beforeLedger);assert.equal(errors.length,0);
 }finally{dom.window.close()}
});

test('bulk import undo rejects intervening edits instead of discarding newer transactions',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 assert.equal(await w.eval("importRows([['Test customer','12.50']])"),1);
 w.eval('window.importUndo=undoAct');
 await w.eval("LedgerEdits.insert('invoices',{id:'later',code:'later',amount:100,ts:1},true)");
 const before=w.eval('JSON.stringify(db)');await w.importUndo();assert.equal(w.eval('JSON.stringify(db)'),before);assert.equal(w.eval('DD().invoices.length'),2);assert.equal(errors.length,0);
 }finally{dom.window.close()}
});

test('administrative failure keeps account, currency, language and selections unchanged',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 w.eval(`db=demoFixtures();db.accounts.push({id:'a2',name:'Second',type:'personal',cur:'$',minorUnit:2});db.data.a2={customers:[],invoices:[],payments:[],seq:1};ui.csel={on:true,ids:['c1']};window.beforeLedger=JSON.stringify(db);Store.open=async()=>{throw new Error('quota')}`);
 await w.eval("switchAcc('a2')");await w.eval("setCur('$')");await w.eval("setLang('ar')");await w.eval('cselDelete()');await w.eval("setCustomerArchived('c1',true)");
 assert.equal(w.eval('JSON.stringify(db)'),w.beforeLedger);assert.equal(w.eval('ui.csel.ids[0]'),'c1');assert.equal(errors.length,0);
 }finally{dom.window.close()}
});
test('late photo cannot alter a replaced customer form or another account',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 w.eval(`db=demoFixtures();ui.nc={photo:null};window.photoToken=photoContext('nc');ui.nc={photo:null}`);
 assert.equal(await w.eval("applyCustomerPhoto(photoToken,'data:image/jpeg;base64,AA')"),false);assert.equal(w.eval('ui.nc.photo'),null);
 w.eval("window.photoToken=photoContext('c1');db.accounts.push({id:'a2',name:'Second',type:'personal',cur:'$',minorUnit:2});db.data.a2={customers:[],invoices:[],payments:[],seq:1};db.active='a2'");
 assert.equal(await w.eval("applyCustomerPhoto(photoToken,'data:image/jpeg;base64,AA')"),false);assert.equal(w.eval('db.data.a1.customers[0].photo'),undefined);assert.equal(errors.length,0);
 }finally{dom.window.close()}
});
test('photo removal failure retains saved photo and form',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 w.eval(`db=demoFixtures();db.data.a1.customers[0].photo='data:image/jpeg;base64,AA';Store.open=async()=>{throw new Error('quota')}`);
 await w.eval("removePhoto('c1')");assert.equal(w.eval('db.data.a1.customers[0].photo'),'data:image/jpeg;base64,AA');assert.equal(errors.length,0);
 }finally{dom.window.close()}
});
test('all ledger UI modules avoid legacy fire-and-forget save calls',()=>{
 for(const file of ['actions.js','screens.js','state.js','voice-ui.js','admin-actions.js'])assert.doesNotMatch(fs.readFileSync(path.join(web,'js',file),'utf8'),/\bsave\(\)/,file);
});

test('account creation preserves form on failure and commits a valid account on retry',async()=>{
 const {dom,errors}=boot();try{await ready(dom);const w=dom.window;await w.eval('Store.tail');
 w.eval(`ui.accEdit='new';ui.accTy='grocery';renderAccSheet();document.getElementById('aeNm').value='New store';window.realStoreOpen=Store.open.bind(Store);Store.open=async()=>{throw new Error('quota')}`);
 await w.eval('saveAccEdit()');assert.equal(w.eval('db.accounts.length'),1);assert.equal(w.eval('ui.accEdit'),'new');assert.equal(w.document.getElementById('aeNm').value,'New store');
 w.eval('Store.open=window.realStoreOpen');await w.eval('saveAccEdit()');assert.equal(w.eval('db.accounts.length'),2);assert.equal(w.eval('curAcc().name'),'New store');assert.equal(w.eval('curAcc().minorUnit'),2);assert.equal(w.eval('DD().seq'),1);assert.equal(w.eval('ui.accEdit'),null);assert.equal(errors.length,0);
 }finally{dom.window.close()}
});
