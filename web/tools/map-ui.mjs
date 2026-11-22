#!/usr/bin/env node
/**
 * Daftari · UI map extractor
 * -------------------------------------------------------------------
 * Drives the built interface inside a real DOM and presses every
 * control it can find, recording what actually appears:
 *
 *   - a bottom sheet          (openSheet -> #sheetWrap.open)
 *   - another screen          (the navigation stack moved)
 *   - a toast                 (#toast.show)
 *   - a confirmation          (window.confirm)
 *   - or a state change       (an inline toggle)
 *
 * Presses come in two flavours and both are recorded: a normal click
 * (onclick) and a long press (onpointerdown), which this application
 * uses to open the step-by-step wizard.
 *
 * The output is one JSON tree per tab. It is the single source of
 * truth for the screen maps in docs/maps - nothing there is typed by
 * hand, it is what the application really does.
 *
 * Usage:
 *   node web/tools/map-ui.mjs [--dir web/dist] [--out web/scratch/ui-map.json]
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const OUT = path.resolve(ROOT, arg('out', 'web/scratch/ui-map.json'));

const TABS = [
  { id: 'home', title: 'الرئيسية', icon: 'home', blurb: 'شاشة البداية: بطاقتا اليوم، البحث والفلترة، آخر العمليات، وأزرار الدين والسداد' },
  { id: 'customers', title: 'العملاء', icon: 'users', blurb: 'قائمة العملاء: البحث، فلترة العميل، سِجل الحركات، والأرشفة' },
  { id: 'reports', title: 'التقارير', icon: 'pie', blurb: 'التقارير والإحصاءات: الفترة، العميل، الرسم البياني، والطباعة' },
  { id: 'settings', title: 'الإعدادات', icon: 'gear', blurb: 'الإعدادات: الحساب والعملة، المظهر، الأمان، البيانات، والتحديث' }
];

const SCREEN_TITLES = {
  home: 'الرئيسية', customers: 'العملاء', reports: 'تقرير مخصص', settings: 'الإعدادات',
  profile: 'حساب العميل', invoice: 'الفاتورة', voice: 'تسجيل صوتي', rec: 'التعرّف على الصوت',
  wiz: 'معالج خطوة بخطوة', repb: 'تقرير مخصص', newcust: 'عميل جديد', trash: 'سلّة المحذوفات',
  lock: 'قفل الشاشة'
};

/** Arabic names for the icons, so an icon-only button still reads well */
const ICON_LABEL = {
  mic: 'الميكروفون', user: 'العميل', users: 'العملاء', userplus: 'عميل جديد', wallet: 'المحفظة',
  cal: 'التاريخ', clock: 'الوقت', phone: 'الاتصال', cam: 'الكاميرا', sun: 'نهاري', search: 'البحث',
  sliders: 'الفلترة', back: 'رجوع', fwd: 'التالي', plus: 'إضافة', check: 'تأكيد', checkc: 'تحديد',
  shield: 'الأمان', lock: 'القفل', unlock: 'فتح القفل', trash: 'حذف', edit: 'تعديل', archive: 'أرشفة',
  dots: 'خيارات', home: 'الرئيسية', receipt: 'فاتورة', pie: 'التقارير', gear: 'الإعدادات',
  undo: 'تراجع', banknote: 'سداد', coins: 'سداد', star: 'مميّز', tag: 'وسم', x: 'إغلاق',
  save: 'حفظ', contact: 'جهة اتصال', book: 'الدفتر', excel: 'Excel', pdf: 'PDF', up: 'رفع',
  globe: 'مشاركة', hist: 'السجل', pin: 'تثبيت', store: 'المحل', wa: 'واتساب', sms: 'رسالة', fp: 'بصمة'
};

const KIND_OF_OUTCOME = {
  sheet: 'ورقة منبثقة', screen: 'شاشة جديدة', toast: 'تنبيه', confirm: 'تأكيد',
  tab: 'تبويب آخر', inline: 'تغيير في الشاشة', error: 'خطأ', none: 'بلا أثر ظاهر'
};

