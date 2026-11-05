#!/usr/bin/env node
/**
 * Daftari · screen map renderer
 * -------------------------------------------------------------------
 * Turns the UI map produced by map-ui.mjs into four screen maps, one
 * per tab, as a right-to-left tree:
 *
 *   the root          the tab itself, with a schematic of the screen
 *   every branch      one press, with what it produces
 *   the little phone  a schematic of the screen or sheet it revealed
 *
 * The output is four PNG files, the SVG they come from, and one PDF
 * that gathers them.
 *
 * Usage:
 *   node web/tools/render-maps.mjs \
 *     [--map web/scratch/ui-map.json] [--out docs/maps] [--scale 1.6]
 */
import { Resvg } from '@resvg/resvg-js';
import PDFDocument from 'pdfkit';
import opentype from 'opentype.js';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}
const MAP = path.resolve(ROOT, arg('map', 'web/scratch/ui-map.json'));
const OUT = path.resolve(ROOT, arg('out', 'docs/maps'));
const SCALE = Number(arg('scale', '1.6'));

/* ------------------------------------------------------------------ */
/* palette - the colours of the application itself                      */
/* ------------------------------------------------------------------ */
const C = {
  navy: '#0d1f3a', navy2: '#16345c', navyBg: '#eef2f8',
  red: '#a71949', redBg: '#fbeef2',
  green: '#0e7a52', greenBg: '#e9f5f0',
  amber: '#a76700', amberBg: '#fdf3e3',
  soft: '#5b6b7f', line: '#dbe3ec', bg: '#f5f8fc', card: '#ffffff',
  slate: '#44546a', slateBg: '#eef1f5'
};

const OUTCOME = {
  screen: { c: C.navy, bg: C.navyBg, t: 'شاشة جديدة' },
  sheet: { c: C.amber, bg: C.amberBg, t: 'ورقة منبثقة' },
  toast: { c: C.slate, bg: C.slateBg, t: 'تنبيه' },
  confirm: { c: C.red, bg: C.redBg, t: 'تأكيد' },
  inline: { c: C.green, bg: C.greenBg, t: 'تغيير في الشاشة' },
  close: { c: C.slate, bg: C.slateBg, t: 'إغلاق' },
  error: { c: C.red, bg: C.redBg, t: 'خطأ' },
  none: { c: C.soft, bg: C.slateBg, t: 'بلا أثر' }
};
const PRESS = {
  'نقر': { c: C.navy2, bg: C.navyBg },
  'ضغط مطوّل': { c: C.red, bg: C.redBg },
  'كتابة': { c: C.green, bg: C.greenBg },
  'تغيير': { c: C.amber, bg: C.amberBg }
};

/* ------------------------------------------------------------------ */
/* fonts                                                                */
/* ------------------------------------------------------------------ */
const FONT_DIR = path.join(ROOT, 'web/node_modules/@expo-google-fonts/cairo');
const FONTS = {
  regular: path.join(FONT_DIR, '400Regular/Cairo_400Regular.ttf'),
  bold: path.join(FONT_DIR, '700Bold/Cairo_700Bold.ttf'),
  black: path.join(FONT_DIR, '900Black/Cairo_900Black.ttf')
};
const DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

let opentypeReg, opentypeBold, opentypeBlack;
function loadFonts() {
  opentypeReg = opentype.parse(readFileSync(FONTS.regular));
  opentypeBold = opentype.parse(readFileSync(FONTS.bold));
  opentypeBlack = opentype.parse(readFileSync(FONTS.black));
}

/** width of a string in a given weight - Arabic is measured unshaped,
 *  which over-estimates slightly, and that is the safe direction */
function measure(text, size, weight) {
  const f = weight === 'bold' ? opentypeBold : weight === 'black' ? opentypeBlack : opentypeReg;
  try { return f.getAdvanceWidth(String(text), size); } catch (e) { return String(text).length * size * 0.55; }
}

/* ------------------------------------------------------------------ */
/* the icon set, taken from the application source                      */
/* ------------------------------------------------------------------ */
let ICONS = {};
async function loadIcons() {
  const src = await readFile(path.join(ROOT, 'web/src/js/00-icons.js'), 'utf8');
  const re = /(\w+):\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] === 'P') continue;
    ICONS[m[1]] = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
}

