/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const deploy = require('./lib/deploy');

const readDirectoryRecursive = deploy._readDirectoryRecursive;
const guessMimeType = deploy._guessMimeType;
const resolveMimeOverride = deploy._resolveMimeOverride;

describe('readDirectoryRecursive', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mygensite-deploy-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const write = (rel, content = 'x') => {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  it('reads nested files with forward-slash relative paths', () => {
    write('index.html');
    write('assets/style.css');
    write('assets/img/logo.png');

    const files = readDirectoryRecursive(tmpDir);
    const names = files.map(f => f.name).sort();
    assert.deepStrictEqual(names, ['assets/img/logo.png', 'assets/style.css', 'index.html']);
    for (const name of names) {
      assert.ok(!name.includes('\\'), `path should use forward slashes: ${name}`);
    }
  });

  it('skips hidden files and hidden directories (.DS_Store, .git, .gitignore)', () => {
    write('index.html');
    write('.DS_Store');
    write('.gitignore');
    write('.git/config');
    write('.git/objects/ab/cdef');
    write('assets/.DS_Store');
    write('assets/style.css');

    const files = readDirectoryRecursive(tmpDir);
    const names = files.map(f => f.name).sort();
    assert.deepStrictEqual(names, ['assets/style.css', 'index.html']);
  });

  it('sets contentType from extension for every file', () => {
    write('index.html');
    write('app.wasm');
    write('README.md');

    const files = readDirectoryRecursive(tmpDir);
    const byName = Object.fromEntries(files.map(f => [f.name, f.contentType]));
    assert.strictEqual(byName['index.html'], 'text/html');
    assert.strictEqual(byName['app.wasm'], 'application/wasm');
    assert.strictEqual(byName['README.md'], 'text/markdown');
  });

  it('follows file symlinks and skips directory symlinks and broken symlinks', () => {
    write('real/target.txt', 'hello');
    fs.symlinkSync(path.join(tmpDir, 'real/target.txt'), path.join(tmpDir, 'linked.txt'));
    fs.symlinkSync(path.join(tmpDir, 'real'), path.join(tmpDir, 'linked-dir'));
    fs.symlinkSync(path.join(tmpDir, 'does-not-exist'), path.join(tmpDir, 'broken.txt'));

    const files = readDirectoryRecursive(tmpDir);
    const names = files.map(f => f.name).sort();
    assert.deepStrictEqual(names, ['linked.txt', 'real/target.txt']);
    const linked = files.find(f => f.name === 'linked.txt');
    assert.strictEqual(linked.content.toString(), 'hello');
  });
});

describe('guessMimeType', () => {
  it('covers common static-site types', () => {
    assert.strictEqual(guessMimeType('a.html'), 'text/html');
    assert.strictEqual(guessMimeType('a.css'), 'text/css');
    assert.strictEqual(guessMimeType('a.js'), 'application/javascript');
    assert.strictEqual(guessMimeType('a.woff2'), 'font/woff2');
    assert.strictEqual(guessMimeType('a.svg'), 'image/svg+xml');
  });

  it('covers media, wasm and text formats', () => {
    assert.strictEqual(guessMimeType('a.mp4'), 'video/mp4');
    assert.strictEqual(guessMimeType('a.webm'), 'video/webm');
    assert.strictEqual(guessMimeType('a.mp3'), 'audio/mpeg');
    assert.strictEqual(guessMimeType('a.avif'), 'image/avif');
    assert.strictEqual(guessMimeType('a.wasm'), 'application/wasm');
    assert.strictEqual(guessMimeType('a.md'), 'text/markdown');
    assert.strictEqual(guessMimeType('a.csv'), 'text/csv');
    assert.strictEqual(guessMimeType('a.yml'), 'text/yaml');
  });

  it('is case-insensitive and falls back to octet-stream', () => {
    assert.strictEqual(guessMimeType('A.HTML'), 'text/html');
    assert.strictEqual(guessMimeType('a.xyz'), 'application/octet-stream');
    assert.strictEqual(guessMimeType('noext'), 'application/octet-stream');
  });
});

describe('resolveMimeOverride (mime_types option)', () => {
  it('matches by extension with or without a dot', () => {
    assert.strictEqual(resolveMimeOverride('model.glb', { '.glb': 'model/gltf-binary' }), 'model/gltf-binary');
    assert.strictEqual(resolveMimeOverride('model.glb', { glb: 'model/gltf-binary' }), 'model/gltf-binary');
    assert.strictEqual(resolveMimeOverride('deep/dir/model.GLB', { '.glb': 'model/gltf-binary' }), 'model/gltf-binary');
  });

  it('exact relative path wins over extension', () => {
    const map = { '.bin': 'application/octet-stream', 'data/geo.bin': 'model/gltf-binary' };
    assert.strictEqual(resolveMimeOverride('data/geo.bin', map), 'model/gltf-binary');
    assert.strictEqual(resolveMimeOverride('other/file.bin', map), 'application/octet-stream');
  });

  it('supports a function form receiving (name, defaultType)', () => {
    const fn = (name, def) => (name.endsWith('.dat') ? 'application/json' : undefined);
    assert.strictEqual(resolveMimeOverride('a.dat', fn, 'application/octet-stream'), 'application/json');
    assert.strictEqual(resolveMimeOverride('a.css', fn, 'text/css'), undefined);
  });

  it('returns undefined when there is no match or no map', () => {
    assert.strictEqual(resolveMimeOverride('a.css', undefined), undefined);
    assert.strictEqual(resolveMimeOverride('a.css', {}), undefined);
    assert.strictEqual(resolveMimeOverride('noext', { '.glb': 'model/gltf-binary' }), undefined);
  });
});
