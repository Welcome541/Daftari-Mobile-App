(function (global) {
  "use strict";
  function webEngine() {
    var current = null;
    return {
      initialize: function () {
        if (!global.SpeechRecognition && !global.webkitSpeechRecognition)
          return Promise.reject(
            DaftariSpeech.error(
              "UNSUPPORTED",
              "محرك التعرف الخاص بالمتصفح غير متاح؛ اختر نموذجًا محليًا",
            ),
          );
        return Promise.resolve();
      },
      start: function (options) {
        var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
        var rec = new SR(),
          timer;
        var resolve,
          reject,
          done = false;
        var result = new Promise(function (yes, no) {
          resolve = yes;
          reject = no;
        });
        function finish(failure, text) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
          try {
            rec.abort();
          } catch (_) {}
          if (current === session) current = null;
          if (failure) reject(failure);
          else resolve(text);
        }
        var session = {
          result: result,
          stop: function () {
            if (done) return;
            timer = setTimeout(function () {
              finish(DaftariSpeech.error("NO_SPEECH", "لم يُلتقط كلام واضح"));
            }, 3000);
            try {
              rec.stop();
            } catch (e) {
              finish(e);
            }
          },
          cancel: function () {
            finish(DaftariSpeech.aborted());
          },
        };
        current = session;
        rec.lang = options.language === "en" ? "en-US" : "ar-SA";
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onstart = options.onStarted;
        rec.onresult = function (event) {
          for (var i = event.resultIndex || 0; i < event.results.length; i++) {
            var item = event.results[i];
            if (item.isFinal) {
              finish(null, item[0].transcript);
              return;
            }
            if (options.onPartial) options.onPartial(item[0].transcript || "");
          }
        };
        rec.onerror = function (event) {
          finish(
            DaftariSpeech.error(
              event.error || "WEB_SPEECH_FAILED",
              "تعذّر التعرف عبر المتصفح: " + (event.error || "unknown"),
            ),
          );
        };
        rec.onend = function () {
          finish(DaftariSpeech.error("NO_SPEECH", "انتهى التسجيل دون نص"));
        };
        try {
          rec.start();
        } catch (e) {
          finish(e);
        }
        return session;
      },
      release: function () {
        if (current) current.cancel();
      },
    };
  }
  global.SpeechEngineFactory = Object.freeze({
    create: function (type) {
      if (type === "web") return webEngine();
      if (type === "vosk")
        return {
          initialize: function () {
            return global.voskEngine.prepare();
          },
          start: function (options) {
            return global.voskEngine.start(options);
          },
          release: function () {
            global.voskEngine.release();
          },
        };
      if (type === "whisper")
        return {
          initialize: function () {
            return global.whisperEngine.prepare();
          },
          start: function (options) {
            var result = global.whisperEngine.start(
              null,
              null,
              options.language,
              options.onStarted,
            );
            return {
              result: result,
              stop: function () {
                return global.whisperEngine.stop();
              },
              cancel: function () {
                global.whisperEngine.cancel();
              },
            };
          },
          release: function () {
            global.whisperEngine.release();
          },
        };
      throw DaftariSpeech.error("UNKNOWN_ENGINE", "محرك غير معروف: " + type);
    },
  });
})(window);