/* ------------------------------------------------------------------ */
/** a stable signature for an icon, taken from its path data */
function iconSignature(markup) {
  const parts = String(markup).match(/(?:d|points|x1|y1|x2|y2|cx|cy|r|x|y|width|height)="[^"]*"/g) || [];
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function loadIcons() {
  const src = await readFile(path.join(ROOT, 'web/src/js/00-icons.js'), 'utf8');
  const map = new Map();
  const re = /(\w+):\s*'(<[^\n]*?)'/g;
  let m;
  while ((m = re.exec(src))) map.set(iconSignature(m[2]), m[1]);
  return map;
}

function startServer(dir) {
  return new Promise((resolve) => {
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml'
    };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(dir, rel || 'index.html');
      if (!file.startsWith(dir) || !existsSync(file)) { res.writeHead(404); res.end('nope'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ------------------------------------------------------------------ */
async function main() {
  if (!existsSync(path.join(DIR, 'index.html'))) {
    throw new Error('no built bundle at ' + DIR + ' - run `node web/build.mjs` first');
  }
  const iconMap = await loadIcons();
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const m = e && e.message ? e.message : String(e);
    if (m.indexOf('Not implemented:') === 0) return;
    errors.push(m);
  });

  const server = await startServer(DIR);
  const origin = 'http://127.0.0.1:' + server.address().port;
  const dom = await JSDOM.fromURL(origin + '/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole
  });
  const { window } = dom;
  const g = (expr) => window.eval(expr);

  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.scrollTo = () => {};
  window.navigator.vibrate = () => true;
  window.fetch = async (input) => {
    const url = new URL(String(input), origin + '/');
    const res = await fetch(url);
    return { ok: res.ok, status: res.status, json: async () => res.json(), text: async () => res.text() };
  };

  let lastConfirm = null;
  window.confirm = (msg) => { lastConfirm = String(msg); return false; };
  window.alert = () => {};
  window.prompt = () => null;

  await new Promise((r) => {
    if (window.document.readyState === 'complete') r();
    else window.addEventListener('load', r);
  });
  await new Promise((r) => setTimeout(r, 600));

  const doc = window.document;
  const app = doc.getElementById('app');
  const sheet = doc.getElementById('sheet');
  const sheetWrap = doc.getElementById('sheetWrap');
  const toast = doc.getElementById('toast');
  const actionrow = doc.getElementById('actionrow');
  const tabbar = doc.getElementById('tabbar');

  /* --- demo data + Arabic ------------------------------------------ */
  g('db = demoFixtures(); db.lang = "ar"; save(); stack=[{s:"home"}]; render();');
  await new Promise((r) => setTimeout(r, 200));

  /* --- state snapshot / restore ------------------------------------- */
  function snap() {
    return {
      db: g('JSON.stringify(db)'),
      stack: g('JSON.stringify(stack)'),
      ui: g('JSON.stringify(ui)'),
      app: app.innerHTML, sheet: sheet.innerHTML,
      open: sheetWrap.classList.contains('open'),
      toast: toast.innerHTML, shown: toast.classList.contains('show'),
      actionrow: actionrow.innerHTML, tabbar: tabbar.innerHTML
    };
  }
  function restore(s) {
    g('db = JSON.parse(' + JSON.stringify(s.db) + ')');
    g('stack = JSON.parse(' + JSON.stringify(s.stack) + ')');
    g('Object.assign(ui, JSON.parse(' + JSON.stringify(s.ui) + '))');
    app.innerHTML = s.app; sheet.innerHTML = s.sheet;
    sheetWrap.classList.toggle('open', s.open);
    toast.innerHTML = s.toast; toast.classList.toggle('show', s.shown);
    actionrow.innerHTML = s.actionrow; tabbar.innerHTML = s.tabbar;
  }

  /* --- reading the interface ---------------------------------------- */
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');

  function iconOf(el) {
    // the icon sometimes sits on the row that holds the control
    let host = el;
    for (let i = 0; i < 3 && host; i++) {
      const svg = host.querySelector && host.querySelector('svg');
      if (svg) {
        const sig = iconSignature(svg.innerHTML);
        if (sig) {
          const name = iconMap.get(sig);
          if (name) return name;
        }
      }
      host = host.parentElement;
    }
    return null;
  }
  function labelOf(el, icon) {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      const ph = el.getAttribute('placeholder');
      if (ph) return clean(ph);
      const own = clean(el.textContent);
      if (own) return own;
      return 'حقل إدخال';
    }
    const own = clean(el.textContent);
    // join the pieces so a name, a date and an amount do not run together
    const parts = [...el.children]
      .map((c) => clean(c.textContent))
      .filter((s) => s && s !== own);
    if (parts.length > 1) return parts.join(' · ');
    if (own) return own;
    if (icon && ICON_LABEL[icon]) return ICON_LABEL[icon];
    return '';
  }
  function controlKind(el) {
    if (el.classList.contains('tabplus')) return 'زر دائري';
    if (el.tagName === 'BUTTON') return 'زر';
    if (el.classList.contains('litem')) return 'صفّ';
    if (el.classList.contains('srow')) return 'صفّ ورقة';
    if (el.classList.contains('chip')) return 'شريحة';
    if (el.classList.contains('seg')) return 'مقطع';
    if (el.tagName === 'SELECT') return 'قائمة';
    if (el.tagName === 'INPUT') return 'حقل';
    return 'عنصر';
  }
  /** the same call with different arguments counts as the same action */
  const normalise = (h) => h.replace(/\b([A-Za-z_$][\w$]*)\([^()]*\)/g, '$1(…)');

  function collect(root) {
    const out = [];
    root.querySelectorAll('button,[onclick],[onchange],[onpointerdown],select,input').forEach((el) => {
      if (el.disabled) return;
      if (el.closest('#toast')) return;
      const onclick = el.getAttribute('onclick');
      const pointerdown = el.getAttribute('onpointerdown');
      const onchange = el.getAttribute('onchange');
      const oninput = el.getAttribute('oninput');
      if (!onclick && !pointerdown && !onchange && !oninput) return;
      const icon = iconOf(el);
      const base = {
        el, icon,
        label: labelOf(el, icon),
        kind: controlKind(el)
      };
      if (onclick) out.push(Object.assign({}, base, { handler: onclick, press: 'نقر' }));
      if (pointerdown) out.push(Object.assign({}, base, { handler: pointerdown, press: 'ضغط مطوّل' }));
      if (onchange) out.push(Object.assign({}, base, { handler: onchange, press: 'تغيير' }));
      if (oninput) out.push(Object.assign({}, base, { handler: oninput, press: 'كتابة' }));
    });
    return out;
  }

  function outline(root) {
    const parts = [];
    root.querySelectorAll('h1,h2,h3,.lb,.t,.d,.stat .v').forEach((el) => {
      const s = clean(el.textContent);
      if (s && s.length < 60 && parts.indexOf(s) === -1) parts.push(s);
    });
    return parts.slice(0, 16);
  }

  /**
   * A schematic description of what a screen looks like: the blocks in
   * order, with the text they carry. This is what the screen map draws.
   */
  function wireframe(root) {
    const blocks = [];
    const txt = (el) => clean(el.textContent);

    const pushList = (items) => {
      if (!items.length) return;
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') { last.items.push(...items); return; }
      blocks.push({ type: 'list', items });
    };

    const scan = (el) => {
      for (const child of el.children) {
        const cls = String(child.className && child.className.baseVal !== undefined
          ? child.className.baseVal : (child.className || ''));
        const tag = child.tagName;

        if (cls.includes('hdr')) {
          const h = child.querySelector('h1,h2');
          blocks.push({ type: 'header', label: h ? txt(h) : txt(child) });
          continue;
        }
        if (cls.includes('stats')) {
          const items = [...child.children].map((c) => {
            const t = c.querySelector('.t');
            const v = c.querySelector('.v');
            return (t ? txt(t) : '') + (v ? ' · ' + txt(v) : '');
          }).filter(Boolean);
          if (items.length) blocks.push({ type: 'stats', items });
          continue;
        }
        if (cls.includes('search')) {
          const input = child.querySelector('input');
          blocks.push({ type: 'search', label: input ? (input.getAttribute('placeholder') || '') : '' });
          continue;
        }
        if (cls.includes('grid2')) {
          const items = [...child.children].map((c) => {
            const t = c.querySelector('.t,.lb,h3');
            const v = c.querySelector('.v');
            return (t ? txt(t) : txt(c).slice(0, 30)) + (v ? ' · ' + txt(v) : '');
          }).filter(Boolean);
          if (items.length) blocks.push({ type: 'grid', items });
          continue;
        }
        if (cls.includes('bottombar')) {
          const items = [...child.children].map((c) => txt(c)).filter(Boolean);
          if (items.length) blocks.push({ type: 'bottom', items });
          continue;
        }
        if (cls.includes('litem') || cls.includes('srow')) {
          pushList([txt(child).slice(0, 60)]);
          continue;
        }
        if (cls.includes('btn') && !cls.includes('bottombar') && !cls.includes('hbtn')) {
          blocks.push({ type: 'button', label: txt(child).slice(0, 40) });
          continue;
        }
        if (cls.includes('card') && !cls.includes('stat')) {
          const t = child.querySelector('.lb,h3,.t');
          const body = txt(child);
          blocks.push({ type: 'card', label: t ? txt(t) : body.slice(0, 44) });
          continue;
        }
        if (cls.includes('chip') || cls.includes('seg')) {
          const items = [...child.children].map((c) => txt(c)).filter(Boolean);
          if (items.length) blocks.push({ type: 'chips', items });
          continue;
        }
        if (cls.includes('sep')) { blocks.push({ type: 'sep' }); continue; }
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
          blocks.push({ type: 'field', label: child.getAttribute('placeholder') || '' });
          continue;
        }
        if (child.children.length === 0) {
          const t = txt(child);
          if (t && t.length < 90) blocks.push({ type: 'text', label: t });
          continue;
        }
        scan(child);
      }
    };
    scan(root);
    return blocks.slice(0, 26);
  }

  function sheetTitle() {
    const h = sheet.querySelector('h3,h2,.lb,.card .t');
    return h ? clean(h.textContent) : 'ورقة';
  }

  /** a readable description of the interesting parts of the interface state */
  function describeState() {
    try {
      const u = g('ui');
      const bits = [];
      if (u.tf && (u.tf.kind !== 'all' || u.tf.period !== 'all')) {
        const k = { all: 'الكل', debt: 'الديون', pay: 'السداد' }[u.tf.kind] || u.tf.kind;
        const p = { all: 'كل الفترات', today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر' }[u.tf.period] || u.tf.period;
        bits.push('نوع:' + k + ' · فترة:' + p);
      }
      if (u.f && (u.f.status !== 'all' || u.f.period !== 'all' || u.f.sort !== 'recent' || u.f.near || u.f.over)) {
        const st = { all: 'الكل', owed: 'عليهم دين', none: 'بدون دين' }[u.f.status] || u.f.status;
        const so = { recent: 'آخر نشاط', debt: 'الأكثر دينًا', low: 'الأقل دينًا', name: 'الاسم' }[u.f.sort] || u.f.sort;
        bits.push('عملاء:' + st + ' · ترتيب:' + so + (u.f.near ? ' · قريب من السقف' : '') + (u.f.over ? ' · متأخر' : ''));
      }
      if (u.sel && u.sel.on) bits.push('وضع تحديد العمليات (' + (u.sel.ids || []).length + ')');
      if (u.csel && u.csel.on) bits.push('وضع تحديد العملاء (' + (u.csel.ids || []).length + ')');
      if (u.arch) bits.push('قائمة المؤرشفين');
      if (u.pOpen) bits.push('ورقة السداد مفتوحة');
      if (u.cq) bits.push('بحث: ' + u.cq);
      return bits.join(' · ');
    } catch (e) { return ''; }
  }

  /* --- press a control and report what happened --------------------- */
  async function press(c, opts) {
    const keepSheet = !!(opts && opts.keepSheet);
    // a sheet left over from an earlier press must not count as this
    // press opening a sheet
    if (!keepSheet) sheetWrap.classList.remove('open');
    const sheetOpenBefore = sheetWrap.classList.contains('open');
    const sheetTitleBefore = sheetOpenBefore ? sheetTitle() : '';
    const sheetHtmlBefore = sheet.innerHTML;
    const stateBefore = describeState();
    const stackBefore = g('JSON.stringify(stack)');
    lastConfirm = null;
    // a toast or a sheet left over from an earlier press must not be
    // mistaken for the result of this one
    toast.classList.remove('show');
    toast.innerHTML = '';

    let threw = null;
    try {
      const fn = g('(function(event){' + c.handler + '})');
      fn.call(c.el, {
        stopPropagation() {}, preventDefault() {},
        target: c.el, currentTarget: c.el, key: 'Enter', pointerId: 1
      });
    } catch (e) {
      threw = String(e && e.message ? e.message : e);
    }
    // a long press only fires after its timer, so give it time
    if (c.press === 'ضغط مطوّل') await new Promise((r) => setTimeout(r, 460));

    const stackAfter = g('JSON.stringify(stack)');
    let spec = null;
    let uiAfter = null;
    try { spec = g('JSON.stringify(stack[stack.length-1]||null)'); } catch (e) { spec = null; }
    try { uiAfter = g('JSON.stringify(ui)'); } catch (e) { uiAfter = null; }
    const sheetOpenAfter = sheetWrap.classList.contains('open');

    let outcome;
    if (threw) {
      outcome = { type: 'error', detail: threw };
    } else if (lastConfirm !== null) {
      outcome = { type: 'confirm', detail: lastConfirm };
    } else if (sheetOpenBefore && !sheetOpenAfter) {
      outcome = { type: 'close', title: sheetTitleBefore, detail: 'تُغلق الورقة' };
    } else if (sheetOpenAfter && (!sheetOpenBefore || sheet.innerHTML !== sheetHtmlBefore)) {
      outcome = { type: 'sheet', title: sheetTitle() };
    } else if (toast.classList.contains('show')) {
      outcome = { type: 'toast', detail: clean(toast.textContent) };
    } else if (stackAfter !== stackBefore) {
      outcome = { type: 'screen', target: g('(stack[stack.length-1]||{}).s') };
    } else {
      const stateAfter = describeState();
      outcome = { type: 'inline', detail: stateAfter !== stateBefore ? stateAfter : '' };
    }
    try { if (spec) outcome.spec = JSON.parse(spec); } catch (e) { /* optional */ }
    try { if (uiAfter) outcome.ui = JSON.parse(uiAfter); } catch (e) { /* optional */ }
    return { outcome };
  }

  /* --- walking ------------------------------------------------------ */
  const expanded = new Set();

  function nodeFor(c, outcome) {
    return {
      label: c.label || ICON_LABEL[c.icon] || c.handler,
      icon: c.icon,
      press: c.press,
      kind: c.kind,
      handler: c.handler,
      outcome: outcome.type,
      outcomeLabel: KIND_OF_OUTCOME[outcome.type] || outcome.type,
      detail: outcome.detail || '',
      title: outcome.title || '',
      target: outcome.target || '',
      targetTitle: SCREEN_TITLES[outcome.target] || outcome.target || '',
      spec: outcome.spec || null
    };
  }

  async function sheetChildren(depth) {
    const nodes = [];
    const seen = new Map();
    const sheetHtml = sheet.innerHTML;
    const uiJson = g('JSON.stringify(ui)');
    for (const sc of collect(sheet)) {
      const { outcome } = await press(sc, { keepSheet: true });
      sheet.innerHTML = sheetHtml;                 // put the sheet back
      sheetWrap.classList.add('open');
      g('Object.assign(ui, JSON.parse(' + JSON.stringify(uiJson) + '))');
      const node = nodeFor(sc, outcome);
      node.inSheet = true;
      if (outcome.type === 'sheet') node.sheetTitle = outcome.title;
      const key = normalise(sc.handler) + '|' + outcome.type + '|' + (outcome.target || outcome.title || '');
      if (seen.has(key)) { const t = seen.get(key); t.count = (t.count || 1) + 1; continue; }
      seen.set(key, node);
      nodes.push(node);
    }
    return nodes;
  }

  async function walkScreen(screenId, depth, budget, spec, uiState) {
    if (depth > 2 || budget.n <= 0) return { nodes: [], outline: [] };
    if (expanded.has(screenId)) return { nodes: [], outline: [], repeated: true };
    expanded.add(screenId);

    // a screen may need its parameters (the customer id) and its state
    const uiJson = uiState ? JSON.stringify(uiState) : null;
    if (uiJson) g('Object.assign(ui, ' + uiJson + ')');
    const target = spec && spec.s ? spec : { s: screenId, p: {} };
    g('stack = [' + JSON.stringify(target) + ']; render();');
    await new Promise((r) => setTimeout(r, 60));

    const out = outline(app);
    const wf = wireframe(app);
    const nodes = [];
    const seen = new Map();

    for (const c of collect(app)) {
      if (budget.n <= 0) break;
      budget.n--;
      const { outcome } = await press(c);
      const node = nodeFor(c, outcome);
      const key = normalise(c.handler) + '|' + outcome.type + '|' + (outcome.target || outcome.title || '');
      if (seen.has(key)) { const t = seen.get(key); t.count = (t.count || 1) + 1; continue; }
      seen.set(key, node);
      nodes.push(node);

      if (outcome.type === 'sheet') {
        node.children = await sheetChildren(depth + 1);
        node.sheetOutline = outline(sheet);
        node.sheetWireframe = wireframe(sheet);
      } else if (outcome.type === 'screen' && outcome.target) {
        const sub = await walkScreen(outcome.target, depth + 1, budget, outcome.spec, outcome.ui);
        node.children = sub.nodes;
        node.outline = sub.outline;
        node.wireframe = sub.wireframe;
        if (sub.repeated) node.repeated = true;
      }
      // put the screen back exactly as it was before the press
      if (uiJson) g('Object.assign(ui, ' + uiJson + ')');
      g('stack = [' + JSON.stringify(target) + ']; render();');
      await new Promise((r) => setTimeout(r, 25));
    }
    return { nodes, outline: out, wireframe: wf };
  }

  /* --- run ---------------------------------------------------------- */
  const result = { generatedAt: new Date().toISOString(), app: 'Daftari 3.0', tabs: [] };

  for (const tab of TABS) {
    expanded.clear();
    // the four tabs are never expanded again - switching tab is a leaf
    for (const t of TABS) expanded.add(t.id);
    const budget = { n: 220 };
    g('stack = [{s:' + JSON.stringify(tab.id) + ',p:{}}]; render();');
    await new Promise((r) => setTimeout(r, 80));

    const rootOutline = outline(app);
    const rootWireframe = wireframe(app);
    const rootUi = g('JSON.stringify(ui)');
    const rootControls = collect(app).concat(
      collect(actionrow).map((c) => Object.assign({}, c, { zone: 'شريط الإجراءات' })),
      collect(tabbar).map((c) => Object.assign({}, c, { zone: 'شريط التبويب' }))
    );
    const nodes = [];
    const seen = new Map();

    for (const c of rootControls) {
      if (budget.n <= 0) break;
      budget.n--;
      const { outcome } = await press(c);
      const node = nodeFor(c, outcome);
      if (c.zone) node.zone = c.zone;
      const key = normalise(c.handler) + '|' + outcome.type + '|' + (outcome.target || outcome.title || '');
      if (seen.has(key)) { const t = seen.get(key); t.count = (t.count || 1) + 1; continue; }
      seen.set(key, node);
      nodes.push(node);

      if (outcome.type === 'sheet') {
        node.children = await sheetChildren(1);
        node.sheetOutline = outline(sheet);
        node.sheetWireframe = wireframe(sheet);
      } else if (outcome.type === 'screen' && outcome.target) {
        const sub = await walkScreen(outcome.target, 1, budget, outcome.spec, outcome.ui);
        node.children = sub.nodes;
        node.outline = sub.outline;
        node.wireframe = sub.wireframe;
        if (sub.repeated) node.repeated = true;
      }
      g('Object.assign(ui, JSON.parse(' + JSON.stringify(rootUi) + '))');
      g('stack = [{s:' + JSON.stringify(tab.id) + ',p:{}}]; render();');
      await new Promise((r) => setTimeout(r, 25));
    }

    result.tabs.push({
      id: tab.id, title: tab.title, icon: tab.icon, blurb: tab.blurb,
      screenTitle: SCREEN_TITLES[tab.id] || tab.title,
      outline: rootOutline,
      wireframe: rootWireframe,
      controls: nodes
    });
    process.stdout.write('  ' + tab.id + ': ' + nodes.length + ' nodes\n');
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(result, null, 2), 'utf8');

  console.log('\nUI map written to ' + path.relative(ROOT, OUT));
  if (errors.length) {
    console.log('\nerrors seen while probing (' + errors.length + '):');
    for (const e of errors.slice(0, 10)) console.log('  - ' + e);
  }
  window.close();
  server.close();
}

main().catch((err) => {
  console.error('map failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
