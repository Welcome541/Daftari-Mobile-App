/*
 * Whisper.cpp browser adapter for Daftari.
 * Runtime: https://github.com/ggml-org/whisper.cpp (MIT; see LICENSE)
 * The imported GGML model stays in this browser's IndexedDB and is never uploaded.
 */
(function () {
  'use strict';
  var DB_NAME = 'dafter-whisper-model', STORE = 'models', KEY = 'active';
  var ENGINE_URL = document.currentScript && document.currentScript.src || location.href;
  var MIN_MODEL_BYTES = 8 * 1024 * 1024, MAX_MODEL_BYTES = 500 * 1024 * 1024;
  var meta = null, runtimePromise = null, readyPromise = null, wasm = null, instance = 0;
  var active = null, modelMutation = false, modelRevision = 0, lastLines = [], transcribeTimer = null;

  function notify() {
    try { window.dispatchEvent(new CustomEvent('whisper-model-change')); } catch (_) {}
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('المتصفح لا يدعم التخزين المحلي المطلوب للنموذج.'));
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('تعذّر فتح مخزن النموذج.')); };
    });
  }
  function requestValue(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error || new Error('تعذّر الوصول إلى ملف النموذج.')); };
    });
  }
  async function readModel() {
    var db = await openDb();
    try { return await requestValue(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)); }
    finally { db.close(); }
  }
  async function writeModel(record) {
    var db = await openDb();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record, KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error('تعذّر حفظ النموذج.')); };
        tx.onabort = function () { reject(tx.error || new Error('أُلغي حفظ النموذج.')); };
      });
    } finally { db.close(); }
  }
  async function deleteModel() {
    var db = await openDb();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error('تعذّر حذف النموذج.')); };
        tx.onabort = function () { reject(tx.error || new Error('أُلغي حذف النموذج.')); };
      });
    } finally { db.close(); }
  }
  function formatBytes(n) { return n >= 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function closeContext(context) {
    if (!context) return;
    try { var p = context.close(); if (p && typeof p.catch === 'function') p.catch(function () {}); } catch (_) {}
  }
  function failActive(error) {
    clearTimeout(transcribeTimer); transcribeTimer = null;
    var job = active; active = null;
    if (job && job.stream) job.stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
    if (job && job.context) closeContext(job.context);
    if (job && job.processor) { job.processor.onaudioprocess = null; try { job.processor.disconnect(); } catch (_) {} }
    if (job && typeof job.reject === 'function') job.reject(error instanceof Error ? error : new Error(String(error || 'فشل التعرف الصوتي.')));
  }
  function finishTranscription() {
    if (!active || !active.transcribing) return;
    clearTimeout(transcribeTimer); transcribeTimer = null;
    var job = active;
    var text = lastLines.map(function (line) {
      var m = line.match(/\[?\s*\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*-->\s*\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*\]?\s*(.*)$/);
      return m ? m[1] : '';
    }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    active = null;
    if (job.stream) job.stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
    if (job.context) closeContext(job.context);
    if (job.processor) { job.processor.onaudioprocess = null; try { job.processor.disconnect(); } catch (_) {} }
    if (!text) {
      if (typeof job.reject === 'function') job.reject(new Error('لم يلتقط النموذج كلامًا واضحًا.'));
      return;
    }
    if (typeof job.resolve === 'function') job.resolve(text);
  }
  function onPrint(value) {
    var line = String(value == null ? '' : value);
    if (!active || !active.transcribing) return;
    lastLines.push(line);
    if (/whisper_print_timings:|total time\s*=/i.test(line)) finishTranscription();
  }
  async function loadRuntime() {
    if (wasm && typeof wasm.init === 'function') return wasm;
    if (runtimePromise) return runtimePromise;
    if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      throw new Error('يتطلب Whisper متصفحًا آمنًا مع عزل Cross-Origin. افتح التطبيق عبر HTTPS بعد تحديثه، أو استخدم محرك الهاتف.');
    }
    runtimePromise = new Promise(function (resolve, reject) {
      var resolved = false;
      window.Module = {
        print: onPrint,
        printErr: function (message) { if (active && active.transcribing) onPrint(message); },
        onRuntimeInitialized: function () {
          if (resolved) return; resolved = true; wasm = window.Module; resolve(wasm);
        },
        onAbort: function (reason) {
          var err = new Error('تعذّر تشغيل Whisper WebAssembly: ' + String(reason || 'unknown'));
          if (!resolved) { resolved = true; reject(err); }
          if (active) failActive(err);
        }
      };
      var script = document.createElement('script');
      script.src = new URL('main.js', ENGINE_URL).href;
      script.async = true;
      script.onerror = function () { if (!resolved) { resolved = true; reject(new Error('تعذّر تحميل مكتبة Whisper المحلية.')); } };
      document.head.appendChild(script);
      setTimeout(function () {
        if (!resolved && window.Module && typeof window.Module.init === 'function') {
          resolved = true; wasm = window.Module; resolve(wasm);
        }
      }, 0);
      setTimeout(function () {
        if (!resolved) { resolved = true; reject(new Error('لم تكتمل تهيئة Whisper؛ تحقق من الذاكرة وتوافق المتصفح.')); }
      }, 90000);
    }).catch(function (err) { runtimePromise = null; throw err; });
    return runtimePromise;
  }
  async function prepare() {
    if (modelMutation) throw new Error('انتظر انتهاء استيراد أو إزالة النموذج أولًا.');
    if (instance && wasm && typeof wasm.init === 'function') return true;
    if (readyPromise) return readyPromise;
    var revision = modelRevision;
    var pending = (async function () {
      var record = await readModel();
      if (revision !== modelRevision) throw new Error('تغيّر النموذج أثناء التهيئة؛ أعد المحاولة.');
      if (!record || !record.blob) throw new Error('استورد ملف ggml-tiny.bin أولًا من الإعدادات.');
      if (record.size < MIN_MODEL_BYTES || record.size > MAX_MODEL_BYTES) throw new Error('حجم ملف النموذج غير مدعوم.');
      var mod = await loadRuntime();
      if (revision !== modelRevision) throw new Error('تغيّر النموذج أثناء التهيئة؛ أعد المحاولة.');
      if (typeof mod.FS_createDataFile !== 'function' || typeof mod.init !== 'function') throw new Error('واجهة محرك Whisper غير مكتملة.');
      var buffer = await record.blob.arrayBuffer();
      if (revision !== modelRevision) throw new Error('تغيّر النموذج أثناء التهيئة؛ أعد المحاولة.');
      var bytes = new Uint8Array(buffer);
      try { mod.FS_unlink('/whisper.bin'); } catch (_) {}
      mod.FS_createDataFile('/', 'whisper.bin', bytes, true, true);
      var id = mod.init('whisper.bin');
      if (!id) throw new Error('رفض Whisper ملف النموذج. تأكد أنه نموذج ggml من whisper.cpp وليس نموذج Vosk أو GGUF.');
      if (revision !== modelRevision) {
        try { if (mod.free) mod.free(id); } catch (_) {}
        throw new Error('تغيّر النموذج أثناء التهيئة؛ أعد المحاولة.');
      }
      instance = id; meta = { name: record.name, size: record.size, ready: true };
      notify(); return true;
    })();
    var wrapped = pending.catch(function (err) {
      if (readyPromise === wrapped) readyPromise = null;
      throw err;
    });
    readyPromise = wrapped;
    return wrapped;
  }
  async function validateAndStore(blob, name) {
    if (active) throw new Error('أوقف التسجيل قبل استبدال نموذج Whisper.');
    if (modelMutation) throw new Error('يوجد استيراد أو إزالة نموذج جارٍ بالفعل.');
    modelMutation = true;
    try {
      if (!blob) throw new Error('لم يصل ملف النموذج.');
      if (!/\.bin$/i.test(name || '')) throw new Error('اختر ملفًا بامتداد .bin مثل ggml-tiny.bin.');
      if (blob.size < MIN_MODEL_BYTES || blob.size > MAX_MODEL_BYTES) throw new Error('حجم النموذج خارج النطاق المقبول (8–500 MB).');
      var head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (head.length !== 4 || head[0] !== 0x6c || head[1] !== 0x6d || head[2] !== 0x67 || head[3] !== 0x67) {
        throw new Error('هذا الملف ليس نموذج GGML Whisper صالحًا (ترويسة ggml غير موجودة).');
      }
      if (navigator.storage && navigator.storage.estimate) {
        var usage = await navigator.storage.estimate();
        if (usage.quota && usage.quota - (usage.usage || 0) < blob.size * 1.15) throw new Error('المساحة المتاحة في الجهاز غير كافية لتخزين النموذج.');
      }
      if (active) throw new Error('أوقف التسجيل قبل استبدال نموذج Whisper.');
      await writeModel({ name: name, size: blob.size, blob: blob });
      modelRevision++;
      if (instance && wasm && wasm.free) { try { wasm.free(instance); } catch (_) {} }
      meta = { name: name, size: blob.size, ready: false };
      instance = 0; readyPromise = null;
      notify();
      return true;
    } finally { modelMutation = false; }
  }
  async function importModel(file) {
    if (!file) return false;
    return validateAndStore(file, file.name || 'model.bin');
  }
  /* Import a model that already lives in the app's own storage (served by the
     local asset host), so the phone file picker and the HTML input share one path. */
  async function importFromUrl(url, name) {
    if (!url) throw new Error('مسار الملف غير صالح.');
    var response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('تعذّر قراءة ملف النموذج من ذاكرة التطبيق (HTTP ' + response.status + ').');
    var blob = await response.blob();
    var fileName = name || decodeURIComponent(String(url).split('/').pop() || 'model.bin');
    return validateAndStore(blob, fileName);
  }
  async function loadMeta() {
    if (modelMutation) return meta;
    var revision = modelRevision;
    try {
      var record = await readModel();
      if (revision !== modelRevision || modelMutation) return meta;
      meta = record ? { name: record.name, size: record.size, ready: !!instance } : null;
    } catch (_) { if (revision === modelRevision && !modelMutation) meta = null; }
    notify(); return meta;
  }
  async function removeModel() {
    if (active) throw new Error('أوقف التسجيل قبل إزالة النموذج.');
    if (modelMutation) throw new Error('يوجد استيراد أو إزالة نموذج جارٍ بالفعل.');
    modelMutation = true;
    try {
      await deleteModel();
      modelRevision++;
      if (instance && wasm && wasm.free) { try { wasm.free(instance); } catch (_) {} }
      instance = 0; readyPromise = null; meta = null;
      notify();
    } finally { modelMutation = false; }
  }
  function start(kind, custId, language) {
    if (modelMutation) return Promise.reject(new Error('انتظر انتهاء استيراد أو إزالة النموذج أولًا.'));
    if (!instance || !wasm) return Promise.reject(new Error('محرك Whisper لم يجهز بعد.'));
    if (active) return Promise.reject(new Error('يوجد تسجيل صوتي جارٍ بالفعل.'));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('الميكروفون غير متاح؛ استخدم التطبيق عبر HTTPS.'));
    return new Promise(function (resolve, reject) {
      var job = { kind: kind, custId: custId, language: language === 'en' ? 'en' : 'ar', resolve: resolve, reject: reject, samples: [], stream: null, context: null, rate: 16000, processor: null, transcribing: false };
      active = job;
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }).then(function (stream) {
        if (active !== job) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        job.stream = stream;
        var AC = window.AudioContext || window.webkitAudioContext;
        job.context = new AC({ sampleRate: 16000 });
        job.rate = job.context.sampleRate || 16000;
        return job.context.resume().then(function () {
          var source = job.context.createMediaStreamSource(stream);
          var processor = job.context.createScriptProcessor(4096, 1, 1);
          var mute = job.context.createGain(); mute.gain.value = 0;
          job.processor = processor;
          processor.onaudioprocess = function (event) {
            if (!active || active !== job || job.transcribing) return;
            job.samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
          };
          source.connect(processor); processor.connect(mute); mute.connect(job.context.destination);
        });
      }).catch(function (err) { if (active === job) failActive(err); });
    });
  }
  function stop() {
    if (!active) return Promise.reject(new Error('لا يوجد تسجيل Whisper جارٍ.'));
    var job = active;
    if (job.transcribing) return Promise.resolve();
    job.transcribing = true;
    if (job.stream) job.stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
    if (job.processor) { job.processor.onaudioprocess = null; try { job.processor.disconnect(); } catch (_) {} }
    if (job.context) closeContext(job.context);
    if (!job.samples.length) { failActive(new Error('لم يصل صوت من الميكروفون.')); return Promise.reject(new Error('لم يصل صوت من الميكروفون.')); }
    var total = job.samples.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
    var merged = new Float32Array(total), offset = 0;
    job.samples.forEach(function (chunk) { merged.set(chunk, offset); offset += chunk.length; });
    job.samples = [];
    var sourceRate = job.rate || (job.context ? job.context.sampleRate : 16000) || 16000;
    var pcm = merged;
    if (sourceRate !== 16000) {
      var outLength = Math.floor(merged.length * 16000 / sourceRate);
      pcm = new Float32Array(outLength);
      for (var i = 0; i < outLength; i++) {
        var pos = i * sourceRate / 16000, left = Math.floor(pos), frac = pos - left;
        pcm[i] = (merged[left] || 0) * (1 - frac) + (merged[Math.min(left + 1, merged.length - 1)] || 0) * frac;
      }
    }
    lastLines = [];
    try {
      var result = wasm.full_default(instance, pcm, job.language, Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)), false);
      if (result) throw new Error('تعذّر بدء الاستدلال في Whisper (' + result + ').');
      transcribeTimer = setTimeout(function () { if (active === job) failActive(new Error('استغرق التعرف وقتًا أطول من المتوقع.')); }, 10 * 60 * 1000);
    } catch (err) { failActive(err); return Promise.reject(err); }
    return Promise.resolve();
  }
  function cancel() {
    if (!active) return;
    var job = active; active = null;
    clearTimeout(transcribeTimer); transcribeTimer = null;
    if (job.stream) job.stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
    if (job.processor) { job.processor.onaudioprocess = null; try { job.processor.disconnect(); } catch (_) {} }
    if (job.context) closeContext(job.context);
  }
  window.whisperEngine = {
    get hasModel() { return !!meta; },
    get ready() { return !!instance && !!wasm; },
    get modelName() { return meta && meta.name || ''; },
    get modelSize() { return meta && meta.size || 0; },
    formatBytes: formatBytes,
    loadMeta: loadMeta,
    importModel: importModel,
    importFromUrl: importFromUrl,
    removeModel: removeModel,
    prepare: prepare,
    start: start,
    stop: stop,
    cancel: cancel
  };
  loadMeta();
})();
