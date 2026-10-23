/* UI orchestration for native operations. RPC transport never renders or modifies forms. */
(function () {
  "use strict";
  var active = null;
  function toast(message) {
    if (typeof toastMsg === "function")
      toastMsg(
        String(message).replace(/[&<>"']/g, function (ch) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[ch];
        }),
      );
  }
  function notify(type, message) {
    window.dispatchEvent(
      new CustomEvent("daftari-native-event", {
        detail: { type: type, message: message || "" },
      }),
    );
  }
  function renderStatus() {
    var old = document.getElementById("nativeOperation");
    if (old) old.remove();
    if (!active || typeof curScr !== "function" || curScr().s !== "settings")
      return;
    var card = document.createElement("section");
    card.id = "nativeOperation";
    card.className = "card";
    card.style.cssText = "padding:12px 16px;margin-top:12px";
    var label = document.createElement("p");
    label.setAttribute("role", "status");
    label.textContent = active.message;
    card.appendChild(label);
    if (active.task.cancel) {
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-line";
      cancel.textContent = "إلغاء الانتظار";
      cancel.addEventListener("click", function () {
        if (active) active.task.cancel();
      });
      card.appendChild(cancel);
    }
    document.getElementById("app").appendChild(card);
  }
  function run(method, success) {
    if (!window.DaftariBridge) return Promise.resolve(null);
    if (active) {
      toast("انتظر اكتمال العملية الحالية");
      return Promise.resolve(null);
    }
    var operation = {
      task: null,
      message: "بانتظار اختيار الملف أو جهة الاتصال…",
    };
    operation.task = window.DaftariBridge[method]({
      onProgress: function (message) {
        if (active === operation) {
          operation.message = message;
          renderStatus();
        }
      },
    });
    active = operation;
    renderStatus();
    return operation.task
      .then(function (data) {
        if (!data.legacy && success) success(data);
        return data;
      })
      .catch(function (error) {
        toast(error.message || "تعذّر تنفيذ العملية");
        return null;
      })
      .then(function (data) {
        if (active === operation) active = null;
        renderStatus();
        return data;
      });
  }
  window.NativeActions = Object.freeze({
    importModel: function () {
      return run("pickModel", function () {
        notify("modelImported");
      });
    },
    importProject: function () {
      return run("pickProject", function () {
        notify("projectImported");
      });
    },
    pickContact: function () {
      var form = ui.nc;
      var screen = curScr();
      var account = db.active;
      return run("pickContact", function (data) {
        // Never write a late contact into a different form/account/screen.
        if (ui.nc !== form || curScr() !== screen || db.active !== account)
          return;
        form.name = data.name;
        form.phone = data.phone;
        closeSheet();
        render();
      });
    },
  });
  window.addEventListener("daftari-render", renderStatus);
  window.addEventListener("daftari-native-event", function (event) {
    var detail = event.detail || {};
    if (detail.type === "modelImported") {
      if (window.SpeechService) window.SpeechService.invalidate("vosk");
      toast(
        window.voskImpMsg
          ? window.voskImpMsg(false, true)
          : "تم استيراد نموذج Vosk",
      );
    } else if (detail.type === "projectImported")
      toast("تم حفظ المشروع دون تنفيذ كوده داخل الواجهة الموثوقة.");
    else if (["progress", "error", "cancelled"].indexOf(detail.type) !== -1)
      toast(detail.message);
  });
})();
