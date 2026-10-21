/* Application-facing speech service; engine implementations know nothing about ledger/UI. */
(function () {
  "use strict";
  var controller = new DaftariSpeech.Controller(SpeechEngineFactory, function (
    state,
  ) {
    window.dispatchEvent(
      new CustomEvent("daftari-speech-state", { detail: state }),
    );
  });
  function selected() {
    try {
      if (localStorage.getItem("dafter2.whisper.enabled") === "1")
        return "whisper";
    } catch (_) {}
    return typeof sec !== "undefined" && sec.vosk ? "vosk" : "web";
  }
  window.SpeechService = Object.freeze({
    listen: function (options) {
      return controller.start(selected(), options);
    },
    stop: function () {
      controller.stop();
    },
    cancel: function () {
      controller.cancel();
    },
    release: function () {
      controller.release();
    },
    invalidate: function (engine) {
      controller.invalidate(engine);
    },
    get busy() {
      return !!controller.job;
    },
    get state() {
      return controller.state;
    },
    get selected() {
      return selected();
    },
  });
  function background() {
    controller.release();
    window.dispatchEvent(new CustomEvent("daftari-speech-background"));
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) background();
  });
  window.addEventListener("daftari-background", background);
  window.addEventListener("pagehide", background);
})();
