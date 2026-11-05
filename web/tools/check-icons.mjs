#!/usr/bin/env node
/**
 * Daftari · icon check
 * -------------------------------------------------------------------
 * Every ic('name') call must name an icon that really exists in the
 * icon set. A typo does not throw - it silently injects the text
 * "undefined" into the markup and shows up in the interface.
 *
 * Usage: node web/tools/check-icons.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src', 'js');

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

const iconsSrc = await readFile(path.join(SRC, '00-icons.js'), 'utf8');
const known = new Set();
const re = /(\w+):\s*'(?:[^'\\]|\\.)*'/g;
let m;
while ((m = re.exec(iconsSrc))) known.add(m[1]);
known.delete('P');

console.log('\nDaftari icon check\n');

const files = (await readdir(SRC)).filter((f) => f.endsWith('.js'));
const missing = [];
let used = 0;
for (const f of files) {
  const src = await readFile(path.join(SRC, f), 'utf8');
  for (const call of src.matchAll(/\bic\(\s*'([A-Za-z0-9_]+)'/g)) {
    used++;
    if (!known.has(call[1])) missing.push(f + ' → ic(\'' + call[1] + '\')');
  }
}

check('the icon set is not empty', known.size > 40, String(known.size));
check('every ic() call names a real icon', missing.length === 0, missing.join(' | '));

// the icons that are used must also be drawable
const drawn = known.size;
console.log('\n  ' + used + ' icon calls, ' + drawn + ' icons defined');
if (missing.length) {
  console.log('\nmissing:');
  for (const x of missing) console.log('  - ' + x);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
