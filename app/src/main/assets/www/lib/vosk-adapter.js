/* Vosk browser adapter. Owns model/recognizer/audio resources, never UI or ledger state. */
(function () {
  "use strict";
  var scriptURL =
    (document.currentScript && document.currentScript.src) || location.href;
  var model = null,
    loading = null,
    runtime = null,
    generation = 0,
    active = null,
    candidate = null;
  function abortError() {
    var e = new Error("أُلغي التسجيل");
    e.name = "AbortError";
    return e;
  }
  function factory() {
    return (
      window.createModel ||
      (window.Vosk && window.Vosk.createModel) ||
      (window.vosk && window.vosk.createModel)
    );
  }
  function destroyModel(value) {
    if (!value) return;
    try {
      value.terminate();
    } catch (_) {}
    // The bundled Model exposes its Worker; terminate it even while WASM is loading.
    if (value.worker && value.worker.terminate) {
      try {
        value.worker.terminate();
      } catch (_) {}
    }
  }
  function loadRuntime() {
    if (factory()) return Promise.resolve();
    if (runtime) return runtime;
    runtime = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = new URL("vosk-browser.js", scriptURL).href;
      script.onload = function () {
        if (factory()) resolve();
        else reject(new Error("واجهة Vosk غير متاحة"));
      };
      script.onerror = function () {
        script.remove();
        reject(new Error("تعذّر تحميل مكتبة Vosk المحلية"));
      };
      document.head.appendChild(script);
    }).catch(function (e) {
      runtime = null;
      throw e;
    });
    return runtime;
  }
  function createModel(version) {
    var Constructor = window.Vosk && window.Vosk.Model;
    if (!Constructor) return factory()("model-ar/model.tar.gz");
    return new Promise(function (resolve, reject) {
      var loaded = new Constructor("model-ar/model.tar.gz");
      var entry = { model: loaded, reject: reject, done: false };
      candidate = entry;
      function finish(error) {
        if (entry.done) return;
        entry.done = true;
        if (candidate === entry) candidate = null;
        if (version !== generation) error = abortError();
        if (error) {
          destroyModel(loaded);
          reject(error);
        } else resolve(loaded);
      }
      loaded.on("load", function (event) {
        finish(
          event && event.result ? null : new Error("رفض Vosk ملف النموذج"),
        );
      });
      loaded.on("error", function () {
        finish(new Error("تعذّر تحميل نموذج Vosk"));
      });
    });
  }
  function prepare() {
    if (model) return Promise.resolve();
    if (loading) return loading;
    var version = generation;
    var pending = loadRuntime()
      .then(function () {
        if (version !== generation) throw abortError();
        return fetch("model-ar/model.tar.gz", { method: "HEAD" });
      })
      .then(function (response) {
        if (version !== generation) throw abortError();
        if (!response.ok)
          throw new Error("استورد ZIP نموذج Vosk من الإعدادات أولًا");
        return createModel(version);
      })
      .then(function (loaded) {
        if (version !== generation) {
          destroyModel(loaded);
          throw abortError();
        }
        model = loaded;
      });
    loading = pending;
    pending.then(
      function () {
        if (loading === pending) loading = null;
      },
      function () {
        if (loading === pending) loading = null;
      },
    );
    return pending;
  }
  function closeAudio(job) {
    if (job.processor) {
      job.processor.onaudioprocess = null;
      try {
        job.processor.disconnect();
      } catch (_) {}
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
  }
  function finish(job, error, text) {
    if (active !== job) return;
    active = null;
    clearTimeout(job.timer);
    closeAudio(job);
    if (job.rec) {
      try {
        job.rec.remove();
      } catch (_) {}
      job.rec = null;
    }
    if (error) job.reject(error);
    else job.resolve(text);
  }
  function start(options) {
    if (!model || active) throw new Error("محرك Vosk غير جاهز أو مشغول");
    var job = {
      timer: null,
      rec: null,
      stream: null,
      context: null,
      source: null,
      mute: null,
      processor: null,
      stopping: false,
    };
    var result = new Promise(function (resolve, reject) {
      job.resolve = resolve;
      job.reject = reject;
    });
    active = job;
    Promise.resolve()
      .then(function () {
        if (active !== job) return null;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
          throw new Error("الميكروفون غير متاح");
        return navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      })
      .then(function (stream) {
        if (!stream) return;
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
        job.context = new AC();
        return job.context.resume().then(function () {
          if (active !== job) return;
          job.rec = new model.KaldiRecognizer(job.context.sampleRate);
          job.rec.on("result", function (event) {
            if (active !== job) return;
            var text = event && event.result && event.result.text;
            if (text) finish(job, null, String(text));
            else if (job.stopping)
              finish(job, new Error("لم يُلتقط كلام واضح"));
          });
          job.rec.on("error", function () {
            finish(job, new Error("تعذّر التعرف الصوتي عبر Vosk"));
          });
          job.rec.on("partialresult", function (event) {
            if (active === job && options.onPartial)
              options.onPartial(
                (event && event.result && event.result.partial) || "",
              );
          });
          job.source = job.context.createMediaStreamSource(stream);
          job.processor = job.context.createScriptProcessor(4096, 1, 1);
          job.mute = job.context.createGain();
          job.mute.gain.value = 0;
          job.processor.onaudioprocess = function (event) {
            if (active !== job || job.stopping) return;
            try {
              job.rec.acceptWaveform(event.inputBuffer);
            } catch (error) {
              finish(job, error);
            }
          };
          job.source.connect(job.processor);
          job.processor.connect(job.mute);
          job.mute.connect(job.context.destination);
          if (options.onStarted) options.onStarted();
        });
      })
      .catch(function (error) {
        finish(job, error);
      });
    return {
      result: result,
      stop: function () {
        if (active !== job || job.stopping) return;
        job.stopping = true;
        closeAudio(job);
        if (!job.rec) {
          finish(job, new Error("لم يصل صوت من الميكروفون"));
          return;
        }
        job.timer = setTimeout(function () {
          finish(job, new Error("انتهت مهلة نتيجة Vosk"));
        }, 3000);
        try {
          job.rec.retrieveFinalResult();
        } catch (error) {
          finish(job, error);
        }
      },
      cancel: function () {
        finish(job, abortError());
      },
    };
  }
  function release() {
    generation++;
    loading = null;
    if (candidate) {
      var entry = candidate;
      candidate = null;
      entry.done = true;
      destroyModel(entry.model);
      entry.reject(abortError());
    }
    if (active) finish(active, abortError());
    if (model) {
      destroyModel(model);
      model = null;
    }
  }
  window.voskEngine = {
    prepare: prepare,
    start: start,
    release: release,
    get ready() {
      return !!model;
    },
    get recording() {
      return !!active;
    },
  };
})();
