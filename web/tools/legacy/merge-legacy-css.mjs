#!/usr/bin/env node
/**
 * Merge the lossless extraction with the token driven sizing layer.
 *
 * The result is the five layers the application ships:
 *   tokens.css      palette + scale (hand written)
 *   base.css        document level rules            (extracted, lossless)
 *   components.css  every interface component       (extracted, lossless)
 *   layout.css      the application frame           (extracted, lossless)
 *   responsive.css  sizing layer + every @media     (merged)
 *   print.css       the @media print block         (extracted, lossless)
 *
 * The media queries of the original are converted to the token form:
 * every pixel value becomes calc(<n>px * var(--s)), while the layout
 * envelopes (max-width / min-width) stay where they are.
 */
import postcss from 'postcss';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EX = '/tmp/work/css-extracted';
const OUT = '/home/user/Daftari-Mobile-App/web/src/css';

/** Declarations whose value is a layout envelope, not an interface size. */
const ENVELOPE = new Set(['max-width', 'min-width', 'max-height', 'min-height']);

/** The properties that describe an interface dimension. */
const DIMENSION = new Set([
  'font-size', 'width', 'height', 'padding', 'padding-top', 'padding-right',
  'padding-bottom', 'padding-left', 'padding-block', 'padding-inline',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-inline', 'gap', 'row-gap', 'column-gap',
  'border-radius', 'top', 'right', 'bottom', 'left', 'inset', 'inset-block',
  'inset-inline', 'flex-basis'
]);

/** Convert a pixel value into the token form. */
function scaleValue(value) {
  if (!value || /var\(|env\(|%|vw|vh|vmin|vmax/.test(value)) return value;
  if (!/\d+(\.\d+)?px/.test(value)) return value;
  return value.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `calc(${n}px * var(--s))`);
}

/* ------------------------------------------------------------------ */
/* 1. the media queries of the original, converted to the token form    */
/* ------------------------------------------------------------------ */

const originalResponsive = await readFile(path.join(EX, 'responsive.css'), 'utf8');
const parsed = postcss.parse(originalResponsive);

const mediaBlocks = new Map();       // params -> node
parsed.each((node) => {
  if (node.type !== 'atrule') return;
  const key = node.params.replace(/\s+/g, ' ').trim();
  if (!mediaBlocks.has(key)) mediaBlocks.set(key, []);
  mediaBlocks.get(key).push(node);
});

const converted = new Map();
for (const [params, nodes] of mediaBlocks) {
  const clone = postcss.parse(nodes.map(n => n.toString()).join('\n'));
  clone.walkDecls((decl) => {
    if (ENVELOPE.has(decl.prop)) return;
    decl.value = scaleValue(decl.value);
  });
  converted.set(params, clone.toString().trim());
}

/* ------------------------------------------------------------------ */
/* 2. the hand written sizing layer                                    */
/* ------------------------------------------------------------------ */

const mine = await readFile(path.join(OUT, 'responsive.css'), 'utf8');
const mineParsed = postcss.parse(mine);

// split the hand written layer: the rules that are always active, and its
// own media blocks
const always = [];
const mineMedia = new Map();
mineParsed.each((node) => {
  if (node.type === 'rule') { always.push(node.toString()); return; }
  if (node.type === 'atrule') {
    const key = node.params.replace(/\s+/g, ' ').trim();
    mineMedia.set(key, node.toString());
  }
});

/* ------------------------------------------------------------------ */
/* 3. assemble the final responsive layer                              */
/* ------------------------------------------------------------------ */

// narrow breakpoints first, so the narrowest one wins
const ORDER = [
  '(max-width:480px)',
  '(max-width:380px)',
  '(max-width:360px)',
  '(min-width:720px)',
  '(min-width:768px)',
  '(min-width:1100px)',
  '(max-height:640px)',
  '(max-height:520px) and (orientation:landscape)',
  '(prefers-reduced-motion:reduce)'
];

const parts = [];
parts.push(`/* ---------------------------------------------------------------------
 * Part 1 - the sizing layer
 * Every dimension that adapts to the device is expressed as
 * calc(<base> * var(--s)) so the interface scale (--s) and the vertical
 * rhythm (--density) can retune the whole app from a single setting.
 * ------------------------------------------------------------------- */`);
parts.push(always.join('\n'));

parts.push(`/* ---------------------------------------------------------------------
 * Part 2 - the breakpoints
 * The original breakpoints are preserved and expressed in the token form;
 * the order runs from the narrowest to the widest so the narrowest rule
 * always wins.
 * ------------------------------------------------------------------- */`);
for (const params of ORDER) {
  const mine_ = mineMedia.get(params);
  const orig = converted.get(params);
  if (mine_ && orig) {
    parts.push('/* both the original and the token layer apply here */');
    parts.push(orig);
    parts.push(mine_);
  } else if (mine_) {
    parts.push(mine_);
  } else if (orig) {
    parts.push(orig);
  }
}
// any breakpoint that was not listed explicitly
for (const [params, body] of converted) {
  if (!ORDER.includes(params)) parts.push(body);
}
for (const [params, body] of mineMedia) {
  if (!ORDER.includes(params)) parts.push(body);
}

await writeFile(path.join(OUT, 'responsive.css'), parts.join('\n\n') + '\n', 'utf8');
console.log('responsive.css  ' + parts.join('\n\n').length + ' bytes');

/* ------------------------------------------------------------------ */
/* 4. the other layers, taken from the lossless extraction             */
/* ------------------------------------------------------------------ */

for (const name of ['base', 'components', 'layout']) {
  const css = await readFile(path.join(EX, name + '.css'), 'utf8');
  const parsedLayer = postcss.parse(css);
  parsedLayer.walkDecls((decl) => {
    if (ENVELOPE.has(decl.prop)) return;
    if (!DIMENSION.has(decl.prop)) return;
    decl.value = scaleValue(decl.value);
  });
  const out = parsedLayer.toString().trim() + '\n';
  await writeFile(path.join(OUT, name + '.css'), out, 'utf8');
  console.log(name + '.css  ' + out.length + ' bytes');
}
const print = await readFile(path.join(EX, 'print.css'), 'utf8');
await writeFile(path.join(OUT, 'print.css'), print.trim() + '\n', 'utf8');
console.log('print.css  ' + print.length + ' bytes');
