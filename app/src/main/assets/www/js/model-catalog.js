/* Native Vosk inventory. Whisper retains its own IndexedDB inventory until migration. */
(function () {
  "use strict";
  var generation = 0,
    pendingRead = null;
  async function refresh() {
    var version = ++generation;
    if (pendingRead && pendingRead.cancel) pendingRead.cancel();
    pendingRead = null;
    if (
      !window.DaftariBridge ||
      typeof window.DaftariBridge.listModels !== "function"
    )
      return;
    if (typeof curScr !== "function" || curScr().s !== "settings") return;
    var parent = document.getElementById("app");
    var card = document.getElementById("nativeModelCatalog");
    if (!card) {
      card = document.createElement("section");
      card.id = "nativeModelCatalog";
      card.className = "card";
      card.style.cssText = "margin-top:16px;padding:12px 16px;line-height:1.8";
      card.setAttribute("aria-live", "polite");
      parent.appendChild(card);
    }
    var arabic = document.documentElement.lang !== "en";
    while (card.firstChild) card.removeChild(card.firstChild);
    var title = document.createElement("b");
    title.textContent = arabic
      ? "نماذج Vosk المحفوظة"
      : "Installed Vosk models";
    card.appendChild(title);
    var body = document.createElement("div");
    body.className = "muted";
    card.appendChild(body);
    try {
      body.textContent = arabic ? "جارٍ قراءة النماذج…" : "Loading models…";
      var task = window.DaftariBridge.listModels();
      pendingRead = task;
      var models = await task;
      if (pendingRead === task) pendingRead = null;
      if (version !== generation || !card.isConnected) return;
      body.textContent = "";
      if (!models.length)
        body.textContent = arabic
          ? "لم يُستورد نموذج Vosk بعد."
          : "No Vosk model imported yet.";
      models.forEach(function (model) {
        var row = document.createElement("div");
        var size = Number(model.size);
        row.textContent =
          String(model.name || model.engine) +
          " · " +
          (Number.isFinite(size) && size >= 0
            ? (size / 1048576).toFixed(1) + " MB"
            : "—");
        body.appendChild(row);
      });
      if (models.length) {
        var note = document.createElement("div");
        note.textContent = arabic
          ? "محفوظ على الجهاز؛ جاهزية التعرف تُفحص عند تشغيل المحرك."
          : "Stored on device; recognition readiness is checked when the engine starts.";
        body.appendChild(note);
      }
    } catch (error) {
      if (version !== generation || !card.isConnected) return;
      body.textContent = arabic
        ? "تعذّرت قراءة قائمة النماذج."
        : "Could not read the model list.";
      console.error("Model catalog", error);
    }
  }
  window.addEventListener("daftari-render", refresh);
  window.addEventListener("daftari-native-event", function (event) {
    if (event.detail && event.detail.type === "modelImported") refresh();
  });
})();
