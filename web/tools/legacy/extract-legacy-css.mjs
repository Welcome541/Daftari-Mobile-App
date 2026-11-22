#!/usr/bin/env node
/**
 * Lossless extraction of the original monolithic stylesheet into layers.
 *
 * The original lives in a single <style> block inside index.html. This
 * script parses it with a real CSS parser and buckets every rule into one
 * of five layers, preserving @media and @keyframes blocks intact.
 *
 *   tokens.css      the custom properties (palette + scale)
 *   base.css        reset, typography, document level rules
 *   components.css  every reusable piece of the interface
 *   layout.css      the application frame and the fixed furniture
 *   responsive.css  every @media block except @media print
 *   print.css       the @media print block
 *
 * Usage: node extract_css.mjs <original index.html> <output dir>
 */
import postcss from 'postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [, , htmlPath, outDir] = process.argv;
if (!htmlPath || !outDir) {
  console.error('usage: node extract_css.mjs <index.html> <out dir>');
  process.exit(1);
}

const html = await readFile(htmlPath, 'utf8');
const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (!match) { console.error('no <style> block'); process.exit(1); }
const root = postcss.parse(match[1], { from: 'index.html' });

/* ------------------------------------------------------------------ */
/* classification                                                       */
/* ------------------------------------------------------------------ */

/** Rules that define custom properties. */
function isTokenRule(rule) {
  let onlyVars = true;
  let hasVar = false;
  rule.walkDecls((d) => {
    if (d.prop.startsWith('--')) hasVar = true;
    else onlyVars = false;
  });
  return hasVar && onlyVars;
}

/** The frame: the shell of the application. */
const LAYOUT_SELECTORS = [
  /^#phone\b/, /^#app\b/, /^\.sbar\b/, /^\.hdr\b/, /^#tabbar\b/,
  /^#actionrow\b/, /^#fabAdd\b/, /^#sheetWrap\b/, /^#sheet\b/, /^#toast\b/,
  /^#printArea\b/, /^\.bottombar\b/, /^\.ptr\b/, /^body\b/, /^html\b/,
  /^\.hbtn\b/, /^\.logo-ic\b/, /^\.accchip\b/
];

/** Document level rules. */
const BASE_SELECTORS = [
  /^\*/, /^body\b/, /^html\b/, /^\.hide\b/, /^button:focus-visible/,
  /^input\b/, /^select\b/, /^textarea\b/, /^a\b/, /^\.recdot\b/,
  /^::selection/, /^::-webkit/, /^:focus/
];

function bucketOf(rule) {
  const sel = rule.selector.trim();

  if (isTokenRule(rule)) return 'tokens';
  if (/^body\.dark|^body\.priv/.test(sel)) return 'tokens';

  // the application frame wins over the generic base rules
  if (LAYOUT_SELECTORS.some(re => re.test(sel))) return 'layout';
  if (BASE_SELECTORS.some(re => re.test(sel))) return 'base';
  return 'components';
}

const buckets = {
  tokens: [], base: [], components: [], layout: [], responsive: [], print: []
};

/* ------------------------------------------------------------------ */
/* walk                                                                 */
/* ------------------------------------------------------------------ */

root.each((node) => {
  if (node.type === 'rule') {
    buckets[bucketOf(node)].push(node.toString());
    return;
  }
  if (node.type === 'atrule') {
    const name = node.name.toLowerCase();
    if (name === 'keyframes') {
      // the keyframes belong with the component that uses them
      buckets.components.push(node.toString());
      return;
    }
    if (name === 'media') {
      const params = node.params.toLowerCase();
      if (params.includes('print')) buckets.print.push(node.toString());
      else buckets.responsive.push(node.toString());
      return;
    }
    if (name === 'supports' || name === 'layer' || name === 'container') {
      buckets.responsive.push(node.toString());
      return;
    }
  }
  if (node.type === 'comment') return;
  buckets.base.push(node.toString());
});

/* ------------------------------------------------------------------ */
/* write                                                                */
/* ------------------------------------------------------------------ */

const headers = {
  tokens: 'Daftari · design tokens',
  base: 'Daftari · base layer',
  components: 'Daftari · component layer',
  layout: 'Daftari · layout layer',
  responsive: 'Daftari · responsive layer',
  print: 'Daftari · print layer'
};

await mkdir(outDir, { recursive: true });
for (const [name, rules] of Object.entries(buckets)) {
  const body = rules.join('\n');
  const file = path.join(outDir, name + '.css');
  await writeFile(file, body, 'utf8');
  console.log(`${name}.css  ${rules.length} blocks  ${body.length} bytes`);
}

/* ------------------------------------------------------------------ */
/* verify: every original node must be accounted for                   */
/* ------------------------------------------------------------------ */

const originalNodes = [];
root.each((node) => {
  if (node.type === 'rule' || node.type === 'atrule') originalNodes.push(node.toString());
});
const emitted = new Set();
for (const rules of Object.values(buckets)) for (const r of rules) emitted.add(r);
const lost = originalNodes.filter(n => !emitted.has(n));
console.log('\noriginal top level nodes : ' + originalNodes.length);
console.log('emitted                  : ' + emitted.size);
console.log('lost                     : ' + lost.length);
if (lost.length) {
  for (const l of lost.slice(0, 10)) console.log('  LOST: ' + l.slice(0, 110));
  process.exit(1);
}