/* ------------------------------------------------------------------ */
/* svg helpers                                                          */
/* ------------------------------------------------------------------ */
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function T(x, y, s, o) {
  o = o || {};
  const size = o.size || 16;
  const weight = o.weight || 'normal';
  const family = o.family || 'Cairo';
  return `<text x="${r2(x)}" y="${r2(y)}" font-family="${family}" font-size="${size}"` +
    ` font-weight="${weight}" fill="${o.fill || C.navy}"` +
    (o.opacity ? ` opacity="${o.opacity}"` : '') +
    ` text-anchor="${o.anchor || 'end'}">${esc(s)}</text>`;
}
function RC(x, y, w, h, o) {
  o = o || {};
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}"` +
    ` rx="${o.rx == null ? 0 : o.rx}" fill="${o.fill || 'none'}"` +
    (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : '') +
    (o.opacity ? ` opacity="${o.opacity}"` : '') + '/>';
}
function LN(x1, y1, x2, y2, o) {
  o = o || {};
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"` +
    ` stroke="${o.stroke || C.line}" stroke-width="${o.sw || 1.5}"` +
    (o.dash ? ` stroke-dasharray="${o.dash}"` : '') +
    (o.opacity ? ` opacity="${o.opacity}"` : '') + '/>';
}
function ICON(name, x, y, size, color) {
  const p = ICONS[name];
  if (!p) return '';
  const s = size / 24;
  return `<g transform="translate(${r2(x)},${r2(y)}) scale(${r2(s)})" fill="none" stroke="${color}"` +
    ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.replace(/currentColor/g, color)}</g>`;
}

/** a rounded label with its text inside, anchored on one side */
function PILL(x, y, text, o) {
  o = o || {};
  const size = o.size || 12.5;
  const weight = o.weight || 'bold';
  const padX = o.padX == null ? 11 : o.padX;
  const h = o.h == null ? size + 11 : o.h;
  const tw = measure(text, size, weight);
  const w = tw + padX * 2;
  const lx = o.anchor === 'start' ? x : x - w;
  let s = RC(lx, y, w, h, { rx: h / 2, fill: o.bg || C.slateBg });
  if (o.stroke) s += RC(lx, y, w, h, { rx: h / 2, stroke: o.stroke, sw: 1 });
  s += T(o.anchor === 'start' ? lx + padX : lx + w - padX, y + h - 5.5, text,
    { size, weight, fill: o.fill || C.soft, anchor: o.anchor === 'start' ? 'start' : 'end' });
  return { svg: s, w };
}

/* ------------------------------------------------------------------ */
/* layout                                                               */
/* ------------------------------------------------------------------ */
const W = 2000;
const MARGIN = 56;
const INDENT = 42;
const GAP = 11;
const PHONE_W = 196;
const PHONE_H = 158;
const CARD_H = 82;
const CARD_H_PHONE = PHONE_H + 30;

const rightOf = (depth) => W - MARGIN - depth * INDENT;
const leftOf = (depth) => MARGIN;

/** the schematic of a screen, drawn as a tiny phone */
function miniPhone(x, y, blocks, title) {
  let s = '';
  s += RC(x, y, PHONE_W, PHONE_H, { rx: 14, fill: C.card, stroke: C.line, sw: 1.4 });
  s += RC(x + 7, y + 7, PHONE_W - 14, 20, { rx: 6, fill: C.navy });
  s += T(x + PHONE_W - 14, y + 21, (title || '').slice(0, 26), { size: 10, weight: 'bold', fill: '#fff' });

  let cy = y + 34;
  const inner = PHONE_W - 20;
  const ix = x + 10;
  for (const b of blocks) {
    if (cy > y + PHONE_H - 10) break;
    switch (b.type) {
      case 'stats':
        s += RC(ix, cy, (inner - 6) / 2, 20, { rx: 4, fill: C.navyBg, stroke: C.line });
        s += RC(ix + inner / 2 + 3, cy, (inner - 6) / 2, 20, { rx: 4, fill: C.greenBg, stroke: C.line });
        if (b.items[0]) s += T(ix + inner / 2 - 4, cy + 14, b.items[0].slice(0, 16), { size: 8.5, fill: C.navy });
        if (b.items[1]) s += T(ix + inner - 4, cy + 14, b.items[1].slice(0, 16), { size: 8.5, fill: C.green });
        cy += 26;
        break;
      case 'search':
        s += RC(ix, cy, inner, 15, { rx: 7, fill: C.bg, stroke: C.line });
        if (b.label) s += T(ix + inner - 6, cy + 11, b.label.slice(0, 26), { size: 8, fill: C.soft });
        cy += 21;
        break;
      case 'field':
        s += RC(ix, cy, inner, 14, { rx: 4, fill: C.bg, stroke: C.line });
        cy += 19;
        break;
      case 'chips': {
        const n = Math.min(b.items.length, 4);
        const cw = (inner - (n - 1) * 4) / n;
        for (let i = 0; i < n; i++) s += RC(ix + i * (cw + 4), cy, cw, 13, { rx: 6, fill: C.navyBg, stroke: C.line });
        cy += 18;
        break;
      }
      case 'text':
        s += T(ix + inner, cy + 9, b.label.slice(0, 30), { size: 8.5, weight: 'bold', fill: C.soft });
        cy += 15;
        break;
      case 'list': {
        const n = Math.min(b.items.length, 3);
        for (let i = 0; i < n; i++) {
          s += RC(ix, cy, inner, 13, { rx: 4, fill: C.bg, stroke: C.line });
          s += RC(ix + 3, cy + 3, 7, 7, { rx: 2, fill: C.navyBg });
          s += RC(ix + 14, cy + 5, inner - 34, 3, { rx: 1.5, fill: C.line });
          cy += 16;
        }
        cy += 2;
        break;
      }
      case 'card':
        s += RC(ix, cy, inner, 17, { rx: 4, fill: C.card, stroke: C.line });
        s += RC(ix + 5, cy + 4, inner * 0.5, 4, { rx: 2, fill: C.line });
        s += RC(ix + 5, cy + 11, inner * 0.32, 3, { rx: 1.5, fill: C.line });
        cy += 22;
        break;
      case 'grid':
        s += RC(ix, cy, (inner - 5) / 2, 20, { rx: 4, fill: C.bg, stroke: C.line });
        s += RC(ix + inner / 2 + 2.5, cy, (inner - 5) / 2, 20, { rx: 4, fill: C.bg, stroke: C.line });
        cy += 25;
        break;
      case 'button':
        s += RC(ix, cy, inner * 0.55, 14, { rx: 4, fill: C.navyBg, stroke: C.line });
        if (b.label) s += T(ix + inner * 0.55 - 5, cy + 10.5, b.label.slice(0, 24), { size: 8, fill: C.soft });
        cy += 19;
        break;
      case 'bottom':
        s += RC(ix, cy, inner, 15, { rx: 5, fill: C.navyBg, stroke: C.line });
        cy += 20;
        break;
      case 'sep':
        s += LN(ix, cy, ix + inner, cy, { stroke: C.line, sw: 1, dash: '3 3' });
        cy += 9;
        break;
      default:
        break;
    }
  }
  return s;
}

/** one card: the press, and what it produced */
function card(node, depth) {
  const L = leftOf(depth), R = rightOf(depth);
  const hasPhone = !!(node.wireframe || node.sheetWireframe);
  const h = hasPhone ? CARD_H_PHONE : CARD_H;
  const oc = OUTCOME[node.outcome] || OUTCOME.none;
  const blocks = node.sheetWireframe || node.wireframe;

  let s = '';
  s += RC(L, 0, R - L, h, { rx: 12, fill: C.card, stroke: C.line, sw: 1.3 });
  s += RC(R - 6, 0, 6, h, { rx: 3, fill: oc.c });

  // the icon of the control
  const ic = node.icon && ICONS[node.icon] ? node.icon : null;
  const iconBox = RC(R - 50, 16, 34, 34, { rx: 10, fill: oc.bg });
  s += iconBox;
  if (ic) s += ICON(ic, R - 41, 24, 18, oc.c);

  // the label
  let label = String(node.label || '').replace(/\s+/g, ' ').trim();
  const maxLabel = 760;
  if (measure(label, 17, 'bold') > maxLabel) {
    while (label.length > 4 && measure(label + '…', 17, 'bold') > maxLabel) label = label.slice(0, -1);
    label += '…';
  }
  s += T(R - 60, 34, label, { size: 17, weight: 'bold', fill: C.navy });

  // the press, and what it produced
  const pc = PRESS[node.press] || PRESS['نقر'];
  let px = R - 60;
  if (node.press && node.press !== 'نقر') {
    const p = PILL(px, 44, node.press, { size: 11, bg: pc.bg, fill: pc.c });
    s += p.svg;
  }

  // the detail line
  let dy = 64;
  if (node.detail) {
    let d = String(node.detail).replace(/\s+/g, ' ').trim();
    if (measure(d, 12.5, 'normal') > maxLabel) {
      while (d.length > 4 && measure(d + '…', 12.5, 'normal') > maxLabel) d = d.slice(0, -1);
      d += '…';
    }
    s += T(R - 60, dy, d, { size: 12.5, fill: C.soft });
    dy += 16;
  }
  if (node.count > 1) {
    s += T(R - 60, dy, '×' + node.count + ' من هذا النوع', { size: 11.5, fill: C.soft, opacity: 0.85 });
  }

  // the schematic of what appeared, on the far side
  let phoneRight = L + 18;
  if (hasPhone) {
    const title = node.outcome === 'sheet' ? (node.title || 'ورقة') : (node.target || 'شاشة');
    s += miniPhone(L + 18, 16, blocks, title);
    phoneRight = L + 18 + PHONE_W + 18;
  }

  // the outcome, next to it
  const olabel = oc.t + (node.title ? ' — ' + node.title : '') +
    (!node.title && node.targetTitle ? ' — ' + node.targetTitle : '');
  const pill = PILL(phoneRight, hasPhone ? 16 : 22, olabel.slice(0, 46), { size: 12, bg: oc.bg, fill: oc.c, anchor: 'start' });
  s += pill.svg;
  return { svg: s, h };
}

/** the root: the tab itself */
function rootCard(tab) {
  const L = MARGIN, R = W - MARGIN;
  const h = 190;
  let s = '';
  s += RC(L, 0, R - L, h, { rx: 16, fill: C.navy });
  s += RC(L, 0, 8, h, { rx: 4, fill: C.green });

  s += T(R - 34, 52, tab.title, { size: 34, weight: 'black', fill: '#ffffff' });
  s += T(R - 34, 84, tab.blurb, { size: 14, fill: '#c9d6e6' });
  const icon = tab.icon && ICONS[tab.icon] ? tab.icon : 'home';
  s += ICON(icon, L + 26, 34, 44, '#8fb3e0');

  // the visible sections of the screen
  let x = R - 34;
  const y = 108;
  s += T(x, y, 'ما تظهره هذه الشاشة:', { size: 12, weight: 'bold', fill: '#8fb3e0' });
  x -= 150;
  let count = 0;
  for (const o of (tab.outline || []).slice(0, 8)) {
    const p = PILL(x, y - 14, o, { size: 11.5, bg: '#1d3c63', fill: '#dbe7f5' });
    s += p.svg;
    x -= p.w + 8;
    if (++count >= 7) break;
  }

  // the schematic of the tab
  s += miniPhone(L + 24, 16, tab.wireframe || [], tab.title);
  return { svg: s, h: h };
}

/* ------------------------------------------------------------------ */
function buildSvg(tab) {
  let body = '';
  let y = 0;

  // the header band
  const headH = 132;
  let head = RC(0, 0, W, headH, { fill: C.navy });
  head += T(W - MARGIN, 62, 'خريطة الشاشات — ' + tab.title, { size: 32, weight: 'black', fill: '#fff' });
  head += T(W - MARGIN, 94, 'دَفتَري 3.0 · مخطط شجري لكل ضغطة وما تظهره', { size: 15, fill: '#9fb8d4' });
  head += T(MARGIN, 62, 'مولَّد من الكود نفسه', { size: 13, fill: '#7f9cbb', anchor: 'start' });
  head += T(MARGIN, 90, 'docsmaps/' + tab.id + '.png', { size: 12, fill: '#5f7c9c', anchor: 'start', family: 'DejaVu Sans' });

  // the legend
  let lx = MARGIN;
  const legend = [['شاشة جديدة', OUTCOME.screen], ['ورقة منبثقة', OUTCOME.sheet], ['تنبيه', OUTCOME.toast],
    ['تأكيد', OUTCOME.confirm], ['تغيير في الشاشة', OUTCOME.inline]];
  for (const [txt, o] of legend) {
    const p = PILL(lx + 130, 104, txt, { size: 11, bg: o.bg, fill: o.c, anchor: 'start' });
    head += p.svg;
    lx += p.w + 10;
  }

  body += head;
  y = headH + 26;

  // the root
  const root = rootCard(tab);
  body += `<g transform="translate(0,${y})">` + root.svg + '</g>';
  y += root.h + 26;

  // the branches
  const children = tab.controls || [];
  const heights = children.map((c) => subtreeHeight(c));
  children.forEach((c, i) => {
    const cy = y;
    const drawn = drawSubtree(c, 1, cy);
    body += drawn.svg;
    y = cy + heights[i] + GAP;
  });

  const totalH = Math.ceil(y + 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
<rect width="${W}" height="${totalH}" fill="${C.bg}"/>
${body}
</svg>`;
}

