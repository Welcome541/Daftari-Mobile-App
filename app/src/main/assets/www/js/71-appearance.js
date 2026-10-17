/* =====================================================================
 * Daftari · 71-appearance.js
 * ---------------------------------------------------------------------
 * Display sizing: the interface scale and the display density.
 *
 * Both are expressed as CSS custom properties on :root
 *   --s        interface scale   (0.85 - 1.40)
 *   --density  vertical rhythm   (0.88 - 1.12)
 * and every adaptive dimension in css/responsive.css is written as
 * calc(<base> * var(--s)) or calc(<base> * var(--s) * var(--density)),
 * so a change here retunes the whole app at once.
 *
 * The choice is persisted in localStorage and applied before the first
 * paint, so reopening the app keeps the user's dimensions.
 * ===================================================================== */
const UI_KEY = 'dafter_v3_ui';

const Appearance = {
  scale: 1,
  density: 1,
  scales: [
    { v: 0.9, k: 'uiScaleS' },
    { v: 1.0, k: 'uiScaleM' },
    { v: 1.15, k: 'uiScaleL' },
    { v: 1.3, k: 'uiScaleXL' }
  ],
  densities: [
    { v: 0.9, k: 'uiDensityC' },
    { v: 1.0, k: 'uiDensityN' },
    { v: 1.1, k: 'uiDensityR' }
  ],

  load: function () {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); } catch (e) { raw = null; }
    raw = raw || {};
    Appearance.scale = Appearance.clampScale(raw.scale);
    Appearance.density = Appearance.clampDensity(raw.density);
    return Appearance;
  },

  save: function () {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ scale: Appearance.scale, density: Appearance.density }));
    } catch (e) { /* storage full or unavailable - the choice is not critical */ }
  },

  clampScale: function (v) {
    v = parseFloat(v);
    if (!isFinite(v)) return 1;
    return Math.min(1.4, Math.max(0.85, Math.round(v * 100) / 100));
  },

  clampDensity: function (v) {
    v = parseFloat(v);
    if (!isFinite(v)) return 1;
    return Math.min(1.12, Math.max(0.88, Math.round(v * 100) / 100));
  },

  /* Write the scale variables onto the document root. */
  apply: function () {
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--s', String(Appearance.scale));
    root.style.setProperty('--density', String(Appearance.density));
  },

  setScale: function (v) {
    Appearance.scale = Appearance.clampScale(v);
    Appearance.save();
    Appearance.apply();
    try { render(); } catch (e) { /* not booted yet */ }
  },

  setDensity: function (v) {
    Appearance.density = Appearance.clampDensity(v);
    Appearance.save();
    Appearance.apply();
    try { render(); } catch (e) { /* not booted yet */ }
  },

  scaleLabel: function (v) {
    const hit = Appearance.scales.find(s => Math.abs(s.v - v) < 0.001);
    return hit ? t(hit.k) : Math.round(v * 100) + '%';
  },

  densityLabel: function (v) {
    const hit = Appearance.densities.find(s => Math.abs(s.v - v) < 0.001);
    return hit ? t(hit.k) : Math.round(v * 100) + '%';
  },

  /* Settings sheet: interface size + display density. */
  sheet: function () {
    const seg = (items, current, fn) =>
      '<div class="seg">' + items.map(it =>
        '<button class="' + (Math.abs(it.v - current) < 0.001 ? 'on' : '') + '" onclick="' + fn + '(' + it.v + ')">' +
        esc(Appearance.scaleLabel(it.v) === it.k ? it.k : it.k) + '</button>').join('') + '</div>';

    const scaleBtns = '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
      Appearance.scales.map(s =>
        '<button class="' + (Math.abs(s.v - Appearance.scale) < 0.001 ? 'on' : '') +
        '" onclick="Appearance.setScale(' + s.v + ')">' + esc(t(s.k)) + '</button>').join('') + '</div>';

    const densityBtns = '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
      Appearance.densities.map(s =>
        '<button class="' + (Math.abs(s.v - Appearance.density) < 0.001 ? 'on' : '') +
        '" onclick="Appearance.setDensity(' + s.v + ')">' + esc(t(s.k)) + '</button>').join('') + '</div>';

    openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">' + t('appearT') + '</h3>' +
      '<span class="sp"></span><button class="hbtn" onclick="closeSheet()">' + ic('x', 17) + '</button></div>' +
      '<div class="lb">' + t('uiScaleT') + '</div>' + scaleBtns +
      '<div class="lb">' + t('uiDensityT') + '</div>' + densityBtns +
      '<div class="muted" style="font-size:12px;margin-top:14px;line-height:1.8">' +
      esc(t('localOnly')) + '</div>');
  }
};

/* Apply the stored dimensions immediately - before the first paint. */
Appearance.load();
Appearance.apply();
