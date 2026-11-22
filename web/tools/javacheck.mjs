// Parse every Java source file and report syntax errors.
import { parse } from 'java-parser';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.argv[2] || '/home/user/Daftari-Mobile-App/app/src/main/java';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs)));
    else if (e.name.endsWith('.java')) out.push(abs);
  }
  return out.sort();
}

const files = await walk(ROOT);
let bad = 0;
for (const f of files) {
  const src = await readFile(f, 'utf8');
  try {
    parse(src);
    console.log('OK   ' + path.relative(ROOT, f));
  } catch (e) {
    bad++;
    console.log('FAIL ' + path.relative(ROOT, f));
    console.log('     ' + String(e.message).split('\n').slice(0, 6).join('\n     '));
  }
}
console.log(`\n${files.length} files, ${bad} with syntax errors`);
process.exit(bad ? 1 : 0);
