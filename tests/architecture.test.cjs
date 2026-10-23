const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const java = path.resolve('app/src/main/java');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]);
}

test('all Java sources parse (not an Android compilation)', async () => {
  const { parse } = await import('java-parser');
  for (const file of files(java).filter(f => f.endsWith('.java'))) {
    assert.doesNotThrow(() => parse(fs.readFileSync(file, 'utf8')), file);
  }
});

test('activities contain neither archive processing nor direct filesystem writes', () => {
  for (const file of files(java).filter(f => f.endsWith('Activity.java'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /ZipInputStream|FileOutputStream|GZIPOutputStream|@JavascriptInterface/);
  }
});

test('only bridge.js accesses the native JavascriptInterface', () => {
  const web = path.resolve('app/src/main/assets/www/js');
  for (const file of files(web).filter(f => !f.endsWith('/bridge.js'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\b(?:window\.)?Daftari\s*\./);
  }
});

test('storage domain is Android-free and URI facade contains no archive workflow', () => {
  const storage = path.join(java, 'ai/arena/dafter/offline/storage');
  for (const file of files(storage).filter(f => !f.endsWith('/FileStorageManager.java'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /import android\./);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(storage, 'FileStorageManager.java'), 'utf8'), /ZipInputStream|ZipFile|renameTo|GZIPOutputStream/);
});

test('speech UI does not own engines, microphones, or replace recording functions', () => {
  const web = path.resolve('app/src/main/assets/www');
  const ui = fs.readFileSync(path.join(web,'js/voice-ui.js'),'utf8');
  assert.doesNotMatch(ui, /voskEngine|whisperEngine|SpeechRecognition|getUserMedia|VoiceEngine/);
  const whisperUI=fs.readFileSync(path.join(web,'lib/whisper/ui.js'),'utf8');
  assert.doesNotMatch(whisperUI, /window\.(startRec|endRec|cancelRec|render)\s*=|originalStart|installRecordingHooks/);
});
