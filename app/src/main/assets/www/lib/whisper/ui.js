/*
 * Whisper settings card + recording hooks for the Daftari UI.
 * The card is rendered with the app's own design system (.lb / .card / .kv / .sw2)
 * and mounted in the #whisperMount slot of the settings screen.
 * The model file never leaves the device: it is copied into IndexedDB and read by wasm.
 */
(function () {
  'use strict';
  var KEY = 'dafter2.whisper.enabled';
  var session = null, initDone = false, importing = false;

  function T(key, fallback) {
    try { if (typeof t === 'function') { var v = t(key); if (v && v !== key) return v; } } catch (e) {}
    return fallback;
  }
  function toast(msg) {
    try { if (typeof toastMsg === 'function') { toastMsg(msg); return; } } catch (e) {}
    try { alert(msg); } catch (e) {}
  }
  function busy(on) {
    try { if (typeof window.busy === 'function') window.busy(on); } catch (e) {}
  }
  function enabled() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); return true; } catch (e) { return false; }
  }
  function lang() {
    try { return (document.documentElement.lang === 'en' || (typeof db !== 'undefined' && db.lang === 'en')) ? 'en' : 'ar'; }
    catch (e) { return 'ar'; }
  }
  function engine() { return window.whisperEngine || null; }

  function whisperRuntimeAvailable() {
    return !!window.crossOriginIsolated && typeof window.SharedArrayBuffer !== 'undefined';
  }

  function webViewWhisperUnsupported() {
    return !!window.Daftari && !whisperRuntimeAvailable();
  }

  function whisperUnavailableMessage() {
    if (webViewWhisperUnsupported()) return lang() === 'en'
      ? 'Whisper is not supported inside Android WebView. HTTPS cannot enable the missing SharedArrayBuffer support. Turn Whisper off and use Vosk or the phone engine.'
      : 'محرك Whisper غير مدعوم داخل WebView في تطبيق Android؛ HTTPS لا يحل نقص SharedArrayBuffer. أوقف Whisper واستخدم Vosk أو محرك الهاتف.';
    return lang() === 'en'
      ? 'Whisper requires a secure, cross-origin-isolated browser with SharedArrayBuffer. Use Vosk or the phone engine instead.'
      : 'يتطلب Whisper متصفحًا آمنًا يدعم عزل Cross-Origin وSharedArrayBuffer. استخدم Vosk أو محرك الهاتف بدلًا منه.';
  }

  function modelStatus() {
    var e = engine();
    if (!e || !e.hasModel) return { cls: '', txt: T('whNone', 'لم يُستورد نموذج بعد') };
    var name = e.modelName || '';
    var size = e.formatBytes ? e.formatBytes(e.modelSize || 0) : '';
    var ready = !!e.ready;
    return {
      cls: ready ? 'b-paid' : 'b-part',
      txt: (ready ? T('whReady', 'المحرك جاهز') : T('whIdle', 'النموذج مستورد — يُهيّأ عند أول تسجيل')) +
           (name ? ' · ' + name + (size ? ' (' + size + ')' : '') : '')
    };
  }

  function cardHtml() {
    var st = modelStatus();
    var supported = whisperRuntimeAvailable();
    var on = enabled() && supported;
    if (!supported) setEnabled(false);
    var unavailableNote = !supported
      ? '<div class="muted" role="note" style="font-size:12px;line-height:1.8;padding:0 2px 12px;color:var(--red)">' + whisperUnavailableMessage() + '</div>'
      : '';
    return '<div class="lb">' + T('whisperT', 'Whisper دون إنترنت (GGML)') + '</div>' +
      '<div class="card" id="whisperSettingsCard" style="padding:2px 16px">' +
        '<div class="kv" style="cursor:default">' +
          '<span class="kic" id="whisperIcon" aria-hidden="true" style="background:' + (on ? 'var(--green-bg)' : 'var(--line2)') + ';color:' + (on ? 'var(--green)' : 'var(--muted)') + '">' + ic('mic', 20) + '</span>' +
          '<span class="k">' + T('whModel', 'النموذج') + '</span>' +
          '<span class="v"><span id="whisperModelStatus" class="chip ' + st.cls + '">' + st.txt + '</span></span>' +
        '</div>' +
        '<div class="sep"></div>' +
        '<div class="kv" style="cursor:default">' +
          '<span class="kic" aria-hidden="true" style="background:var(--navy-bg);color:var(--navy)">' + ic('wave', 20) + '</span>' +
          '<span class="k">' + T('whUse', 'استخدام Whisper للتسجيل') + '</span>' +
          '<span class="v"><span class="kvcm" id="whisperMode">' + (on ? T('on', 'مفعّل') : T('off', 'غير مفعّل')) + '</span>' +
          '<div class="sw2 ' + (on ? 'on' : '') + '" id="whisperToggle" role="switch" tabindex="0" aria-checked="' + (on ? 'true' : 'false') + '" aria-disabled="' + (!supported ? 'true' : 'false') + '" aria-label="' + T('whUse', 'استخدام Whisper للتسجيل') + '" onclick="toggleWhisperMode()"></div></span>' +
        '</div>' +
        '<div class="sep"></div>' +
        '<div class="row" style="padding:12px 2px 6px"><span class="k" style="color:var(--muted);font-size:13.5px;font-weight:600">' + T('whFile', 'ملف النموذج (GGML)') + '</span></div>' +
        '<div class="btnrow" style="margin-top:0;margin-bottom:12px;border-bottom:none">' +
          '<button class="btn btn-soft" type="button" id="whisperImportBtn">' + ic('import', 17) + '<span>' + T('whImp', 'استيراد ggml-tiny.bin') + '</span></button>' +
          '<button class="btn btn-line" type="button" id="whisperRemoveBtn" style="color:var(--red);border-color:var(--red)">' + ic('trash', 17) + '<span>' + T('whDel', 'إزالة النموذج') + '</span></button>' +
        '</div>' +
        unavailableNote +
        '<div class="muted" style="font-size:11.5px;line-height:1.9;padding:0 2px 12px">' + T('whHint', 'اختر نموذج Whisper بصيغة GGML مثل ggml-tiny.bin (8–500 م.ب). يبقى الملف على هذا الهاتف ولا يُرسل لأي جهة. لا تستخدم GGUF ولا نموذج Vosk هنا.') + '</div>' +
        '<input id="whisperModelFile" type="file" accept=".bin,application/octet-stream" style="display:none">' +
      '</div>';
  }

  function mount() {
    try {
      if (typeof curScr !== 'function' || curScr().s !== 'settings') return;
      var slot = document.getElementById('whisperMount');
      if (!slot || !window.whisperEngine) return;
      var built = slot.getAttribute('data-built') === '1';
      if (built && document.getElementById('whisperSettingsCard')) { refresh(); return; }
      slot.innerHTML = cardHtml();
      slot.setAttribute('data-built', '1');
      var importBtn = document.getElementById('whisperImportBtn');
      var removeBtn = document.getElementById('whisperRemoveBtn');
      var fileInput = document.getElementById('whisperModelFile');
      if (importBtn) importBtn.addEventListener('click', startImport);
      if (removeBtn) removeBtn.addEventListener('click', window.removeWhisperModel);
      if (fileInput) fileInput.addEventListener('change', window.importWhisperModel);
      refresh();
    } catch (e) {
      try { console.error('Whisper settings UI', e); } catch (_) {}
    }
  }

  function refresh() {
    var st = modelStatus(), supported = whisperRuntimeAvailable(), on = enabled() && supported;
    if (!supported) setEnabled(false);
    var status = document.getElementById('whisperModelStatus');
    if (status) { status.className = 'chip ' + st.cls; status.textContent = st.txt; }
    var mode = document.getElementById('whisperMode');
    if (mode) mode.textContent = on ? T('on', 'مفعّل') : T('off', 'غير مفعّل');
    var toggle = document.getElementById('whisperToggle');
    if (toggle) {
      toggle.classList.toggle('on', on);
      toggle.setAttribute('aria-checked', on ? 'true' : 'false');
      toggle.setAttribute('aria-disabled', supported ? 'false' : 'true');
    }
    var icon = document.getElementById('whisperIcon');
    if (icon) icon.style.cssText = 'background:' + (on ? 'var(--green-bg)' : 'var(--line2)') + ';color:' + (on ? 'var(--green)' : 'var(--muted)');
  }

  /* ---------- native picker first (same path as the Vosk engine), HTML input as fallback ---------- */
  function startImport() {
    if (importing) return;
    try {
      if (window.Daftari && typeof Daftari.pickWhisper === 'function') { Daftari.pickWhisper(); return; }
    } catch (e) {}
    var input = document.getElementById('whisperModelFile');
    if (input) input.click();
  }

  window.importWhisperModel = async function (input) {
    var file = input && input.files && input.files[0];
    if (!file || importing) return;
    await importBlob(file, file.name);
    try { input.value = ''; } catch (e) {}
  };

  async function importBlob(blob, name) {
    if (importing) return false;
    importing = true; busy(true);
    toast(T('whLoad', 'جارٍ فحص النموذج وحفظه محليًا…'));
    try {
      await window.whisperEngine.importModel(new File([blob], name || 'model.bin', { type: 'application/octet-stream' }));
      await window.whisperEngine.loadMeta();
      toast(T('whSaved', 'تم استيراد النموذج ✓ — يُهيّأ عند أول تسجيل'));
      return true;
    } catch (e) {
      toast(T('whFail', 'فشل الاستيراد: ') + ((e && e.message) || e));
      return false;
    } finally {
      importing = false; busy(false); refresh();
    }
  }

  function clearNativeWhisperCopy(name) {
    try {
      if (window.Daftari && typeof Daftari.clearWhisperImport === 'function') return !!Daftari.clearWhisperImport(name);
      if (window.Daftari && typeof Daftari.clearWhisperImports === 'function') return !!Daftari.clearWhisperImports();
    } catch (e) {}
    return false;
  }

  /* Called from the Android bridge after the native picker copied a model file. */
  window.whisperImportFromPath = function (name) {
    if (!name) return;
    var nativeCopy = !/^https?:|^\//.test(name);
    if (!window.whisperEngine) {
      if (nativeCopy) clearNativeWhisperCopy(name);
      toast(T('whNoEngine', 'محرك Whisper غير محمّل')); return;
    }
    var path = nativeCopy ? 'model-ar/' + encodeURIComponent(name) : name;
    fetch(path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      return importBlob(blob, name).then(function (ok) {
        if (nativeCopy) clearNativeWhisperCopy(name);
        return ok;
      });
    }).catch(function (e) {
      if (nativeCopy) clearNativeWhisperCopy(name);
      toast(T('whFail', 'فشل الاستيراد: ') + ((e && e.message) || e));
    });
  };

  window.toggleWhisperMode = function () {
    if (!whisperRuntimeAvailable()) { setEnabled(false); refresh(); toast(whisperUnavailableMessage()); return; }
    if (!window.whisperEngine || !window.whisperEngine.hasModel) { toast(T('whNeed', 'استورد نموذج Whisper أولًا')); return; }
    if (!setEnabled(!enabled())) { toast(T('whFail', 'فشل الاستيراد: ') + 'localStorage'); return; }
    refresh();
    toast(enabled() ? T('whOn', 'Whisper مفعّل للتسجيل') : T('whOffMsg', 'تم إيقاف Whisper — سيعمل محرك الهاتف أو VOSK'));
  };

  window.removeWhisperModel = async function () {
    if (!window.whisperEngine) return;
    if (!confirm(T('whAskDel', 'إزالة نموذج Whisper المخزن من هذا الهاتف؟'))) return;
    try {
      await window.whisperEngine.removeModel();
      setEnabled(false);
      var clean = true;
      try { if (window.Daftari && Daftari.clearWhisperImports) clean = !!Daftari.clearWhisperImports(); } catch (e) { clean = false; }
      toast(T('whRemoved', 'تمت إزالة النموذج ✓') + (clean ? '' : ' — ' + T('whCleanFail', 'تعذّر حذف نسخة الاستيراد المؤقتة')));
    } catch (e) {
      toast(T('whAway', 'أوقف التسجيل قبل إزالة النموذج') + ' — ' + ((e && e.message) || e));
    }
    refresh();
  };

  window.addEventListener('whisper-model-change', function () { try { refresh(); } catch (e) {} });

  /* ---------- settings screen hook ---------- */
  var oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function () { var out = oldRender.apply(this, arguments); mount(); return out; };
  }

  /* ---------- recording hooks: hand the microphone to Whisper when enabled ---------- */
  function installRecordingHooks() {
    if (initDone || typeof window.startRec !== 'function' || typeof window.endRec !== 'function') return;
    initDone = true;
    var originalStart = window.startRec, originalEnd = window.endRec, originalCancel = window.cancelRec;
    var originalMeter = window.startMicMeter, originalTry = window.tryWebASR;

    window.startRec = function (kind, custId) {
      if (!enabled()) return originalStart.apply(this, arguments);
      if (!window.whisperEngine || !window.whisperEngine.hasModel) { toast(T('whNeed', 'استورد نموذج Whisper أولًا')); return; }
      if (session) { toast(T('whRecBusy', 'يوجد تسجيل صوتي جارٍ')); return; }
      session = { kind: kind, custId: custId || null, promise: null, ending: false };
      var oldVosk;
      try { oldVosk = sec.vosk; sec.vosk = false; } catch (e) {}
      window.startMicMeter = function () {};
      window.tryWebASR = function () { return true; };
      try { originalStart.apply(this, arguments); }
      catch (e) {
        session = null;
        window.startMicMeter = originalMeter; window.tryWebASR = originalTry;
        toast(String(e)); return;
      }
      window.startMicMeter = originalMeter; window.tryWebASR = originalTry;
      try { sec.vosk = oldVosk; } catch (e) {}
      try { if (typeof ui !== 'undefined' && ui.rec) ui.rec.whisper = true; } catch (e) {}
      var current = session;
      current.promise = window.whisperEngine.prepare().then(function () {
        return window.whisperEngine.start(kind, custId, lang());
      });
      current.promise.catch(function (e) {
        if (session !== current || current.ending) return;
        current.ending = true; session = null;
        try {
          if (typeof stopMicMeter === 'function') stopMicMeter();
          if (window.__recTick) clearInterval(window.__recTick);
          originalEnd.call(window);
        } catch (err) {}
        toast(T('whRecFail', 'تعذّر التعرف: ') + ((e && e.message) || e));
      });
    };

    window.endRec = function () {
      if (!session) return originalEnd.apply(this, arguments);
      var current = session;
      if (current.ending) return;
      current.ending = true;
      try {
        if (typeof stopMicMeter === 'function') stopMicMeter();
        if (window.__recTick) clearInterval(window.__recTick);
      } catch (e) {}
      window.whisperEngine.stop().catch(function () {});
      Promise.resolve(current.promise).then(function (text) {
        if (session !== current) return;
        session = null;
        if (typeof window.voskOnText === 'function') window.voskOnText(current.kind, text, 1);
        else { originalEnd.call(window); toast(T('whRecFail', 'تعذّر التعرف: ')); }
      }).catch(function (e) {
        if (session !== current) return;
        session = null;
        originalEnd.call(window);
        toast(T('whRecFail', 'تعذّر التعرف: ') + ((e && e.message) || e));
      });
    };

    if (typeof originalCancel === 'function') {
      window.cancelRec = function () {
        if (session) { window.whisperEngine.cancel(); session = null; }
        return originalCancel.apply(this, arguments);
      };
    }
  }

  installRecordingHooks();
  document.addEventListener('DOMContentLoaded', function () { installRecordingHooks(); mount(); });
  setTimeout(function () { installRecordingHooks(); mount(); }, 0);
  setTimeout(function () { installRecordingHooks(); mount(); }, 600);
})();