function subtreeHeight(node) {
  const hasPhone = !!(node.wireframe || node.sheetWireframe);
  let h = hasPhone ? CARD_H_PHONE : CARD_H;
  const kids = node.children || [];
  for (const k of kids) h += subtreeHeight(k) + GAP;
  return h;
}

function drawSubtree(node, depth, y) {
  const L = leftOf(depth), R = rightOf(depth);
  const c = card(node, depth);
  let s = `<g transform="translate(0,${y})">` + c.svg + '</g>';
  const kids = node.children || [];
  let cy = y + c.h + GAP;
  kids.forEach((k) => {
    // the elbow
    const railX = rightOf(depth) - INDENT / 2;
    const kidR = rightOf(depth + 1);
    s += `<g>` +
      LN(railX, y + c.h, railX, cy + 4, { stroke: '#c3d0de', sw: 2 }) +
      LN(railX, cy + 4, kidR + 3, cy + 4, { stroke: '#c3d0de', sw: 2 }) +
      RC(kidR - 4, cy - 4, 8, 8, { rx: 4, fill: (OUTCOME[k.outcome] || OUTCOME.none).c }) +
      `</g>`;
    const sub = drawSubtree(k, depth + 1, cy);
    s += sub.svg;
    cy += subtreeHeight(k) + GAP;
  });
  return { svg: s, h: c.h };
}

