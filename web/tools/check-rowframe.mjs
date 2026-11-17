#!/usr/bin/env node
/**
 * Daftari · operation row frame check
 * ------------------------------------------------------------------
 * The operation rows (customer balances, transaction feed) are drawn
 * on a 1080 px wide reference canvas. This tool keeps that geometry
 * honest:
 *
 *   - every measured dimension is encoded in css/tokens.css with the
 *     exact reference value
 *   - --u is published as shell width / 1080, so the frame scales with
 *     the phone shell and with the user's interface scale
 *   - the demo ledger reproduces the three rows of the reference
 *     drawing - same order, same balances, same colours, same times
 *   - the rendered rows carry the reference frame classes
 *
 * Usage: node web/tools/check-rowframe.mjs [--dir web/dist]
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { webcrypto } from 'node:crypto';
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

/**
 * The geometry measured off the reference canvas (1080 x 472).
 * Every number is a reference pixel and has a matching token.
 */
const REFERENCE = {
  'row-h':      128,   // card height
  'row-gap':    22,    // vertical gap between two cards
  'row-r':      28,    // corner radius
  'row-av':     101,   // avatar diameter
  'row-gapx':   60,    // gap between the avatar and the text
  'row-pady':   15,    // vertical padding inside the card
  'row-padx':   20,    // padding at the inline-start edge of the card
  'row-side-w': 300,   // width of the amount column
  'row-side-p': 32,    // inset of the amount from the inline-end edge
  'row-div-w':  3,     // vertical rule width
  'row-div-h':  96,    // vertical rule height
  'row-name':   44,    // name type size
  'row-meta':   30,    // meta line type size
  'row-amt':    62,    // amount type size
  'row-cur':    26,    // currency type size
  'row-ic':     41     // meta icon size
};

const REFERENCE_WIDTH = 1080;

/* --- the tokens carry the measured numbers ------------------------ */
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
      const rel = decodecodeURIComponentSafe(req.url.split('?')[0]);
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
function decodecodeURIComponentSafe(u) {
  try { return decodeURIComponent(u.replace(/^\/+/, '')); } catch (e) { return u.replace(/^\/+/, ''); }
}

