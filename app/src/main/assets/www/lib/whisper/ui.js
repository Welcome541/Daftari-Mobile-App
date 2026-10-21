/* Local Whisper integration for the dafter 2.20 UI. */
(function () {
  "use strict";
  var KEY = "dafter2.whisper.enabled";
  var enabled = function () {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  };
  var lang = function () {
    try {
      return document.documentElement.lang === "en" ||
        (typeof db !== "undefined" && db.lang === "en")
        ? "en"
        : "ar";
    } catch (e) {
      return "ar";
    }
  };
  var txt = function (ar, en) {
    return lang() === "en" ? en : ar;
  };
  function toast(s) {
    try {
      if (typeof toastMsg === "function")
        toastMsg(typeof esc === "function" ? esc(s) : s);
      else alert(s);
    } catch (e) {}
  }
  function setStatus() {
    var status = document.getElementById("whisperModelStatus"),
      toggle = document.getElementById("whisperUseBtn");
    if (status) {
      var e = window.whisperEngine;
      status.textContent =
        e && e.hasModel
          ? e.modelName + " · " + e.formatBytes(e.modelSize)
          : txt("لم يُستورد نموذج بعد", "No model imported");
    }
    if (toggle)
      toggle.textContent = enabled()
        ? txt("Whisper مفعّل للتسجيل", "Whisper selected for recording")
        : txt("استخدام Whisper للتسجيل", "Use Whisper for recording");
  }
  function inject() {
    try {
      if (typeof curScr !== "function" || curScr().s !== "settings") return;
      var app = document.getElementById("app");
      if (!app || document.getElementById("whisperSettingsCard")) return;
      var card = document.createElement("div");
      card.id = "whisperSettingsCard";
      card.className = "card";
      card.style.cssText = "margin-top:16px;padding:12px 16px";
      card.innerHTML =
        '<div style="font-weight:800;font-size:15px;margin:2px 0 8px">Whisper دون إنترنت (GGML)</div>' +
        '<div id="whisperModelStatus" class="muted" style="font-size:12px;line-height:1.8;margin-bottom:10px"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button id="whisperImportBtn" class="btn btn-soft" type="button">استيراد ggml-tiny.bin</button>' +
        '<button id="whisperUseBtn" class="btn btn-line" type="button"></button>' +
        '<button id="whisperRemoveBtn" class="btn btn-line" type="button">إزالة نموذج Whisper</button></div>' +
        '<input id="whisperModelFile" type="file" accept=".bin,application/octet-stream" style="display:none">' +
        '<div class="muted" style="font-size:11px;line-height:1.8;margin-top:8px">اختر نموذج Whisper بصيغة GGML مثل ggml-tiny.bin. يبقى الملف على هذا الهاتف؛ لا تستخدم GGUF أو ملف Vosk هنا.</div>';
      app.appendChild(card);
      card
        .querySelector("#whisperImportBtn")
        .addEventListener("click", function () {
          card.querySelector("#whisperModelFile").click();
        });
      card
        .querySelector("#whisperModelFile")
        .addEventListener("change", function (event) {
          window.importWhisperModel(event.currentTarget);
        });
      card
        .querySelector("#whisperUseBtn")
        .addEventListener("click", window.toggleWhisperMode);
      card
        .querySelector("#whisperRemoveBtn")
        .addEventListener("click", window.removeWhisperModel);
      setStatus();
    } catch (e) {
      console.error("Whisper settings UI", e);
    }
  }
  window.importWhisperModel = async function (input) {
    var f = input && input.files && input.files[0];
    if (!f) return;
    if (window.SpeechService) window.SpeechService.invalidate("whisper");
    try {
      toast(
        txt(
          "جارٍ فحص وحفظ النموذج محليًا…",
          "Checking and saving model locally…",
        ),
      );
      await window.whisperEngine.importModel(f);
      await window.whisperEngine.loadMeta();
      toast(
        txt(
          "تم استيراد النموذج. جهّز Whisper عند أول تسجيل.",
          "Model imported. Whisper will initialize on first recording.",
        ),
      );
    } catch (e) {
      toast(
        txt("فشل الاستيراد: ", "Import failed: ") + ((e && e.message) || e),
      );
    } finally {
      input.value = "";
      setStatus();
    }
  };
  window.toggleWhisperMode = function () {
    if (!window.whisperEngine || !window.whisperEngine.hasModel) {
      toast(txt("استورد ggml-tiny.bin أولًا.", "Import ggml-tiny.bin first."));
      return;
    }
    if (window.SpeechService) window.SpeechService.release();
    try {
      localStorage.setItem(KEY, enabled() ? "0" : "1");
    } catch (e) {
      toast(txt("تعذّر حفظ الإعداد.", "Could not save setting."));
      return;
    }
    setStatus();
    toast(
      enabled()
        ? txt(
            "سيُستخدم Whisper للتسجيل الصوتي.",
            "Whisper will be used for voice recording.",
          )
        : txt(
            "تم إيقاف Whisper؛ سيعمل محرك Vosk/الهاتف.",
            "Whisper disabled; Vosk/phone engine will be used.",
          ),
    );
  };
  window.removeWhisperModel = async function () {
    if (
      !confirm(
        txt(
          "إزالة نموذج Whisper المخزن من هذا الهاتف؟",
          "Remove the stored Whisper model from this phone?",
        ),
      )
    )
      return;
    if (window.SpeechService) window.SpeechService.invalidate("whisper");
    try {
      await window.whisperEngine.removeModel();
      localStorage.setItem(KEY, "0");
      toast(txt("تمت إزالة النموذج.", "Model removed."));
    } catch (e) {
      toast(
        txt("تعذّرت الإزالة: ", "Could not remove: ") + ((e && e.message) || e),
      );
    }
    setStatus();
  };
  window.addEventListener("whisper-model-change", setStatus);
  // Subscribe to render events; never replace recording/render functions.
  window.addEventListener("daftari-render", inject);
  document.addEventListener("DOMContentLoaded", inject);
  inject();
})();