/* ------------------------------------------------------------------ */
/* the cover, drawn in the same way as the maps                         */
/* ------------------------------------------------------------------ */
function countNodes(nodes) {
  let n = 0;
  for (const c of nodes || []) { n += 1 + countNodes(c.children); }
  return n;
}
function buildCover(map, pages) {
  const H = 1010;
  const CW = 620;
  const CH = 300;
  const gap = 34;
  let s = RC(0, 0, W, H, { fill: C.bg });

  // the title band
  s += RC(0, 0, W, 300, { fill: C.navy });
  s += T(W - MARGIN, 108, 'خريطة شاشات دَفتَري', { size: 56, weight: 'black', fill: '#ffffff' });
  s += T(W - MARGIN, 158, 'أربعة مخططات شجرية: الرئيسية · العملاء · التقارير · الإعدادات', { size: 20, fill: '#9fb8d4' });
  s += T(W - MARGIN, 200, 'كل ضغطة داخل التطبيق، وما تظهر بعده بالتفصيل.', { size: 16, fill: '#c9d6e6' });
  s += T(MARGIN, 108, 'دَفتَري 3.0', { size: 22, weight: 'bold', fill: '#8fb3e0', anchor: 'start' });
  s += T(MARGIN, 150, 'مولَّدة من الكود نفسه', { size: 14, fill: '#7f9cbb', anchor: 'start' });
  s += T(MARGIN, 200, 'لا رسم يدوي: يشغّل المستخرِج التطبيق داخل متصفّح حقيقي،', { size: 13, fill: '#5f7c9c', anchor: 'start' });
  s += T(MARGIN, 222, 'ويضغط كل عنصر، ويسجّل ما يظهر فعلًا.', { size: 13, fill: '#5f7c9c', anchor: 'start' });

  // the legend
  let lx = MARGIN;
  for (const [txt, o] of [['شاشة جديدة', OUTCOME.screen], ['ورقة منبثقة', OUTCOME.sheet],
    ['تنبيه', OUTCOME.toast], ['تأكيد', OUTCOME.confirm], ['تغيير في الشاشة', OUTCOME.inline]]) {
    const p = PILL(lx, 268, txt, { size: 13, bg: '#1d3c63', fill: '#dbe7f5', anchor: 'start' });
    s += p.svg;
    lx += p.w + 12;
  }

  // one card per tab
  map.tabs.forEach((tab, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MARGIN + col * (CW + gap);
    const y = 350 + row * (CH + gap);
    s += RC(x, y, CW, CH, { rx: 16, fill: C.card, stroke: C.line, sw: 1.4 });
    s += RC(x, y, 7, CH, { rx: 4, fill: C.navy });
    s += T(x + CW - 26, y + 46, tab.title, { size: 28, weight: 'black', fill: C.navy });
    const p = pages.find((q) => q.tab.id === tab.id);
    s += T(x + CW - 26, y + 76, tab.blurb, { size: 13, fill: C.soft });
    s += T(x + CW - 26, y + 104, countNodes(tab.controls) + ' ضغطة موثّقة · ' + (p ? p.w : 0) + '×' + (p ? p.h : 0) + ' بكسل', { size: 12.5, fill: C.soft });
    s += miniPhone(x + 22, y + 128, tab.wireframe || [], tab.title);
    const ic = tab.icon && ICONS[tab.icon] ? tab.icon : 'home';
    s += ICON(ic, x + 24, y + 20, 24, C.navy2);
  });

  // the footer
  s += T(W - MARGIN, H - 34, 'راجع دليل النسخة 2.22 لتفصيل النسخة القديمة.', { size: 13, fill: C.soft });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${s}
</svg>`;
}

/* ------------------------------------------------------------------ */
/* the pdf - every page is an image, so the arabic is exactly as drawn */
/* ------------------------------------------------------------------ */
async function buildPdf(pages, coverPng, out) {
  const doc = new PDFDocument({ autoFirstPage: false, compress: true });
  const stream = createWriteStream(out);
  doc.pipe(stream);

  doc.addPage({ size: [W, 1010] });
  doc.image(coverPng, 0, 0, { fit: [W, 1010] });

  for (const p of pages) {
    doc.addPage({ size: [W, p.h] });
    doc.image(p.png, 0, 0, { fit: [W, p.h] });
  }
  doc.end();
  await new Promise((res) => stream.on('finish', res));
}

/* ------------------------------------------------------------------ */
async function main() {
  if (!existsSync(MAP)) throw new Error('no UI map at ' + MAP + ' - run `node web/tools/map-ui.mjs` first');
  loadFonts();
  await loadIcons();

  const map = JSON.parse(await readFile(MAP, 'utf8'));
  await mkdir(OUT, { recursive: true });

  const pages = [];
  for (const tab of map.tabs) {
    const svg = buildSvg(tab);
    const svgPath = path.join(OUT, tab.id + '.svg');
    await writeFile(svgPath, svg, 'utf8');

    const resvg = new Resvg(svg, {
      font: {
        fontFiles: [FONTS.regular, FONTS.bold, FONTS.black, DEJAVU],
        defaultFontFamily: 'Cairo',
        loadSystemFonts: false
      },
      fitTo: { mode: 'width', value: Math.round(W * SCALE) },
      background: C.bg
    });
    const png = resvg.render().asPng();
    const pngPath = path.join(OUT, tab.id + '.png');
    await writeFile(pngPath, png);

    const height = Math.round(svg.match(/height="(\d+)"/)[1] * SCALE);
    pages.push({ tab, png: pngPath, pngBuffer: png, w: Math.round(W * SCALE), h: height });
    console.log('  ' + tab.id + ': ' + (W * SCALE) + ' × ' + height + ' px');
  }

  // the cover, drawn with the same engine
  const coverSvg = buildCover(map, pages);
  await writeFile(path.join(OUT, 'cover.svg'), coverSvg, 'utf8');
  const coverResvg = new Resvg(coverSvg, {
    font: { fontFiles: [FONTS.regular, FONTS.bold, FONTS.black, DEJAVU], defaultFontFamily: 'Cairo', loadSystemFonts: false },
    fitTo: { mode: 'width', value: Math.round(W * SCALE) },
    background: C.bg
  });
  const coverPng = coverResvg.render().asPng();
  await writeFile(path.join(OUT, 'cover.png'), coverPng);

  await buildPdf(pages, coverPng, path.join(OUT, 'daftari-3.0-screen-maps.pdf'));
  console.log('\nwritten to ' + path.relative(ROOT, OUT));
  for (const f of await readdir(OUT)) console.log('  ' + f);
}

main().catch((err) => {
  console.error('render failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
