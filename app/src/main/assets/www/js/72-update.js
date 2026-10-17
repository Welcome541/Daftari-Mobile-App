/* =====================================================================
 * Daftari · 72-update.js
 * ---------------------------------------------------------------------
 * Update manager.
 *
 * The interface bundle is a versioned, self-describing artefact:
 *
 *   version.json   {format, formatVersion, version, build, channel,
 *                   generatedAt, minAppVersion, files:{path:{sha256,size}}}
 *
 * Two delivery channels are supported, and both are offline-first:
 *
 *   1. PACKAGE  - a .zip produced by `npm run pack` (web/tools/pack-update.mjs)
 *                 containing version.json + the full web root. The Android
 *                 side unpacks it into filesDir/webroot, verifies every
 *                 file against the manifest, and swaps it in atomically.
 *                 The previous bundle is kept so a failed boot rolls back.
 *
 *   2. REMOTE   - a version.json reachable over http(s). When the origin
 *                 publishes a newer bundle the app detects it and offers a
 *                 reload, which is the normal web delivery model.
 *
 * Integrity is enforced twice: here (browser side, before anything is
 * installed) and again in the native installer (device side, before the
 * overlay is activated).
 * ===================================================================== */
const UPDATE_KEY = 'dafter_v3_update';

const Updater = {
  state: 'idle',              // idle|checking|available|verifying|installing|ready|applied|error
  manifest: null,             // manifest of the running bundle
  remote: null,               // manifest of an available update
  native: null,               // native bridge (Android) or null on the web
  lastError: null,
  pending: null,              // verified package waiting for activation
  _listeners: [],

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */
  init: async function () {
    Updater.native = (window.DaftariUpdate && typeof window.DaftariUpdate.version === 'function')
      ? window.DaftariUpdate : null;
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      if (res.ok) Updater.manifest = await res.json();
    } catch (e) { /* the bundled app may run without a manifest */ }
    try {
      const raw = localStorage.getItem(UPDATE_KEY);
      if (raw) Updater.pending = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    Updater.emit();
    return Updater;
  },

  on: function (fn) { Updater._listeners.push(fn); return fn; },

  emit: function () {
    for (const fn of Updater._listeners) { try { fn(Updater.state, Updater); } catch (e) { /* listener error */ } }
  },

  setState: function (state, err) {
    Updater.state = state;
    if (err) Updater.lastError = err;
    Updater.emit();
  },

  /* ------------------------------------------------------------------ */
  /* information                                                        */
  /* ------------------------------------------------------------------ */
  version: function () {
    return (Updater.manifest && Updater.manifest.version)
        || (window.__BUILD || '0.0.0');
  },

  build: function () {
    return (Updater.manifest && Updater.manifest.build) || 0;
  },

  /* Compare two dotted version strings. Returns -1 / 0 / 1. */
  compare: function (a, b) {
    const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d < 0 ? -1 : 1;
    }
    return 0;
  },

  /* Is a manifest compatible with the running app? */
  compatible: function (manifest) {
    if (!manifest) return false;
    if (manifest.format !== 'dafter-web-bundle') return false;
    if (manifest.formatVersion && manifest.formatVersion > 1) return false;
    const min = manifest.minAppVersion;
    if (min && !DaftariApp.satisfies('>=' + min)) return false;
    return true;
  },

  /* ------------------------------------------------------------------ */
  /* channel 1: remote manifest                                          */
  /* ------------------------------------------------------------------ */
  checkRemote: async function (url) {
    if (!url) { Updater.setState('error', 'no-url'); return null; }
    Updater.setState('checking');
    try {
      const base = url.replace(/\/+$/, '');
      const res = await fetch(base + '/version.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const manifest = await res.json();
      if (!Updater.compatible(manifest)) {
        Updater.setState('error', 'incompatible');
        return null;
      }
      if (Updater.compare(manifest.version, Updater.version()) <= 0) {
        Updater.remote = null;
        Updater.setState('idle');
        return null;
      }
      Updater.remote = Object.assign({ url: base }, manifest);
      Updater.setState('available');
      return Updater.remote;
    } catch (e) {
      Updater.setState('error', (e && e.message) || 'check-failed');
      return null;
    }
  },

  /* ------------------------------------------------------------------ */
  /* channel 2: side-loaded package                                      */
  /* ------------------------------------------------------------------ */

  /* Minimal ZIP reader: reads the central directory and inflates entries
   * with the platform DecompressionStream. No third-party dependency, and
   * every path is validated before it is used. */
  readZip: async function (file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let eocd = -1;
    const floor = Math.max(0, buf.length - 65558);
    for (let i = buf.length - 22; i >= floor; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip:no-eocd');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (off + 46 > buf.length || dv.getUint32(off, true) !== 0x02014b50) throw new Error('zip:bad-dir');
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const usize = dv.getUint32(off + 24, true);
      const nlen = dv.getUint16(off + 28, true);
      const elen = dv.getUint16(off + 30, true);
      const clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nlen));
      entries.push({ name: name, method: method, csize: csize, usize: usize, lho: lho });
      off += 46 + nlen + elen + clen;
    }
    return {
      buf: buf,
      dv: dv,
      entries: entries,
      read: async function (entry) {
        const nlen = dv.getUint16(entry.lho + 26, true);
        const elen = dv.getUint16(entry.lho + 28, true);
        const start = entry.lho + 30 + nlen + elen;
        const raw = buf.subarray(start, start + entry.csize);
        if (entry.method === 0) return raw.slice();
        if (entry.method === 8) {
          if (typeof DecompressionStream === 'undefined') throw new Error('zip:no-inflate');
          const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        throw new Error('zip:method-' + entry.method);
      }
    };
  },

  /* Reject absolute paths, drive letters and traversal - a package must
   * only ever contain files below the bundle root. */
  safePath: function (name) {
    const n = String(name || '').replace(/\\/g, '/');
    if (!n || n.charAt(0) === '/' || /^[a-zA-Z]:/.test(n)) return null;
    if (n.indexOf('\0') >= 0) return null;
    const parts = n.split('/');
    const out = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') return null;
      out.push(p);
    }
    return out.length ? out.join('/') : null;
  },

  sha256: async function (bytes) {
    if (!(crypto && crypto.subtle)) throw new Error('no-crypto');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /* Verify a package: read version.json, check compatibility, then hash
   * every declared file and compare it with the manifest. */
  verifyPackage: async function (file) {
    Updater.setState('verifying');
    try {
      const zip = await Updater.readZip(file);
      const byName = new Map();
      for (const e of zip.entries) {
        const p = Updater.safePath(e.name);
        if (p) byName.set(p, e);
      }
      const manifestEntry = byName.get('version.json');
      if (!manifestEntry) throw new Error('no-manifest');
      const manifest = JSON.parse(new TextDecoder().decode(await zip.read(manifestEntry)));
      if (!Updater.compatible(manifest)) throw new Error('incompatible');

      const files = manifest.files || {};
      const names = Object.keys(files);
      const bad = [];
      let total = 0;
      for (const name of names) {
        const entry = byName.get(name);
        if (!entry) { bad.push(name + ':missing'); continue; }
        const bytes = await zip.read(entry);
        total += bytes.length;
        if (total > 64 * 1024 * 1024) throw new Error('too-large');
        const hash = await Updater.sha256(bytes);
        const want = files[name].sha256;
        if (want && hash !== want) bad.push(name + ':hash');
        else if (!want) bad.push(name + ':no-hash');
      }
      // every file in the archive must be declared in the manifest
      const extra = [];
      for (const name of byName.keys()) {
        if (name !== 'version.json' && !files[name]) extra.push(name);
      }
      if (bad.length || extra.length) {
        const err = 'integrity:' + bad.concat(extra).slice(0, 4).join(',');
        Updater.setState('error', err);
        return { ok: false, manifest: manifest, error: err };
      }
      return { ok: true, manifest: manifest, files: files, zip: zip };
    } catch (e) {
      const err = (e && e.message) || 'verify-failed';
      Updater.setState('error', err);
      return { ok: false, error: err };
    }
  },

  /* ------------------------------------------------------------------ */
  /* native (Android) installation                                       */
  /* ------------------------------------------------------------------ */
  canInstall: function () {
    return !!(Updater.native && typeof Updater.native.pickUpdate === 'function');
  },

  /* Ask the Android side to pick a package, verify it and stage it.
   * The picker is asynchronous, so the native side answers through
   * window.__dafterUpdateResult once the user has chosen a file. */
  installPackage: function () {
    if (!Updater.canInstall()) { Updater.setState('error', 'no-native'); return Promise.resolve(false); }
    Updater.setState('installing');
    return new Promise(resolve => {
      const previous = window.__dafterUpdateResult;
      const finish = (json) => {
        window.__dafterUpdateResult = previous;
        let res = null;
        try { res = (typeof json === 'string') ? JSON.parse(json) : json; } catch (e) { res = null; }
        if (!res || !res.ok) {
          Updater.setState(res && res.cancelled ? 'idle' : 'error', res && res.error);
          resolve(false);
          return;
        }
        Updater.pending = res;
        try { localStorage.setItem(UPDATE_KEY, JSON.stringify(res)); } catch (e) { /* ignore */ }
        Updater.setState('ready');
        resolve(true);
      };
      window.__dafterUpdateResult = finish;
      try {
        Updater.native.pickUpdate();
      } catch (e) {
        finish({ ok: false, error: (e && e.message) || 'install-failed' });
      }
    });
  },

  /* Switch the staged bundle on and restart the interface. */
  activate: function () {
    if (!Updater.canInstall() || typeof Updater.native.activate !== 'function') {
      Updater.setState('error', 'no-native');
      return false;
    }
    try {
      const res = Updater.parseResult(Updater.native.activate());
      if (!res || !res.ok) { Updater.setState('error', (res && res.error) || 'activate-failed'); return false; }
      Updater.setState('applied');
      try { localStorage.removeItem(UPDATE_KEY); } catch (e) { /* ignore */ }
      if (typeof Updater.native.reload === 'function') Updater.native.reload();
      return true;
    } catch (e) {
      Updater.setState('error', (e && e.message) || 'activate-failed');
      return false;
    }
  },

  /* Restore the previous bundle. */
  rollback: function () {
    if (!Updater.canInstall() || typeof Updater.native.rollback !== 'function') {
      Updater.setState('error', 'no-native');
      return false;
    }
    try {
      const res = Updater.parseResult(Updater.native.rollback());
      if (!res || !res.ok) { Updater.setState('error', (res && res.error) || 'rollback-failed'); return false; }
      try { localStorage.removeItem(UPDATE_KEY); } catch (e) { /* ignore */ }
      Updater.setState('applied');
      if (typeof Updater.native.reload === 'function') Updater.native.reload();
      return true;
    } catch (e) {
      Updater.setState('error', (e && e.message) || 'rollback-failed');
      return false;
    }
  },

  /* The native bridge answers with a JSON string. */
  parseResult: function (raw) {
    if (raw && typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw)); } catch (e) { return null; }
  },

  /* ------------------------------------------------------------------ */
  /* settings UI                                                        */
  /* ------------------------------------------------------------------ */
  sheet: function () {
    const v = Updater.version();
    const installed = Updater.native && typeof Updater.native.installedVersion === 'function'
      ? null : null;
    let body = '';

    body += '<div class="kv"><span class="k">' + t('ver') + '</span><span class="v num">' + esc(v) + '</span></div>';
    if (Updater.manifest && Updater.manifest.build) {
      body += '<div class="kv"><span class="k">' + t('updBundle') + '</span><span class="v num">' +
        esc('#' + Updater.manifest.build) + '</span></div>';
    }
    if (Updater.manifest && Updater.manifest.channel) {
      body += '<div class="kv"><span class="k">' + t('updSource') + '</span><span class="v">' +
        esc(Updater.manifest.channel) + '</span></div>';
    }

    if (Updater.state === 'available' && Updater.remote) {
      body += '<div class="sep"></div><div class="kv"><span class="k">' + t('updAvailable') + '</span>' +
        '<span class="v num">' + esc(Updater.remote.version) + '</span></div>' +
        '<button class="btn btn-navy" style="width:100%;margin-top:12px" onclick="Updater.reloadRemote()">' +
        ic('down', 17) + ' ' + t('updInstall') + '</button>';
    } else if (Updater.state === 'ready' && Updater.pending) {
      body += '<div class="sep"></div><div class="kv"><span class="k">' + t('updAvailable') + '</span>' +
        '<span class="v num">' + esc((Updater.pending.version) || '') + '</span></div>' +
        '<button class="btn btn-navy" style="width:100%;margin-top:12px" onclick="Updater.activate()">' +
        ic('down', 17) + ' ' + t('updInstall') + '</button>' +
        '<div class="muted" style="text-align:center;font-size:11.5px;margin-top:8px">' + t('updNeedReload') + '</div>';
    } else if (Updater.state === 'error') {
      body += '<div class="sep"></div><div class="kv"><span class="k">' + t('updFailed') + '</span>' +
        '<span class="v" style="color:var(--red)">' + esc(Updater.lastError || '') + '</span></div>';
    } else {
      body += '<div class="sep"></div><div class="kv"><span class="k">' + t('updCheck') + '</span>' +
        '<span class="v">' + t('updUpToDate') + '</span></div>';
    }

    body += '<div class="sep"></div>';
    if (Updater.canInstall()) {
      body += '<button class="btn btn-line" style="width:100%" onclick="Updater.installPackage()">' +
        ic('up', 17) + ' ' + t('updFromFile') + '</button>';
      body += '<button class="btn btn-line" style="width:100%;margin-top:10px" onclick="Updater.rollback()">' +
        ic('undo', 17) + ' ' + t('updRollback') + '</button>';
      body += '<div class="muted" style="text-align:center;font-size:11.5px;margin-top:10px;line-height:1.8">' +
        t('updOfflineNote') + '</div>';
    } else {
      body += '<div class="muted" style="text-align:center;font-size:11.5px;line-height:1.8">' +
        t('updNoNative') + '</div>';
    }

    openSheet('<div class="row" style="margin-bottom:12px"><h3 style="margin:0">' + t('updT') + '</h3>' +
      '<span class="sp"></span><button class="hbtn" onclick="closeSheet()">' + ic('x', 17) + '</button></div>' +
      '<div class="card" style="padding:4px 14px">' + body + '</div>');
  },

  /* Reload the interface so the newly published bundle is picked up. */
  reloadRemote: function () {
    if (Updater.remote && Updater.remote.url) {
      try { sessionStorage.setItem('dafter_v3_update_url', Updater.remote.url); } catch (e) { /* ignore */ }
    }
    location.reload();
  }
};

/* ---------------------------------------------------------------------
 * Bootstrap: read the bundle manifest and load optional add-ons.
 * Both are non-blocking - the interface is already usable at this point.
 * ------------------------------------------------------------------- */
try { Updater.init(); } catch (e) { /* the manifest is optional */ }
try { DaftariApp.loadExtensions(); } catch (e) { /* add-ons are optional */ }
