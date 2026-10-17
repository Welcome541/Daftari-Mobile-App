#!/usr/bin/env node
/**
 * Daftari · web build
 * -------------------------------------------------------------------
 * Turns web/src (the editable source tree) into a deployable interface
 * bundle:
 *
 *   1. renders src/index.html, injecting the ordered module list and the
 *      build stamp,
 *   2. copies css / js / lib / icons / extensions,
 *   3. writes version.json - the manifest that makes a bundle
 *      self-describing, verifiable and therefore updatable,
 *   4. mirrors the result into the Android asset folder so the APK ships
 *      exactly what was built here.
 *
 * Usage:
 *   node web/build.mjs [--version 3.0.0] [--build 300] [--channel stable]
 *                      [--out web/dist] [--no-android]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, cp, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(HERE, 'src');
const ANDROID_ASSETS = path.join(ROOT, 'app/src/main/assets/www');

// ------------------------------------------------------------------ args
function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}
const hasFlag = (n) => process.argv.includes('--' + n);

const VERSION = arg('version', readPkgVersion());
const BUILD = parseInt(arg('build', String(Date.now()).slice(-6)), 10);
const CHANNEL = arg('channel', 'stable');
const OUT = path.resolve(ROOT, arg('out', 'web/dist'));
const MIRROR_ANDROID = !hasFlag('no-android');

function readPkgVersion() {
  try {
    const p = JSON.parse(require('node:fs').readFileSync(path.join(HERE, 'package.json'), 'utf8'));
    return p.version || '0.0.0';
  } catch { return '0.0.0'; }
}

// ------------------------------------------------------------------ helpers
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(abs, base)));
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Files that are part of the runtime bundle and copied verbatim.
 *  index.html is NOT here: it is rendered from the template below. */
const BUNDLE_DIRS = ['css', 'js', 'lib', 'icons', 'extensions'];
const BUNDLE_FILES = ['manifest.webmanifest'];

// ------------------------------------------------------------------ build
async function main() {
  const stamp = {
    version: VERSION,
    build: BUILD,
    channel: CHANNEL,
    generatedAt: new Date().toISOString(),
    modules: []
  };

  // 1. module list - the filename prefix defines the load order
  const jsDir = path.join(SRC, 'js');
  const modules = (await readdir(jsDir)).filter(f => f.endsWith('.js')).sort();
  stamp.modules = modules.map(m => 'js/' + m);

  // 2. render index.html
  const tpl = await readFile(path.join(SRC, 'index.html'), 'utf8');
  const scriptTags = stamp.modules
    .map(m => `<script src="${m}"></script>`)
    .join('\n');
  const html = tpl
    .replace('<!-- @build -->',
      `<script>window.__DF_BUILD=${JSON.stringify(stamp)};</script>`)
    .replace('<!-- @scripts -->', scriptTags);
  if (html.includes('<!-- @build -->') || html.includes('<!-- @scripts -->')) {
    throw new Error('build: placeholders were not replaced');
  }

  // 3. assemble the output tree
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'index.html'), html, 'utf8');
  for (const f of BUNDLE_FILES) {
    const p = path.join(SRC, f);
    if (existsSync(p)) await cp(p, path.join(OUT, f));
  }
  for (const d of BUNDLE_DIRS) {
    const p = path.join(SRC, d);
    if (existsSync(p)) await cp(p, path.join(OUT, d), { recursive: true });
  }

  // 4. manifest - every shipped file is described and hashed
  const files = {};
  const shipped = (await walk(OUT)).filter(f => f !== 'version.json');
  for (const rel of shipped) {
    const buf = await readFile(path.join(OUT, rel));
    files[rel] = { sha256: sha256(buf), size: buf.length };
  }
  const manifest = {
    format: 'dafter-web-bundle',
    formatVersion: 1,
    version: VERSION,
    build: BUILD,
    channel: CHANNEL,
    generatedAt: stamp.generatedAt,
    minAppVersion: '3.0.0',
    appVersion: VERSION,
    files: files
  };
  await writeFile(path.join(OUT, 'version.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // 5. mirror into the Android assets so the APK ships this exact bundle
  if (MIRROR_ANDROID) {
    await rm(ANDROID_ASSETS, { recursive: true, force: true });
    await mkdir(ANDROID_ASSETS, { recursive: true });
    await cp(OUT, ANDROID_ASSETS, { recursive: true });
  }

  // ---------------------------------------------------------------- report
  let total = 0;
  for (const rel of shipped) total += (await stat(path.join(OUT, rel))).size;
  console.log(`Daftari web build  v${VERSION} (#${BUILD}, ${CHANNEL})`);
  console.log(`  modules   : ${modules.length}`);
  console.log(`  files     : ${shipped.length}  (${(total / 1024).toFixed(1)} KiB)`);
  console.log(`  output    : ${path.relative(ROOT, OUT)}`);
  if (MIRROR_ANDROID) console.log(`  android   : ${path.relative(ROOT, ANDROID_ASSETS)}`);
}

main().catch(err => {
  console.error('build failed:', err);
  process.exit(1);
});
