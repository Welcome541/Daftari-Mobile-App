#!/usr/bin/env node
/**
 * Daftari · update round trip
 * -------------------------------------------------------------------
 * Proves that the update pipeline is coherent end to end:
 *
 *   1. a bundle is built
 *   2. it is packed into an update package (web/tools/pack-update.mjs)
 *   3. the package is read back with the *application's own* ZIP reader
 *      and verified with the *application's own* SHA-256 check
 *   4. a tampered package is rejected
 *
 * The same manifest format is read by the native installer
 * (app/src/main/java/ai/arena/dafter/offline/update/UpdateInstaller.java),
 * so a package that passes here is accepted on the device as well.
 *
 * Usage: node web/tools/check-update.mjs
 */
import vm from 'node:vm';
import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

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

/* ------------------------------------------------------------------ */
/** Load the update manager in a sandbox with the browser APIs it uses. */
async function loadUpdater() {
  const source = await readFile(path.join(ROOT, 'web/src/js/72-update.js'), 'utf8');
  const sandbox = {
    console,
    crypto: webcrypto,
    Blob,
    Response,
    Request,
    Headers,
    DecompressionStream,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
    localStorage: {
      _v: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._v, k) ? this._v[k] : null; },
      setItem(k, v) { this._v[k] = String(v); },
      removeItem(k) { delete this._v[k]; }
    },
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    document: { createElement: () => ({}), head: { appendChild() { } } },
    DaftariApp: {
      version: '3.0.0',
      satisfies(range) {
        const m = String(range).match(/^(>=|>|<=|<|=)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
        if (!m) return true;
        const cur = '3.0.0'.split('.').map(Number);
        const want = [Number(m[2]) || 0, Number(m[3]) || 0, Number(m[4]) || 0];
        const cmp = (cur[0] - want[0]) || (cur[1] - want[1]) || (cur[2] - want[2]);
        switch (m[1]) {
          case '>=': return cmp >= 0;
          case '>': return cmp > 0;
          case '<=': return cmp <= 0;
          case '<': return cmp < 0;
          default: return cmp === 0;
        }
      }
    },
    t: (k) => k
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: '72-update.js' });
  // `const` bindings live in the context's lexical scope, not on the sandbox
  return vm.runInContext('Updater', sandbox);
}

/* ------------------------------------------------------------------ */
async function main() {
  console.log('\nDaftari update round trip\n');

  /* --- 1. build --------------------------------------------------- */
  console.log('build');
  const dist = path.join(ROOT, 'web/dist');
  execFileSync('node', [path.join(ROOT, 'web/build.mjs'), '--version', '3.0.0',
    '--build', '300', '--channel', 'stable'], { stdio: 'pipe' });
  check('the bundle was built', existsSync(path.join(dist, 'version.json')));

  /* --- 2. pack ---------------------------------------------------- */
  console.log('\npackage');
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'dafter-update-'));
  const zipPath = path.join(tmp, 'update.zip');
  execFileSync('node', [path.join(ROOT, 'web/tools/pack-update.mjs'),
    '--in', 'web/dist', '--out', zipPath,
    '--version', '3.0.0', '--build', '300', '--channel', 'stable'], { stdio: 'pipe' });
  const zipBytes = await readFile(zipPath);
  check('the package was produced', zipBytes.length > 0, zipBytes.length + ' bytes');
  check('the package is a zip archive', zipBytes[0] === 0x50 && zipBytes[1] === 0x4B);

  /* --- 3. read it back with the app's own reader ------------------- */
  console.log('\nverification (using the application code)');
  const Updater = await loadUpdater();
  check('the update manager loaded', !!Updater);

  const file = {
    name: 'update.zip',
    arrayBuffer: async () => zipBytes.buffer.slice(
      zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength)
  };

  const zip = await Updater.readZip(file);
  check('the archive directory is readable', zip.entries.length > 0, zip.entries.length + ' entries');
  const names = zip.entries.map(e => e.name);
  check('the manifest is inside the package', names.includes('version.json'));
  check('the interface is inside the package', names.includes('index.html'));
  check('the modules are inside the package', names.some(n => /^js\/.*\.js$/.test(n)));

  const manifestEntry = zip.entries.find(e => e.name === 'version.json');
  const manifest = JSON.parse(new TextDecoder().decode(await zip.read(manifestEntry)));
  check('the manifest declares the bundle format', manifest.format === 'dafter-web-bundle');
  check('the manifest carries the version', manifest.version === '3.0.0', manifest.version);
  check('the manifest lists every file', Object.keys(manifest.files).length === names.length - 1,
    Object.keys(manifest.files).length + ' vs ' + (names.length - 1));

  // verify every declared file byte for byte
  let mismatches = [];
  for (const [rel, spec] of Object.entries(manifest.files)) {
    const entry = zip.entries.find(e => e.name === rel);
    if (!entry) { mismatches.push(rel + ':missing'); continue; }
    const bytes = await zip.read(entry);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== spec.sha256) mismatches.push(rel + ':hash');
    if (bytes.length !== spec.size) mismatches.push(rel + ':size');
  }
  check('every file in the package matches the manifest', mismatches.length === 0,
    mismatches.slice(0, 3).join(', '));

  // the app's own verification path
  const verdict = await Updater.verifyPackage(file);
  check('the application accepts the package', verdict.ok === true, verdict.error || '');
  check('the accepted package reports its version', verdict.manifest && verdict.manifest.version === '3.0.0');

  /* --- 4. a tampered package must be refused ----------------------- */
  console.log('\ntampering');
  const tampered = Buffer.from(zipBytes);
  // flip a byte inside the first deflated entry's payload
  const idx = tampered.indexOf(Buffer.from('js/00-icons.js'));
  check('the package contains a known file', idx > 0);
  if (idx > 0) {
    // corrupt the deflate stream that follows the local header
    const corruptAt = Math.min(tampered.length - 1, idx + 40);
    tampered[corruptAt] = tampered[corruptAt] ^ 0xFF;
    const badFile = {
      name: 'update.zip',
      arrayBuffer: async () => tampered.buffer.slice(
        tampered.byteOffset, tampered.byteOffset + tampered.byteLength)
    };
    const bad = await Updater.verifyPackage(badFile);
    check('a corrupted package is refused', bad.ok === false, JSON.stringify(bad.error));
  }

  // a package whose manifest lies about a hash must be refused
  const lying = JSON.parse(JSON.stringify(manifest));
  lying.files['index.html'].sha256 = '0'.repeat(64);
  const lyingZip = await readFile(zipPath);
  const lyingEntry = zip.entries.find(e => e.name === 'version.json');
  const original = await zip.read(lyingEntry);
  const rebuilt = await rebuildZipWithManifest(zip, lying, original);
  const lyingFile = {
    name: 'update.zip',
    arrayBuffer: async () => rebuilt.buffer.slice(
      rebuilt.byteOffset, rebuilt.byteOffset + rebuilt.byteLength)
  };
  const lyingVerdict = await Updater.verifyPackage(lyingFile);
  check('a package with a false hash is refused', lyingVerdict.ok === false,
    JSON.stringify(lyingVerdict.error));
  check('the failure names the offending file',
    String(lyingVerdict.error || '').indexOf('index.html') >= 0, lyingVerdict.error);

  /* --- 5. the native installer must agree -------------------------- */
  console.log('\nnative parity (UpdateInstaller.java algorithm)');
  const nativeAccepts = await nativeVerify(zip, manifest);
  check('the native verifier accepts the package', nativeAccepts.problem === null,
    nativeAccepts.problem || '');
  check('the native verifier sees every declared file', nativeAccepts.checked === names.length - 1,
    nativeAccepts.checked + ' vs ' + (names.length - 1));
  check('the native verifier finds no undeclared file', nativeAccepts.undeclared.length === 0,
    nativeAccepts.undeclared.join(', '));
  const nativeRejects = await nativeVerify(zip, lying);
  check('the native verifier rejects a false hash', nativeRejects.problem !== null,
    nativeRejects.problem || 'accepted!');

  /* --- 6. path safety in the archive ------------------------------ */
  console.log('\narchive safety');
  check('traversal paths are refused', Updater.safePath('../../etc/passwd') === null);
  check('windows paths are refused', Updater.safePath('C:\\windows\\system32') === null);
  check('null bytes are refused', Updater.safePath('js/ .js') === null);
  check('nested paths are kept', Updater.safePath('lib/whisper/engine.js') === 'lib/whisper/engine.js');
  check('dot segments are removed', Updater.safePath('./js/./x.js') === 'js/x.js');

  await rm(tmp, { recursive: true, force: true });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(failed ? 1 : 0);
}


