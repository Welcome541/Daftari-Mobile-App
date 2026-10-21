/* Explicit action table: data-action contains a name, never JavaScript source. */
(function () {
  "use strict";
  function customer(node, model) {
    var selected = cust(node.getAttribute("data-customer"));
    if (!selected || selected.archived || !model) return;
    model.d.custId = selected.id;
    model.d.name = selected.name;
    render();
  }
  var actions = Object.freeze({
    "nav.back": function () {
      back();
    },
    "voice.start": function () {
      voiceStart();
    },
    "voice.confirm": function () {
      if (ui.voice.st !== "idle" && ui.voice.st !== "listen") voiceConfirm();
    },
    "voice.edit": function () {
      voiceToggleEdit();
    },
    "voice.clear": function () {
      SpeechService.cancel();
      ui.voice.st = "idle";
      render();
    },
    "voice.customer": function (node) {
      customer(node, ui.voice);
    },
    "record.cancel": function () {
      if (ui.rec) cancelRec();
    },
    "record.stop": function () {
      endRec();
    },
    "record.retry": function () {
      retryRec();
    },
    "record.confirm": function () {
      if (ui.rec && ui.rec.st !== "rec") recConfirm();
    },
    "record.customer": function (node) {
      customer(node, ui.rec);
    },
    "record.new-customer": function () {
      if (ui.rec) recNewCust();
    },
    "speech.paste.open": function () {
      openExtSheet();
    },
    "speech.paste.apply": function () {
      var input = document.getElementById("extTx");
      if (input && extSay(input.value)) closeSheet();
      else toastMsg(t("warn_nospeech"));
    },
    "sheet.close": function () {
      closeSheet();
    },
    "vosk.expand": function () {
      ui.voskOpen = !ui.voskOpen;
      render();
    },
    "vosk.toggle": function () {
      SpeechService.release();
      sec.vosk = !sec.vosk;
      saveSec();
      render();
    },
    "native.model.import": function () {
      return NativeActions.importModel();
    },
    "native.project.import": function () {
      projPick();
    },
  });
  function target(event) {
    var node =
      event.target && event.target.closest
        ? event.target.closest("[data-action]")
        : null;
    if (
      !node ||
      !node.closest("#app,#sheetWrap,#actionrow,#tabbar") ||
      node.disabled ||
      node.getAttribute("aria-disabled") === "true"
    )
      return null;
    return node;
  }
  function invoke(node) {
    var handler = actions[node.getAttribute("data-action")];
    if (
      typeof handler !== "function" ||
      !Object.prototype.hasOwnProperty.call(
        actions,
        node.getAttribute("data-action"),
      )
    )
      return;
    try {
      Promise.resolve(handler(node)).catch(report);
    } catch (error) {
      report(error);
    }
  }
  function report(error) {
    console.error("UI action", error);
    if (typeof toastMsg === "function") toastMsg(esc("تعذّر تنفيذ الإجراء"));
  }
  document.addEventListener("click", function (event) {
    var node = target(event);
    if (node) invoke(node);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var node = target(event);
    if (!node || /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(node.tagName))
      return;
    event.preventDefault();
    invoke(node);
  });
})();
