/*
 * Whisper.cpp browser adapter for Daftari.
 * Runtime: https://github.com/ggml-org/whisper.cpp (MIT; see LICENSE)
 * The imported GGML model stays in this browser's IndexedDB and is never uploaded.
 */
(function () {
  "use strict";
  var DB_NAME = "dafter-whisper-model",
    STORE = "models",
    KEY = "active";
  var ENGINE_URL =
    (document.currentScript && document.currentScript.src) || location.href;
  var MIN_MODEL_BYTES = 8 * 1024 * 1024,
    MAX_MODEL_BYTES = 500 * 1024 * 1024;
  var meta = null,
    runtimePromise = null,
    readyPromise = null,
    wasm = null,
    instance = 0;
  var active = null,
    inference = null,
    generation = 0,
    mutating = false;
  var poisoned = false,
    releasePending = false;

  function notify() {
    try {
      window.dispatchEvent(new CustomEvent("whisper-model-change"));
    } catch (_) {}
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB)
        return reject(
          new Error("المتصفح لا يدعم التخزين المحلي المطلوب للنموذج."),
        );
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE))
          req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("تعذّر فتح مخزن النموذج."));
      };
    });
  }
  function requestValue(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result || null);
      };
      req.onerror = function () {
        reject(req.error || new Error("تعذّر الوصول إلى ملف النموذج."));
      };
    });
  }
  async function readModel() {
    var db = await openDb();
    try {
      return await requestValue(
        db.transaction(STORE, "readonly").objectStore(STORE).get(KEY),
      );
    } finally {
      db.close();
    }
  }
  async function writeModel(record) {
    var db = await openDb();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record, KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () {
          reject(tx.error || new Error("تعذّر حفظ النموذج."));
        };
        tx.onabort = function () {
          reject(tx.error || new Error("أُلغي حفظ النموذج."));
        };
      });
    } finally {
      db.close();
    }
  }
  async function deleteModel() {
    var db = await openDb();
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () {
          reject(tx.error || new Error("تعذّر حذف النموذج."));
        };
      });
    } finally {
      db.close();
    }
  }
  function formatBytes(n) {
    return n >= 1024 * 1024
      ? (n / (1024 * 1024)).toFixed(1) + " MB"
      : Math.round(n / 1024) + " KB";
  }
  function abortError() {
    var error = new Error("أُلغي التسجيل");
    error.name = "AbortError";
    return error;
  }
  function closeAudio(job) {
    if (job.processor) {
      job.processor.onaudioprocess = null;
      try {
        job.processor.disconnect();
      } catch (_) {}
      job.processor = null;
    }
    [job.source, job.mute].forEach(function (node) {
      if (node)
        try {
          node.disconnect();
        } catch (_) {}
    });
    if (job.stream) {
      job.stream.getTracks().forEach(function (track) {
        try {
          track.stop();
        } catch (_) {}
      });
      job.stream = null;
    }
    if (job.context) {
      try {
        job.context.close().catch(function () {});
      } catch (_) {}
      job.context = null;
    }
    job.samples = [];
  }
  function failActive(error) {
    var job = active;
    if (!job) return;
    active = null;
    closeAudio(job);
    job.lines = [];
    job.reject(error);
  }
  function unloadModel() {
    if (instance && wasm && wasm.free) {
      try {
        wasm.free(instance);
      } catch (_) {}
    }
    instance = 0;
    if (wasm && wasm.FS_unlink) {
      try {
        wasm.FS_unlink("/whisper.bin");
      } catch (_) {}
    }
    if (meta) meta.ready = false;
    releasePending = false;
  }
  function finishInference(job) {
    if (inference !== job || poisoned) return;
    clearTimeout(job.timer);
    inference = null;
    if (active === job) {
      var text = job.lines
        .map(function (line) {
          var match = line.match(
            /\[?\s*\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*-->\s*\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*\]?\s*(.*)$/,
          );
          return match ? match[1] : "";
        })
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      active = null;
      closeAudio(job);
      job.lines = [];
      if (text) job.resolve(text);
      else job.reject(new Error("لم يلتقط النموذج كلامًا واضحًا."));
    }
    if (releasePending) unloadModel();
  }
  function onPrint(value) {
    var job = inference;
    if (!job || poisoned) return;
    var line = String(value == null ? "" : value);
    if (active === job && job.lines.length < 10000) job.lines.push(line);
    // The first timings line is NOT completion. Wait for the final total-time marker.
    if (/whisper_print_timings:.*total time\s*=/i.test(line))
      finishInference(job);
  }
  async function loadRuntime() {
    if (poisoned)
      throw new Error(
        "محرك Whisper يحتاج إعادة فتح التطبيق بعد فشل الاستدلال أو التحميل.",
      );
    if (wasm && typeof wasm.init === "function") return wasm;
    if (runtimePromise) return runtimePromise;
    if (
      !window.crossOriginIsolated ||
      typeof SharedArrayBuffer === "undefined"
    ) {
      throw new Error(
        "يتطلب Whisper عزل Cross-Origin وSharedArrayBuffer؛ حدّث WebView أو اختر Vosk.",
      );
    }
    runtimePromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        fail(new Error("انتهت مهلة تحميل Whisper؛ أعد فتح التطبيق."));
      }, 90000);
      function fail(error) {
        poisoned = true;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
        if (active) failActive(error);
      }
      window.Module = {
        print: onPrint,
        printErr: onPrint,
        onRuntimeInitialized: function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          wasm = window.Module;
          resolve(wasm);
        },
        onAbort: function (reason) {
          fail(
            new Error("تعذّر تشغيل Whisper: " + String(reason || "unknown")),
          );
        },
      };
      var script = document.createElement("script");
      script.src = new URL("main.js", ENGINE_URL).href;
      script.async = true;
      script.onerror = function () {
        fail(new Error("تعذّر تحميل مكتبة Whisper المحلية؛ أعد فتح التطبيق."));
      };
      document.head.appendChild(script);
    });
    // Never overwrite Module while a failed/timed-out runtime may still be starting.
    return runtimePromise;
  }
  function prepare() {
    if (poisoned)
      return Promise.reject(
        new Error("أعد فتح التطبيق لإعادة تشغيل Whisper بأمان."),
      );
    if (mutating || inference)
      return Promise.reject(
        new Error("Whisper مشغول بتحديث النموذج أو إنهاء استدلال سابق."),
      );
    if (instance && wasm) return Promise.resolve(true);
    if (readyPromise) return readyPromise;
    var version = generation;
    var pending = (async function () {
      var record = await readModel();
      if (version !== generation) throw abortError();
      if (!record || !record.blob)
        throw new Error("استورد ملف ggml-tiny.bin أولًا من الإعدادات.");
      if (record.size < MIN_MODEL_BYTES || record.size > MAX_MODEL_BYTES)
        throw new Error("حجم ملف النموذج غير مدعوم.");
      var mod = await loadRuntime();
      if (version !== generation) throw abortError();
      if (
        typeof mod.FS_createDataFile !== "function" ||
        typeof mod.init !== "function"
      )
        throw new Error("واجهة محرك Whisper غير مكتملة.");
      var buffer = await record.blob.arrayBuffer();
      if (version !== generation) throw abortError();
      try {
        mod.FS_unlink("/whisper.bin");
      } catch (_) {}
      mod.FS_createDataFile(
        "/",
        "whisper.bin",
        new Uint8Array(buffer),
        true,
        true,
      );
      var id;
      try {
        id = mod.init("whisper.bin");
      } catch (error) {
        try {
          mod.FS_unlink("/whisper.bin");
        } catch (_) {}
        throw error;
      }
      if (!id) {
        try {
          mod.FS_unlink("/whisper.bin");
        } catch (_) {}
        throw new Error("رفض Whisper ملف GGML؛ تحقق من توافق النموذج.");
      }
      instance = id;
      meta = { name: record.name, size: record.size, ready: true };
      notify();
      return true;
    })();
    readyPromise = pending;
    pending.then(
      function () {
        if (readyPromise === pending) readyPromise = null;
      },
      function () {
        if (readyPromise === pending) readyPromise = null;
      },
    );
    return pending;
  }
  function ensureMutable() {
    if (active || inference || readyPromise || mutating)
      throw new Error(
        "أوقف التسجيل وانتظر انتهاء تجهيز المحرك أو الاستدلال قبل تغيير النموذج.",
      );
  }
  async function importModel(file) {
    ensureMutable();
    mutating = true;
    try {
      if (!file) return false;
      if (!/\.bin$/i.test(file.name || ""))
        throw new Error("اختر ملفًا بامتداد .bin مثل ggml-tiny.bin.");
      if (file.size < MIN_MODEL_BYTES || file.size > MAX_MODEL_BYTES)
        throw new Error("حجم النموذج خارج النطاق المقبول (8–500 MB).");
      var head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (
        head.length !== 4 ||
        head[0] !== 0x6c ||
        head[1] !== 0x6d ||
        head[2] !== 0x67 ||
        head[3] !== 0x67
      ) {
        throw new Error(
          "هذا الملف ليس نموذج GGML Whisper صالحًا (ترويسة ggml غير موجودة).",
        );
      }
      if (navigator.storage && navigator.storage.estimate) {
        var usage = await navigator.storage.estimate();
        if (usage.quota && usage.quota - (usage.usage || 0) < file.size * 1.15)
          throw new Error(
            "المساحة المتاحة في الجهاز غير كافية لتخزين النموذج.",
          );
      }
      // Commit IndexedDB before freeing the previously working runtime model.
      await writeModel({ name: file.name, size: file.size, blob: file });
      generation++;
      unloadModel();
      readyPromise = null;
      meta = { name: file.name, size: file.size, ready: false };
      notify();
      return true;
    } finally {
      mutating = false;
    }
  }
  async function loadMeta() {
    var version = generation;
    try {
      var record = await readModel();
      if (version === generation && !mutating)
        meta = record
          ? { name: record.name, size: record.size, ready: !!instance }
          : null;
    } catch (error) {
      console.error("Whisper metadata", error);
    }
    notify();
    return meta;
  }
  async function removeModel() {
    ensureMutable();
    mutating = true;
    try {
      await deleteModel();
      generation++;
      unloadModel();
      readyPromise = null;
      meta = null;
      notify();
    } finally {
      mutating = false;
    }
  }
  function start(kind, custId, language, onStarted) {
    if (poisoned)
      return Promise.reject(
        new Error("أعد فتح التطبيق لإعادة تشغيل Whisper بأمان."),
      );
    if (!instance || !wasm || mutating)
      return Promise.reject(new Error("محرك Whisper لم يجهز بعد."));
    if (active || inference)
      return Promise.reject(
        new Error("Whisper مشغول؛ انتظر انتهاء الاستدلال السابق."),
      );
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return Promise.reject(
        new Error("الميكروفون غير متاح؛ استخدم التطبيق عبر HTTPS."),
      );
    return new Promise(function (resolve, reject) {
      var job = {
        language: language === "en" ? "en" : "ar",
        resolve: resolve,
        reject: reject,
        samples: [],
        sampleCount: 0,
        sampleRate: 16000,
        stream: null,
        context: null,
        processor: null,
        source: null,
        mute: null,
        started: false,
        transcribing: false,
        lines: [],
        timer: null,
      };
      active = job;
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
        .then(function (stream) {
          if (active !== job) {
            stream.getTracks().forEach(function (track) {
              try {
                track.stop();
              } catch (_) {}
            });
            return;
          }
          job.stream = stream;
          var AC = window.AudioContext || window.webkitAudioContext;
          job.context = new AC({ sampleRate: 16000 });
          return job.context.resume().then(function () {
            if (active !== job) return;
            job.sampleRate = job.context.sampleRate;
            job.source = job.context.createMediaStreamSource(stream);
            job.processor = job.context.createScriptProcessor(4096, 1, 1);
            job.mute = job.context.createGain();
            job.mute.gain.value = 0;
            job.processor.onaudioprocess = function (event) {
              if (active !== job || job.transcribing) return;
              var samples = event.inputBuffer.getChannelData(0);
              job.sampleCount += samples.length;
              if (job.sampleCount > job.sampleRate * 31) {
                failActive(new Error("تجاوز التسجيل الحد الزمني المسموح."));
                return;
              }
              job.samples.push(new Float32Array(samples));
            };
            job.source.connect(job.processor);
            job.processor.connect(job.mute);
            job.mute.connect(job.context.destination);
            job.started = true;
            if (onStarted) onStarted();
          });
        })
        .catch(function (error) {
          if (active === job) failActive(error);
        });
    });
  }
  function stop() {
    var job = active;
    if (!job) return Promise.resolve();
    if (job.transcribing) return Promise.resolve();
    if (!job.started || !job.samples.length) {
      var empty = new Error("لم يصل صوت من الميكروفون.");
      failActive(empty);
      return Promise.reject(empty);
    }
    job.transcribing = true;
    var total = job.samples.reduce(function (sum, chunk) {
      return sum + chunk.length;
    }, 0);
    var merged = new Float32Array(total),
      offset = 0;
    job.samples.forEach(function (chunk) {
      merged.set(chunk, offset);
      offset += chunk.length;
    });
    closeAudio(job);
    var sourceRate = job.sampleRate,
      pcm = merged;
    if (sourceRate !== 16000) {
      var outLength = Math.floor((merged.length * 16000) / sourceRate);
      pcm = new Float32Array(outLength);
      for (var i = 0; i < outLength; i++) {
        var pos = (i * sourceRate) / 16000,
          left = Math.floor(pos),
          frac = pos - left;
        pcm[i] =
          (merged[left] || 0) * (1 - frac) +
          (merged[Math.min(left + 1, merged.length - 1)] || 0) * frac;
      }
    }
    inference = job;
    job.timer = setTimeout(
      function () {
        if (inference !== job) return;
        poisoned = true;
        if (active === job)
          failActive(
            new Error(
              "انتهت مهلة Whisper؛ أعد فتح التطبيق قبل المحاولة مجددًا.",
            ),
          );
      },
      10 * 60 * 1000,
    );
    try {
      var result = wasm.full_default(
        instance,
        pcm,
        job.language,
        Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)),
        false,
      );
      if (result)
        throw new Error("تعذّر بدء الاستدلال في Whisper (" + result + ").");
    } catch (error) {
      // No guarantee that a failed native call has stopped its worker: quarantine it.
      poisoned = true;
      clearTimeout(job.timer);
      if (active === job) failActive(error);
      return Promise.reject(error);
    }
    return Promise.resolve();
  }
  function cancel() {
    if (active) failActive(abortError());
  }
  function release() {
    cancel();
    generation++;
    readyPromise = null;
    if (inference) releasePending = true;
    else unloadModel();
  }
  window.whisperEngine = {
    get hasModel() {
      return !!meta;
    },
    get ready() {
      return !!instance && !!wasm;
    },
    get modelName() {
      return (meta && meta.name) || "";
    },
    get modelSize() {
      return (meta && meta.size) || 0;
    },
    formatBytes: formatBytes,
    loadMeta: loadMeta,
    importModel: importModel,
    removeModel: removeModel,
    prepare: prepare,
    start: start,
    stop: stop,
    cancel: cancel,
    release: release,
    get busy() {
      return !!active || !!inference || !!readyPromise || mutating;
    },
  };
  loadMeta();
})();
