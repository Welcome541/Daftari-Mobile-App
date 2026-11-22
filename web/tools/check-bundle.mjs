#!/usr/bin/env node
/**
 * Daftari · bundle check
 * -------------------------------------------------------------------
 * Runs the built interface in a real DOM and exercises it:
 *
 *   - the module list loads in order and without a single error
 *   - the application boots and renders the home screen
 *   - every screen can be opened and closed again
 *   - the display scale and density actually change the document
 *   - the registry accepts a new module and a new screen
 *   - the update manager reads the manifest and refuses unsafe paths
 *   - every bundled file matches the hash in the manifest
 *   - every translation key resolves
 *
 * Usage: node web/tools/check-bundle.mjs [--dir web/dist]
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}
const DIR = path.resolve(ROOT, arg('dir', 'web/dist'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : ''));
  }
}

/** A minimal static file server for the bundle. */
function startServer(dir) {
  return new Promise((resolve) => {
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.wasm': 'application/wasm'
    };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(dir, rel || 'index.html');
      if (!file.startsWith(dir) || !existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Fill in the browser APIs jsdom does not provide. */
function prepare(window, origin) {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.scrollTo = () => {};
  window.navigator.vibrate = () => true;
  // jsdom does not implement fetch - the app uses it to read the manifest
  window.fetch = async (input) => {
    const url = new URL(String(input), origin + '/');
    const res = await fetch(url);
    return {
      ok: res.ok,
      status: res.status,
      json: async () => res.json(),
      text: async () => res.text()
    };
  };
}

/* ------------------------------------------------------------------ */
async function main() {
  if (!existsSync(path.join(DIR, 'index.html'))) {
    throw new Error('no built bundle at ' + DIR + ' - run `node web/build.mjs` first');
  }

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const message = e && e.message ? e.message : String(e);
    if (e && e.type === 'not implemented') return;      // jsdom gaps, not app bugs
    if (message.indexOf('Not implemented:') === 0) return;
    errors.push(message);
  });
  virtualConsole.on('error', (...a) => errors.push(a.map(String).join(' ')));

  const server = await startServer(DIR);
  const origin = 'http://127.0.0.1:' + server.address().port;

  const dom = await JSDOM.fromURL(origin + '/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole
  });

  const { window } = dom;
  // `const` / `let` at the top level of a classic script live in the global
  // lexical scope, not on `window` - reach them through eval.
  const g = (expr) => window.eval(expr);

  prepare(window, origin);

  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  await new Promise((r) => setTimeout(r, 500));           // let the boot settle

  console.log('\nDaftari bundle check  (' + path.relative(ROOT, DIR) + ')\n');

  /* --- 1. loading ------------------------------------------------ */
  console.log('loading');
  check('no script errors while loading', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('build stamp is present', !!window.__DF_BUILD, 'window.__DF_BUILD missing');
  check('build version is 3.x', /^3\./.test(String(window.__BUILD || '')), String(window.__BUILD));
  const moduleList = (window.__DF_BUILD.modules || []);
  check('all modules are listed', moduleList.length >= 40, String(moduleList.length));
  check('module count matches the bundle', moduleList.length === (await readdir(path.join(DIR, 'js'))).length);

  /* --- 2. boot ---------------------------------------------------- */
  console.log('\nboot');
  const db = g('db');
  check('data model is live', !!db, 'db is null');
  check('accounts were seeded', !!(db && db.accounts && db.accounts.length));
  check('home screen rendered', (window.document.getElementById('app').innerHTML || '').length > 200);
  check('bottom navigation rendered', (window.document.getElementById('tabbar').innerHTML || '').length > 50);

  /* --- 3. every screen -------------------------------------------- */
  console.log('\nscreens');
  for (const s of ['home', 'customers', 'reports', 'settings', 'trash']) {
    const before = errors.length;
    try { window.go(s, {}); } catch (e) { errors.push('go(' + s + '): ' + e.message); }
    const html = window.document.getElementById('app').innerHTML || '';
    check('screen "' + s + '" renders', html.length > 100 && errors.length === before, 'len=' + html.length);
  }
  window.go('home', {});
  check('home screen restores', (window.document.getElementById('app').innerHTML || '').length > 200);

  /* --- 4. display sizing ------------------------------------------ */
  console.log('\ndisplay sizing');
  const root = window.document.documentElement;
  const Appearance = g('Appearance');
  check('appearance module is available', !!Appearance);
  Appearance.setScale(1.3);
  check('interface scale is applied', root.style.getPropertyValue('--s') === '1.3',
    root.style.getPropertyValue('--s'));
  check('scale is persisted', /1\.3/.test(window.localStorage.getItem('dafter_v3_ui') || ''));
  Appearance.setDensity(1.1);
  check('density is applied', root.style.getPropertyValue('--density') === '1.1');
  Appearance.setScale(2);
  check('scale is clamped to the allowed range', root.style.getPropertyValue('--s') === '1.4',
    root.style.getPropertyValue('--s'));
  Appearance.setScale(0.2);
  check('scale is clamped at the lower bound', root.style.getPropertyValue('--s') === '0.85',
    root.style.getPropertyValue('--s'));
  Appearance.setScale(1);
  Appearance.setDensity(1);
  check('scale returns to the default', root.style.getPropertyValue('--s') === '1');

  /* --- 5. registry ------------------------------------------------ */
  console.log('\nregistry');
  const DaftariApp = g('DaftariApp');
  check('registry module is available', !!DaftariApp);
  const registered = DaftariApp.register({
    name: 'check-module',
    version: '1.0.0',
    init: (app) => { app.marker = 'ok'; }
  });
  check('a module can be registered', registered === true);
  check('the module ran its init', DaftariApp.marker === 'ok');
  check('the module is listed', DaftariApp.list().modules.some(m => m.name === 'check-module'));
  const tooNew = DaftariApp.register({ name: 'x', version: '1', requires: '>=99.0.0' });
  check('an incompatible module is refused', tooNew === false);
  DaftariApp.screen('check-screen', () => '<div class="pad">check</div>');
  window.go('check-screen', {});
  check('a registered screen is reachable',
    (window.document.getElementById('app').innerHTML || '').indexOf('check') >= 0);
  window.go('home', {});

  /* --- 6. update manager ------------------------------------------ */
  console.log('\nupdate manager');
  const Updater = g('Updater');
  check('update module is available', !!Updater);
  check('the manifest was read', !!Updater.manifest, 'manifest missing');
  check('the manifest is a bundle manifest',
    !!Updater.manifest && Updater.manifest.format === 'dafter-web-bundle');
  check('the manifest lists the files', !!(Updater.manifest && Updater.manifest.files));
  check('the version is reported', !!Updater.version(), Updater.version());
  check('compatibility is evaluated', Updater.compatible(Updater.manifest) === true);
  check('an unknown format is rejected',
    Updater.compatible({ format: 'something-else' }) === false);
  check('a future format version is rejected',
    Updater.compatible({ format: 'dafter-web-bundle', formatVersion: 99 }) === false);
  check('path traversal is refused', Updater.safePath('../evil') === null);
  check('absolute paths are refused', Updater.safePath('/etc/passwd') === null);
  check('normal paths survive', Updater.safePath('js/00-icons.js') === 'js/00-icons.js');
  check('version comparison works', Updater.compare('3.1.0', '3.0.9') === 1 &&
    Updater.compare('3.0.0', '3.0.0') === 0 && Updater.compare('2.9.9', '3.0.0') === -1);
  check('the update sheet renders', (() => {
    try { Updater.sheet(); } catch (e) { errors.push('Updater.sheet: ' + e.message); return false; }
    return (window.document.getElementById('sheet').innerHTML || '').length > 50;
  })());
  window.closeSheet();

  /* --- 7. manifest integrity -------------------------------------- */
  console.log('\nmanifest integrity');
  const manifest = JSON.parse(await readFile(path.join(DIR, 'version.json'), 'utf8'));
  const mismatches = [];
  for (const [rel, spec] of Object.entries(manifest.files)) {
    const buf = await readFile(path.join(DIR, rel));
    const hash = createHash('sha256').update(buf).digest('hex');
    if (hash !== spec.sha256 || buf.length !== spec.size) mismatches.push(rel);
  }
  check('every bundled file matches its manifest hash', mismatches.length === 0,
    mismatches.slice(0, 3).join(', '));
  const shipped = [];
  async function collect(dir, base) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await collect(abs, base);
      else shipped.push(path.relative(base, abs).split(path.sep).join('/'));
    }
  }
  await collect(DIR, DIR);
  const shippedList = shipped.filter(f => f !== 'version.json').sort();
  const declared = Object.keys(manifest.files).sort();
  check('the manifest covers every shipped file',
    declared.length === shippedList.length && declared.every((f, i) => f === shippedList[i]),
    declared.length + ' declared vs ' + shippedList.length + ' shipped');

  /* --- 8. translations -------------------------------------------- */
  console.log('\ntranslations');
  const t = g('t');
  const STR = g('STR');
  check('arabic strings resolve', typeof t('updT') === 'string' && t('updT').length > 0);
  check('english strings resolve', (() => {
    const saved = g('db').lang;
    g('db').lang = 'en';
    const v = t('updT');
    g('db').lang = saved;
    return v === 'Update';
  })());
  // the interface follows the device language
  const deviceLang = String(window.navigator.language || '').slice(0, 2).toLowerCase() === 'ar' ? 'ar' : 'en';
  check('the interface language follows the device', g('db').lang === deviceLang, String(g('db').lang));
  check('the document language is applied',
    window.document.documentElement.lang === g('db').lang);
  check('the text direction is applied',
    window.document.documentElement.dir === (g('db').lang === 'ar' ? 'rtl' : 'ltr'));

  // every key must resolve in both languages
  const missingEn = Object.keys(STR.ar).filter(k => !(k in STR.en));
  check('english has the same keys', missingEn.length === 0, missingEn.join(', '));
  const missingAr = Object.keys(STR.en).filter(k => !(k in STR.ar));
  check('arabic has the same keys', missingAr.length === 0, missingAr.join(', '));
  const savedLang = g('db').lang;
  g('db').lang = 'ar';
  const unresolvedAr = Object.keys(STR.ar).filter(k => t(k) === k);
  g('db').lang = savedLang;
  check('no key falls back to its own name', unresolvedAr.length === 0, unresolvedAr.join(', '));

  /* --- 9. add-ons ------------------------------------------------- */
  console.log('\nadd-ons');
  const extDir = path.join(DIR, 'extensions');
  await mkdir(extDir, { recursive: true });
  await writeFile(path.join(extDir, 'hello.js'),
    await readFile(path.join(ROOT, 'web/src/extensions/sample/hello.js')));
  await writeFile(path.join(extDir, 'manifest.json'),
    await readFile(path.join(ROOT, 'web/src/extensions/sample/manifest.json')));
  const dom2 = await JSDOM.fromURL(origin + '/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole
  });
  prepare(dom2.window, origin);
  await new Promise((r) => setTimeout(r, 800));
  const g2 = (expr) => dom2.window.eval(expr);
  const addons = g2('DaftariApp');
  check('an add-on is loaded from the manifest', addons && addons.extensions.length === 1,
    addons ? String(addons.extensions.length) : 'no registry');
  check('the add-on registered itself', !!(addons && addons.list().modules.some(m => m.name === 'hello')));
  check('the add-on screen is reachable', !!(addons && addons.screens['hello']));
  dom2.window.go('hello', {});
  check('the add-on screen renders',
    (dom2.window.document.getElementById('app').innerHTML || '').indexOf('مرحبًا') >= 0);
  dom2.window.close();
  await rm(extDir, { recursive: true, force: true });

  /* --- 10. stability ---------------------------------------------- */
  console.log('\nstability');
  check('no errors during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));

  window.close();
  server.close();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error('check failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
