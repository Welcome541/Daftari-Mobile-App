#!/usr/bin/env node
/**
 * Daftari · update packager
 * -------------------------------------------------------------------
 * Produces a self-describing update package from a built bundle.
 *
 *   node web/tools/pack-update.mjs --in web/dist --out dist/Daftari-3.0.0.zip
 *
 * The archive is a plain zip that contains version.json plus the whole
 * web root. version.json lists the SHA-256 and the size of every file, so
 * the receiver can prove the package is intact before installing it - on
 * the device (Java) and in the browser (JavaScript) alike.
 *
 * No third-party dependency: the zip writer below emits standard deflate
 * entries using Node's built-in zlib.
 */
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  return process.argv[i + 1];
}

const IN = path.resolve(ROOT, arg('in', 'web/dist'));
const OUT = path.resolve(ROOT, arg('out', 'dist/dafter-update.zip'));

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(abs, base)));
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

// ------------------------------------------------------------------- crc32
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// ------------------------------------------------------------- dos time
function dosTime(date) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 31);
  const day = (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) |
    (date.getDate() & 31);
  return { time: time & 0xFFFF, date: day & 0xFFFF };
}

// ------------------------------------------------------------------- zip
/**
 * Build a zip archive from a list of {name, data}.
 * Deflate (method 8) is used, falling back to store (method 0).
 */
function makeZip(files, when = new Date()) {
  const { time, date } = dosTime(when);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const raw = f.data;
    const deflated = deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0x0800, 6);        // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031E, 4);      // made by: unix, spec 3.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);          // extra
    central.writeUInt16LE(0, 32);          // comment
    central.writeUInt16LE(0, 34);          // disk
    central.writeUInt16LE(0, 36);          // internal attrs
    central.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

// ------------------------------------------------------------------ main
async function main() {
  if (!existsSync(IN)) throw new Error('input bundle not found: ' + IN);

  const rels = (await walk(IN)).filter(f => f !== 'version.json');
  const files = [];
  for (const rel of rels) {
    files.push({ name: rel, data: await readFile(path.join(IN, rel)) });
  }

  // rebuild the manifest so it always describes exactly what we ship
  const manifest = {
    format: 'dafter-web-bundle',
    formatVersion: 1,
    version: arg('version', '0.0.0'),
    build: parseInt(arg('build', '0'), 10),
    channel: arg('channel', 'stable'),
    generatedAt: new Date().toISOString(),
    minAppVersion: arg('min', '3.0.0'),
    files: {}
  };
  for (const f of files) {
    manifest.files[f.name] = { sha256: createHash('sha256').update(f.data).digest('hex'), size: f.data.length };
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  files.unshift({ name: 'version.json', data: manifestBuf });

  const zip = makeZip(files);
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, zip);

  console.log(`Daftari update package`);
  console.log(`  version : ${manifest.version} (#${manifest.build}, ${manifest.channel})`);
  console.log(`  files   : ${files.length}`);
  console.log(`  size    : ${(zip.length / 1024).toFixed(1)} KiB`);
  console.log(`  output  : ${path.relative(ROOT, OUT)}`);
  console.log(`  sha256  : ${createHash('sha256').update(zip).digest('hex')}`);
}

main().catch(err => {
  console.error('pack failed:', err);
  process.exit(1);
});
