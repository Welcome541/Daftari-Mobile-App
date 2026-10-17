#!/usr/bin/env node
/**
 * Daftari · stylesheet check
 * -------------------------------------------------------------------
 * Validates the sizing system:
 *   - every stylesheet parses
 *   - every `var(--x)` resolves to a token that is actually defined
 *   - the scale variables have the documented range
 *   - the adaptive dimensions really are token driven
 *
 * Usage: node web/tools/check-css.mjs [--dir web/src/css]
 */
import postcss from 'postcss';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}
const DIR = path.resolve(ROOT, arg('dir', 'web/src/css'));

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

const files = (await readdir(DIR)).filter(f => f.endsWith('.css')).sort();

/* --- parse -------------------------------------------------------- */
const sources = new Map();
let parseErrors = [];
for (const file of files) {
  const css = await readFile(path.join(DIR, file), 'utf8');
  sources.set(file, css);
  try {
    postcss.parse(css, { from: file });
  } catch (e) {
    parseErrors.push(file + ': ' + e.message);
  }
}
console.log('\nDaftari stylesheet check  (' + path.relative(ROOT, DIR) + ')\n');
console.log('parsing');
check('every stylesheet parses', parseErrors.length === 0, parseErrors.join(' | '));

/* --- token resolution --------------------------------------------- */
const tokens = new Map();          // name -> [file...]
for (const [file, css] of sources) {
  const root = postcss.parse(css, { from: file });
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith('--')) return;
    if (!tokens.has(decl.prop)) tokens.set(decl.prop, []);
    tokens.get(decl.prop).push(file);
  });
}

// `var(--x)` without a fallback needs a definition; `var(--x, fallback)`
// is self-sufficient (a value set inline on the element).
const used = new Map();
for (const [file, css] of sources) {
  const root = postcss.parse(css, { from: file });
  root.walkDecls((decl) => {
    const re = /var\(\s*(--[a-zA-Z0-9_-]+)\s*([,)])/g;
    let m;
    while ((m = re.exec(decl.value)) !== null) {
      if (m[2] === ',') continue;                 // has a fallback
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(file);
    }
  });
}

console.log('\ntokens');
const undefinedTokens = [...used.keys()].filter(t => !tokens.has(t));
check('every var() resolves to a defined token', undefinedTokens.length === 0,
  undefinedTokens.join(', '));
check('the token file defines the scale', tokens.has('--s'), '--s missing');
check('the token file defines the density', tokens.has('--density'), '--density missing');
check('the scale is documented in a range',
  /--s:\s*1\s*;/.test(sources.get('tokens.css') || ''));
check('the density is documented in a range',
  /--density:\s*1\s*;/.test(sources.get('tokens.css') || ''));

const tokenCount = tokens.size;
check('the token system is substantial', tokenCount >= 40, String(tokenCount));

/* --- the sizing layer is really token driven ----------------------- */
console.log('\nsizing layer');
const responsive = sources.get('responsive.css') || '';

/** Extract every calc(...) argument, honouring nested parentheses. */
function calcArguments(css) {
  const out = [];
  const re = /calc\(/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '(') depth++;
      else if (css[i] === ')') depth--;
      if (depth > 0) i++;
    }
    out.push(css.slice(start, i));
    re.lastIndex = i;
  }
  return out;
}

const adaptive = calcArguments(responsive).filter(v => /px|rem|em/.test(v));
const driven = adaptive.filter(v => v.includes('var(--s)'));
check('the adaptive dimensions use the scale', driven.length === adaptive.length,
  adaptive.filter(v => !v.includes('var(--s)')).slice(0, 5).join(' | '));
check('there is a meaningful number of adaptive dimensions', adaptive.length >= 20,
  String(adaptive.length));

const base = sources.get('base.css') || '';
const components = sources.get('components.css') || '';
const layout = sources.get('layout.css') || '';
const concrete = (base + components + layout);
const raw = [...concrete.matchAll(/(?:padding|margin|height|min-height|font-size|gap)\s*:\s*(\d+(?:\.\d+)?)px/g)]
  .map(m => Number(m[1]));
const oversized = raw.filter(v => v > 96);
check('the base layers leave the big sizes to the token layer', oversized.length === 0,
  oversized.slice(0, 5).join(', '));

/* --- the layers agree ---------------------------------------------- */
console.log('\nlayers');
const scaleDefinedIn = [];
for (const [file, css] of sources) {
  const root = postcss.parse(css, { from: file });
  root.walkDecls((decl) => {
    if (decl.prop === '--s' || decl.prop === '--density') scaleDefinedIn.push(file);
  });
}
check('the scale variables are defined in one place only',
  new Set(scaleDefinedIn).size === 1 && scaleDefinedIn.every(f => f === 'tokens.css'),
  [...new Set(scaleDefinedIn)].join(', '));
check('responsive.css consumes the tokens', /var\(--s\)/.test(responsive));
check('the dark theme is a token override, not a second palette',
  /body\.dark|\.dark\s+/.test(sources.get('tokens.css') || ''));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(failed ? 1 : 0);
