#!/usr/bin/env node
/**
 * Daftari · development server
 * -------------------------------------------------------------------
 * Serves the built interface over http so it can be opened in a browser.
 *
 *   node web/tools/serve.mjs [--dir web/dist] [--port 8080] [--host 0.0.0.0]
 *
 * The Android application serves the same bundle from a synthetic secure
 * origin; this server mimics that for the web build, so the interface
 * behaves identically in both places.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
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

const DIR = path.resolve(ROOT, arg('dir', 'web/dist'));
const PORT = parseInt(arg('port', '8080'), 10);
const HOST = arg('host', '0.0.0.0');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.zip': 'application/zip'
};

if (!existsSync(path.join(DIR, 'index.html'))) {
  console.error('no bundle at ' + DIR + ' - run `node web/build.mjs` first');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    const file = path.join(DIR, rel);
    if (!file.startsWith(DIR) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — ' + rel);
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 — ' + (e && e.message));
  }
});

server.listen(PORT, HOST, async () => {
  const files = await readdir(DIR, { withFileTypes: true });
  console.log('Daftari development server');
  console.log('  root   : ' + DIR);
  console.log('  listen : http://' + HOST + ':' + PORT + '/');
  console.log('  entries: ' + files.map(f => f.name).join(', '));
});
