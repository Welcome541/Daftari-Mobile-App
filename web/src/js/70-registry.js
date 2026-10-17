/* =====================================================================
 * Daftari · 70-registry.js
 * ---------------------------------------------------------------------
 * Extension + module registry.
 *
 * This is the forward-compatibility seam of the app. A future release can
 * ship a new feature as a self-contained file in extensions/ without
 * touching a single core module: it registers itself here and the router
 * picks it up.
 *
 * Public surface (window.DaftariApp):
 *   register(def)        register a feature module
 *   screen(id, fn, meta) register a screen
 *   action(id, fn, meta) register a named action
 *   loadExtensions()     load extensions listed in extensions/manifest.json
 *   list()               describe everything registered so far
 * ===================================================================== */
const DaftariApp = window.DaftariApp || (window.DaftariApp = {});

DaftariApp.version = window.__DF_BUILD && window.__DF_BUILD.version || '0.0.0';
DaftariApp.modules = Object.create(null);
DaftariApp.screens = Object.create(null);
DaftariApp.actions = Object.create(null);
DaftariApp.extensions = [];
DaftariApp._errors = [];

/* Register a feature module.
 *   def = {name, version, requires?, init?}
 * `requires` is a semver-ish string (">=1.0.0"); the module is skipped when
 * the running app is too old, so an add-on can never break a core release. */
DaftariApp.register = function (def) {
  if (!def || !def.name) { DaftariApp._errors.push('register:missing-name'); return false; }
  if (DaftariApp.modules[def.name]) return true;                 // idempotent
  if (def.requires && !DaftariApp.satisfies(def.requires)) {
    DaftariApp._errors.push('register:unsatisfied:' + def.name);
    return false;
  }
  DaftariApp.modules[def.name] = {
    name: def.name,
    version: def.version || '0.0.0',
    requires: def.requires || null,
    state: 'registered'
  };
  try {
    if (typeof def.init === 'function') def.init(DaftariApp);
    DaftariApp.modules[def.name].state = 'ready';
  } catch (e) {
    DaftariApp.modules[def.name].state = 'failed';
    DaftariApp._errors.push('register:init:' + def.name + ':' + (e && e.message));
    return false;
  }
  return true;
};

/* Register a screen. The router resolves screens through the registry, so a
 * registered screen is reachable with go('<id>') immediately. */
DaftariApp.screen = function (id, render, meta) {
  if (!id || typeof render !== 'function') return false;
  DaftariApp.screens[id] = render;
  try { if (typeof SCREENS === 'object') SCREENS[id] = render; } catch (e) { /* not ready yet */ }
  (DaftariApp._screenMeta = DaftariApp._screenMeta || {})[id] = meta || {};
  return true;
};

/* Register a named action (quick actions, command palette, future automations). */
DaftariApp.action = function (id, fn, meta) {
  if (!id || typeof fn !== 'function') return false;
  DaftariApp.actions[id] = { run: fn, meta: meta || {} };
  return true;
};

/* Minimal semver comparison: ">=1.2.0", ">1.0.0", "1.2.0" */
DaftariApp.satisfies = function (range) {
  const cur = String(DaftariApp.version).split('.').map(n => parseInt(n, 10) || 0);
  const m = String(range).match(/^(>=|>|<=|<|=)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return true;
  const want = [parseInt(m[2], 10) || 0, parseInt(m[3], 10) || 0, parseInt(m[4], 10) || 0];
  const cmp = cur[0] - want[0] || cur[1] - want[1] || cur[2] - want[2];
  switch (m[1]) {
    case '>=': return cmp >= 0;
    case '>': return cmp > 0;
    case '<=': return cmp <= 0;
    case '<': return cmp < 0;
    default: return cmp === 0;
  }
};

/* Load the add-ons declared in extensions/manifest.json.
 * The manifest is a plain JSON file:  {"extensions":[{"file":"x.js","name":"x","version":"1.0.0"}]}
 * A missing manifest simply means "no add-ons installed". */
DaftariApp.loadExtensions = async function (base) {
  const root = base || 'extensions/';
  let list = [];
  try {
    const res = await fetch(root + 'manifest.json', { cache: 'no-store' });
    if (!res.ok) return { loaded: [], failed: [] };
    const data = await res.json();
    list = (data && data.extensions) || [];
  } catch (e) {
    return { loaded: [], failed: [] };
  }
  const loaded = [], failed = [];
  for (const entry of list) {
    const file = entry && entry.file;
    if (!file) continue;
    try {
      await DaftariApp.loadScript(root + file);
      DaftariApp.extensions.push({ name: entry.name || file, version: entry.version || '0.0.0', file: file });
      loaded.push(file);
    } catch (e) {
      failed.push(file);
      DaftariApp._errors.push('ext:' + file + ':' + (e && e.message));
    }
  }
  return { loaded: loaded, failed: failed };
};

DaftariApp.loadScript = function (src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;                       // keep execution order deterministic
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error('load:' + src));
    document.head.appendChild(s);
  });
};

DaftariApp.list = function () {
  return {
    version: DaftariApp.version,
    modules: Object.keys(DaftariApp.modules).map(k => DaftariApp.modules[k]),
    screens: Object.keys(DaftariApp.screens),
    actions: Object.keys(DaftariApp.actions),
    extensions: DaftariApp.extensions.slice(),
    errors: DaftariApp._errors.slice()
  };
};

/* Human readable summary used by the settings screen. */
DaftariApp.summaryHtml = function () {
  const mods = Object.keys(DaftariApp.modules);
  const exts = DaftariApp.extensions.length;
  const rows = [];
  rows.push('<div class="kv"><span class="k">' + t('modT') + '</span><span class="v">' +
    (mods.length + exts) + ' ' + t('modLoaded') + '</span></div>');
  if (DaftariApp._errors.length) {
    rows.push('<div class="kv"><span class="k">' + t('modFailed') + '</span><span class="v" style="color:var(--red)">' +
      DaftariApp._errors.length + '</span></div>');
  }
  return rows.join('');
};

/* Add-ons sheet: what is registered, and any load failures. */
DaftariApp.sheet = function () {
  const list = DaftariApp.list();
  let body = '<div class="muted" style="font-size:12px;line-height:1.8;margin-bottom:10px">' +
    esc(t('extensD')) + '</div>';
  body += '<div class="card" style="padding:4px 14px">';
  body += '<div class="kv"><span class="k">' + t('ver') + '</span><span class="v num">' +
    esc(list.version) + '</span></div>';
  body += '<div class="kv"><span class="k">' + t('modT') + '</span><span class="v num">' +
    (list.modules.length + list.extensions.length) + '</span></div>';
  for (const m of list.modules) {
    body += '<div class="kv"><span class="k">' + esc(m.name) + '</span><span class="v num">' +
      esc(m.version) + '</span></div>';
  }
  for (const e of list.extensions) {
    body += '<div class="kv"><span class="k">' + esc(e.name) + '</span><span class="v num">' +
      esc(e.version) + '</span></div>';
  }
  if (list.errors.length) {
    for (const err of list.errors) {
      body += '<div class="kv"><span class="k" style="color:var(--red)">' + t('modFailed') +
        '</span><span class="v" style="color:var(--red);font-size:11px">' + esc(err) + '</span></div>';
    }
  }
  body += '</div>';
  openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">' + t('extensT') + '</h3>' +
    '<span class="sp"></span><button class="hbtn" onclick="closeSheet()">' + ic('x', 17) + '</button></div>' +
    body);
};