/**
 * The exact algorithm of UpdateInstaller.verify(): resolve every declared
 * file, compare its size and SHA-256, then make sure the archive carries
 * nothing that the manifest does not describe.
 */
async function nativeVerify(zip, manifest) {
  const files = manifest.files || {};
  const declared = new Set(Object.keys(files));
  const onDisk = new Set();
  const undeclared = [];
  let checked = 0;

  for (const entry of zip.entries) {
    if (entry.name === 'version.json') continue;
    // WebPaths.normalize: drop empty and '.' segments, reject '..'
    const parts = entry.name.replace(/\\/g, '/').split('/').filter(p => p && p !== '.');
    if (parts.includes('..')) return { problem: 'unsafe:' + entry.name, checked, undeclared };
    const rel = parts.join('/');
    onDisk.add(rel);
    if (!declared.has(rel)) undeclared.push(rel);
  }

  for (const [rel, spec] of Object.entries(files)) {
    const entry = zip.entries.find(e => e.name === rel);
    if (!entry) return { problem: 'missing:' + rel, checked, undeclared };
    const bytes = await zip.read(entry);
    if (typeof spec.size === 'number' && bytes.length !== spec.size) {
      return { problem: 'size:' + rel, checked, undeclared };
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (spec.sha256 && hash.toLowerCase() !== String(spec.sha256).toLowerCase()) {
      return { problem: 'hash:' + rel, checked, undeclared };
    }
    checked++;
  }
  return { problem: undeclared.length ? 'undeclared:' + undeclared[0] : null, checked, undeclared };
}

/**
 * Rebuild the package with a doctored manifest, so the hash check can be
 * exercised without corrupting the compressed payload.
 */
async function rebuildZipWithManifest(zip, newManifest, originalBytes) {
  const { deflateRawSync } = await import('node:zlib');
  const CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };

  const files = [];
  for (const entry of zip.entries) {
    const data = entry.name === 'version.json'
      ? Buffer.from(JSON.stringify(newManifest, null, 2), 'utf8')
      : Buffer.from(await zip.read(entry));
    files.push({ name: entry.name, data, method: entry.method, csize: entry.csize });
  }

  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const deflated = deflateRawSync(f.data, { level: 9 });
    const useDeflate = deflated.length < f.data.length;
    const body = useDeflate ? deflated : f.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031E, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

main().catch(err => {
  console.error('check failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
