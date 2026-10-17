#!/usr/bin/env node
/**
 * Daftari · stylesheet parity
 * -------------------------------------------------------------------
 * Proves that splitting the original monolithic stylesheet into the
 * token driven layers did not lose a single rule.
 *
 * The reference is the <style> block of the original index.html
 * (git show HEAD:app/src/main/assets/www/index.html). Both sides are
 * parsed and their selector sets are compared:
 *
 *   - every selector of the original must exist in the new layers
 *   - every declaration of the original must still be declared
 *     (the value may differ: that is the point of the token layer)
 *
 * Usage: node web/tools/check-css-parity.mjs [--ref <path to original html>]
 */
import postcss from 'postcss';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}

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

/** The selector of a rule, without the pseudo classes it may carry. */
function keyOf(selector) {
  return selector.split(',').map(s => s.trim()).filter(Boolean)
    .map(s => s.replace(/:(hover|active|focus|focus-visible|disabled|not\(focus-visible\))\b/g, '').trim())
    .join(' | ');
}

/**
 * Collect every rule with the context it lives in, so a rule that moved
 * out of its @media block counts as a change.
 */
function collect(css, into) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    const context = [];
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule') {
        const name = parent.name.toLowerCase();
        if (name === 'keyframes') context.push('@' + name + ' ' + parent.params);
        else if (name === 'media') context.push('@media ' + parent.params.replace(/\s+/g, ' ').trim());
      }
      parent = parent.parent;
    }
    const key = (context.length ? context.join(' > ') + ' >> ' : '') + keyOf(rule.selector);
    if (!into.has(key)) into.set(key, new Set());
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) return;      // token definitions
      into.get(key).add(decl.prop);
    });
  });
}

const refPath = arg('ref', null);
let original = '';
if (refPath) {
  original = await readFile(refPath, 'utf8');
} else {
  original = execFileSync('git', ['show', 'HEAD:app/src/main/assets/www/index.html'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const styleMatch = original.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error('no <style> block found in the reference');
  process.exit(1);
}
const referenceCss = styleMatch[1];

const dir = path.join(ROOT, 'web/src/css');
const files = (await readdir(dir)).filter(f => f.endsWith('.css')).sort();
let layered = '';
for (const file of files) layered += await readFile(path.join(dir, file), 'utf8');

const refRules = new Map();
collect(referenceCss, refRules);
const newRules = new Map();
collect(layered, newRules);

console.log('\nDaftari stylesheet parity\n');
console.log('reference: the original inline <style> block');
console.log('new      : ' + files.join(', ') + '\n');

const missingSelectors = [...refRules.keys()].filter(k => !newRules.has(k));
check('no selector was lost', missingSelectors.length === 0,
  missingSelectors.slice(0, 8).join(' | '));

const missingProps = [];
for (const [key, props] of refRules) {
  const target = newRules.get(key);
  if (!target) continue;
  for (const prop of props) {
    if (!target.has(prop)) missingProps.push(key + ' { ' + prop + ' }');
  }
}
check('no declaration was lost', missingProps.length === 0,
  missingProps.slice(0, 8).join(' | '));

const extra = [...newRules.keys()].filter(k => !refRules.has(k));
console.log('\n  reference rules: ' + refRules.size);
console.log('  new rules      : ' + newRules.size);
console.log('  added by the token layer: ' + extra.length);
if (extra.length) console.log('    ' + extra.slice(0, 10).join('\n    '));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(failed ? 1 : 0);