/* ------------------------------------------------------------------ */
async function main() {
  if (!existsSync(path.join(DIR, 'index.html'))) {
    throw new Error('no built bundle at ' + DIR + ' - run `node web/build.mjs` first');
  }

  console.log('\nDaftari operation row frame check  (' + path.relative(ROOT, DIR) + ')\n');

  /* --- 1. the tokens encode the reference geometry ---------------- */
  console.log('reference geometry');
  const tokens = await readFile(path.join(ROOT, 'web/src/css/tokens.css'), 'utf8');
  for (const [token, value] of Object.entries(REFERENCE)) {
    const re = new RegExp('--' + token + ':\\s*calc\\(\\s*' + value + '\\s*\\*');
    check(token + ' holds the measured ' + value + ' reference px', re.test(tokens));
  }
  check('--u is derived from the reference width',
    /--u:\s*calc\(min\(100vw,\s*430px\)\s*\/\s*1080\)/.test(tokens),
    tokens.match(/--u:[^;]+;/)?.[0]);
  check('every row token follows the scale',
    Object.keys(REFERENCE).every(t => {
      const m = tokens.match(new RegExp('--' + t + ':\\s*([^;]+);'));
      return !!m && m[1].includes('var(--u)') && m[1].includes('var(--s)');
    }));

  /* --- 2. the application ---------------------------------------- */
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const message = e && e.message ? e.message : String(e);
    if (e && e.type === 'not implemented') return;
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
  const g = (expr) => window.eval(expr);

  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.scrollTo = () => {};
  window.navigator.vibrate = () => true;

  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  await new Promise((r) => setTimeout(r, 500));

  console.log('\nmeasurement');
  const root = window.document.documentElement;
  const shell = window.document.getElementById('phone');
  const u = root.style.getPropertyValue('--u');
  check('--u is published', !!u, u);
  const uValue = parseFloat(u);
  check('--u is a positive length', uValue > 0, u);
  /* jsdom runs no layout engine, so the shell measures 0 px there and
     the module falls back to the window width - exactly the fallback
     the CSS declaration uses. */
  const measured = shell && shell.clientWidth ? shell.clientWidth : (window.innerWidth || 0);
  const expected = measured / REFERENCE_WIDTH;
  check('--u equals shell width / 1080',
    Math.abs(uValue - expected) < 0.002,
    u + ' vs ' + expected);
  console.log('        shell ' + measured + ' px  ->  1 reference px = ' + uValue.toFixed(4) + ' CSS px');
  check('--s is still the interface scale', root.style.getPropertyValue('--s') === '1',
    root.style.getPropertyValue('--s'));

  /* --- 3. the demo ledger reproduces the reference rows ----------- */
  console.log('\ndemo ledger');
  try { g('applyDemo')(); } catch (e) { errors.push('applyDemo: ' + e.message); }
  /* the interface is Arabic-first - assert against the Arabic strings */
  try { g('db').lang = 'ar'; } catch (e) { /* nothing to assert yet */ }
  await new Promise((r) => setTimeout(r, 150));
  check('the demo ledger loads without an error', errors.length === 0, errors.slice(0, 2).join(' | '));

  window.go('customers', {});
  await new Promise((r) => setTimeout(r, 120));
  const html = window.document.getElementById('app').innerHTML || '';
  const rows = [...window.document.querySelectorAll('.orow')];
  check('the customer list renders operation rows', rows.length >= 3, String(rows.length));

  const names = rows.map(r => (r.querySelector('.orow-name span') || {}).textContent || '');
  check('the first row is محمد العلي', names[0] === 'محمد العلي', names.slice(0, 3).join(' | '));
  check('the second row is سارة أحمد', names[1] === 'سارة أحمد', names.slice(0, 3).join(' | '));
  check('the third row is نور الهادي', names[2] === 'نور الهادي', names.slice(0, 3).join(' | '));

  const amtOf = (i) => {
    const cell = rows[i].querySelector('.orow-amt');
    const num = cell ? cell.querySelector('.num').textContent : '';
    const cur = cell ? cell.querySelector('.cur').textContent : '';
    const cls = cell ? [...cell.classList].filter(c => c !== 'orow-amt').join(',') : '';
    return { text: (num + ' ' + cur).trim(), num, cls };
  };
  const a0 = amtOf(0), a1 = amtOf(1), a2 = amtOf(2);
  const figure = (s) => Math.abs(parseFloat(String(s).replace(/[^\d.\-]/g, '')) || 0);
  check('row 1 shows 200 in red', figure(a0.num) === 200 && a0.cls === 'red', JSON.stringify(a0));
  check('row 2 shows a 150 credit in green',
    figure(a1.num) === 150 && a1.cls === 'green' && a1.num.indexOf('\u2212') === 0, JSON.stringify(a1));
  check('row 3 shows 80 in red', figure(a2.num) === 80 && a2.cls === 'red', JSON.stringify(a2));

  const metaOf = (i) => {
    const m = rows[i].querySelector('.orow-meta');
    return m ? m.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  check('row 1 meta reads فاتورة · 5:33 ص', metaOf(0).indexOf('فاتورة') === 0 && metaOf(0).indexOf('5:33') > 0, metaOf(0));
  check('row 2 meta reads a cash payment · 1:40 ص', metaOf(1).indexOf('سداد نقدًا') === 0 && metaOf(1).indexOf('1:40') > 0, metaOf(1));
  check('row 3 meta reads فاتورة · 10:22 م', metaOf(2).indexOf('فاتورة') === 0 && metaOf(2).indexOf('10:22') > 0, metaOf(2));

  /* --- 4. the frame classes are on the row ----------------------- */
  console.log('\nframe');
  check('the row carries the frame class', rows[0].classList.contains('orow'));
  check('the row keeps the card class', rows[0].classList.contains('card'));
  check('the row has a fixed side column', !!rows[0].querySelector('.orow-side'));
  check('the avatar is sized from the frame token',
    /width:\s*var\(--row-av\)/.test(rows[0].querySelector('.av').getAttribute('style') || ''),
    rows[0].querySelector('.av').getAttribute('style'));
  check('the amount cell holds the rule and the figure',
    !!rows[0].querySelector('.orow-side .orow-amt .num') &&
    !!rows[0].querySelector('.orow-side .orow-amt .cur'));

  const css = await readFile(path.join(DIR, 'css/components.css'), 'utf8');
  check('the rule is drawn at the side column edge',
    /\.orow \.orow-side::before\{[^}]*inset-inline-start:0/.test(css));
  check('the rule uses the measured height', /height:var\(--row-div-h\)/.test(css));
  check('the list uses the measured gap', /\.list\.ops\{gap:var\(--row-gap\)\}/.test(css));
  /* responsive.css re-declares .litem after components.css, so the frame
     must out-specify it - otherwise the media queries would win. */
  check('the frame out-specifies the responsive .litem rules',
    /\.litem\.orow\{/.test(css),
    'expected .litem.orow in components.css');
  const responsive = await readFile(path.join(DIR, 'css/responsive.css'), 'utf8');
  check('responsive.css still re-declares .litem (so the guard matters)',
    /\.litem\s*\{/.test(responsive));

  /* --- 5. the money format ---------------------------------------- */
  console.log('\nmoney format');
  const fmt = g('fmt');
  check('a whole amount prints without decimals', fmt(15000) === '150', fmt(15000));
  check('a real fraction keeps its decimals', fmt(15050) === '150.50', fmt(15050));
  check('a small fraction keeps its decimals', fmt(15005) === '150.05', fmt(15005));
  check('a negative whole amount keeps its sign', fmt(-15000) === '\u2212150', fmt(-15000));
  check('a negative fraction keeps its sign', fmt(-15050) === '\u2212150.50', fmt(-15050));
  check('zero prints without decimals', fmt(0) === '0', fmt(0));

  /* --- 6. the day separator stays compact ------------------------- */
  console.log('\nfeed rhythm');
  window.go('home', {});
  await new Promise((r) => setTimeout(r, 120));
  const feedHtml = window.document.getElementById('txlist');
  const feed = feedHtml ? feedHtml.innerHTML : '';
  const seps = [...window.document.querySelectorAll('.daysep')];
  check('the feed groups its rows by day', seps.length >= 1, String(seps.length));
  check('the separator is a compact caption, not a section',
    /\.daysep\{[^}]*font-size:calc\(11\.5px/.test(css));
  check('the separator pulls into the row gap',
    /\.daysep\{[^}]*margin-block:calc\(var\(--row-gap\) \* -0\.66\)/.test(css));
  check('the first separator is not pulled up', /\.daysep-first\{margin-block-start:0\}/.test(css));
  check('the old roomy separator is gone', feed.indexOf('class="lb"') === -1);

  /* --- 7. the shop identity is one group -------------------------- */
  console.log('\nshop identity');
  const hdr = (window.document.querySelector('.hdr') || {}).innerHTML || '';
  const logoTile = window.document.querySelector('.hdr .logo-ic');
  check('the header shows the store icon',
    !!logoTile && !!logoTile.querySelector('svg.ic'),
    logoTile ? logoTile.innerHTML.slice(0, 60) : 'no tile');
  check('the shop name appears once in the header',
    (hdr.split('بقالة الندى').length - 1) === 1, String(hdr.split('بقالة الندى').length - 1));
  check('the header no longer repeats the account chip', hdr.indexOf('accchip') === -1);
  check('the header still opens the account sheet', hdr.indexOf('openAccSheet()') > -1);
  /* one group on the leading edge: icon, name and arrow together */
  const group = window.document.querySelector('.hdr .accid');
  check('the header has one identity group', !!group);
  check('the store icon is inside the group', !!(group && group.querySelector('.logo-ic')));
  check('the shop name is inside the group', !!(group && group.querySelector('h1')));
  check('the switch arrow is inside the group', !!(group && group.querySelector('.accchev')));
  /* the header holds two things only: the shop identity on the
     leading edge and the notification bell on the trailing one */
  const hdrEl = group && group.parentElement;
  const hdrKids = hdrEl ? [...hdrEl.children] : [];
  check('the header holds the identity group and the bell only',
    hdrKids.length === 2 && hdrKids[0] === group, String(hdrKids.length));
  check('the group is reachable from the keyboard',
    !!group && group.getAttribute('tabindex') === '0' && group.getAttribute('role') === 'button');

  /* --- 8. the notification bell ------------------------------------ */
  console.log('\nnotification bell');
  const bell = window.document.querySelector('.hdr .notif');
  check('the header carries the notification bell', !!bell);
  check('the bell sits on the trailing edge (upper left)',
    !!bell && bell.parentElement.lastElementChild === bell);
  check('the bell is a round navy button',
    !!bell && /\.notif\{[^}]*border-radius:50%/.test(css) && /\.notif\{[^}]*background:var\(--navy\)/.test(css));
  check('the bell holds the filled bell glyph',
    !!bell && !!bell.querySelector('svg.ic') && !!bell.querySelector('svg path[fill="currentColor"]'));
  check('the bell opens the alerts sheet',
    !!bell && (bell.getAttribute('onclick') || '').indexOf('openNotifSheet()') > -1);
  check('the bell carries an accessible name',
    !!bell && !!(bell.getAttribute('aria-label') || '').trim());
  const dueCount = g('notifCount()');
  const badge = bell ? bell.querySelector('.notif-badge .num') : null;
  check('the badge counts the customers who owe money',
    dueCount > 0 && !!badge && badge.textContent.trim() === String(dueCount),
    'due=' + dueCount + ' badge=' + (badge ? badge.textContent : 'none'));
  check('the badge is red',
    /\.notif-badge\{[^}]*background:var\(--red\)/.test(css));

  /* --- 9. the customers screen carries the big name --------------- */
  console.log('\ncustomers header');
  window.go('customers', {});
  await new Promise((r) => setTimeout(r, 120));
  const chdr = window.document.querySelector('#app .hdr') || window.document.querySelector('.hdr');
  const chdrHtml = chdr ? chdr.innerHTML : '';
  check('the customers header has no store icon',
    !!chdr && !chdr.querySelector('.accchip') && !chdr.querySelector('.logo-ic'),
    chdrHtml.slice(0, 90));
  check('the customers header has no centred screen title',
    !!chdr && chdrHtml.indexOf('العملاء') === -1,
    chdrHtml.slice(0, 90));
  const bigName = chdr ? chdr.querySelector('h1.bighdr') : null;
  check('the customer name stands very large',
    !!bigName && /\.hdr h1\.bighdr\{[^}]*font-size:calc\(30px/.test(css),
    bigName ? bigName.textContent : 'no big title');
  check('the big title holds the customer name',
    !!bigName && bigName.textContent.trim() === 'بقالة الندى',
    bigName ? bigName.textContent : 'none');
  check('the big title sits on the leading edge',
    !!bigName && bigName.parentElement.classList.contains('sp'));
  check('the customers screen carries the bell',
    !!chdr && !!chdr.querySelector('.notif'));

  /* --- 10. the filter is a three-dot icon ------------------------ */
  console.log('\ncustomers filter');
  const fb = window.document.getElementById('cfbtn');
  check('the filter button exists', !!fb);
  const dots = fb ? fb.querySelectorAll('svg circle') : [];
  check('the filter is the three-dot icon',
    dots.length === 3 && [...dots].every(c => c.getAttribute('fill') === 'currentColor'),
    'dots=' + dots.length);
  check('the filter button shows no text',
    !!fb && fb.textContent.trim() === '', fb ? fb.textContent.trim() : 'none');
  check('the filter button keeps an accessible name',
    !!fb && !!(fb.getAttribute('aria-label') || '').trim());
  check('the filter still opens the filter sheet',
    !!fb && (fb.getAttribute('onclick') || '').indexOf('openCustFilter()') > -1);
  check('the filter button is a square icon button',
    !!fb && /width:46px/.test(fb.getAttribute('style') || ''),
    fb ? fb.getAttribute('style') : 'none');
  check('the filter badge has a positioned parent',
    !!fb && /position:relative/.test(fb.getAttribute('style') || ''),
    fb ? fb.getAttribute('style') : 'none');

  /* --- 11. the bell rides on every main screen ------------------- */
  console.log('\nmain screens');
  for (const screen of ['home', 'customers', 'reports', 'settings']) {
    window.go(screen, {});
    await new Promise((r) => setTimeout(r, 120));
    const h = window.document.querySelector('#app .hdr');
    const b = h ? h.querySelector('.notif') : null;
    check('the ' + screen + ' screen carries the bell in the trailing corner',
      !!b && b.parentElement.lastElementChild === b);
  }

  /* --- 12. the frame scales with the interface scale --------------- */
  console.log('\nscaling');
  const Appearance = g('Appearance');
  Appearance.setScale(1.4);
  await new Promise((r) => setTimeout(r, 80));
  check('the scale reaches the document', root.style.getPropertyValue('--s') === '1.4');
  Appearance.setScale(1);

  check('no script errors during the frame check', errors.length === 0, errors.slice(0, 3).join(' | '));

  window.close();
  server.close();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
