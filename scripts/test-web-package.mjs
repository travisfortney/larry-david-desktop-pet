import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'web/package.json'), 'utf8'));
const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
const archive = join(root, 'dist', filename);
const files = [
  'README.md', 'package.json', 'larry.js', 'larry.css',
  'assets/larry.webp', 'assets/larry-run-strip.webp',
  'assets/larry-look-strip.webp', 'assets/larry-extra-strip.webp', 'assets/larry-still.png',
].sort();

test('the web tarball contains only the module, styles, five images and usage files', () => {
  const packed = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .trim().split('\n').map(path => path.replace(/^package\//, '')).sort();
  assert.deepEqual(packed, files);
  assert.equal(manifest.private, false);
  assert.equal(manifest.publishConfig.registry, 'https://npm.pkg.github.com');
  assert.equal(manifest.publishConfig.access, 'restricted');
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'https://github.com/travisfortney/larry-david-desktop-pet.git',
    directory: 'web',
  });
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.ok(statSync(archive).size < 500_000, 'Keep the browser package under 500 kB.');
});

test('a separate consumer installs the tarball offline and resolves its exports', t => {
  const consumer = mkdtempSync(join(tmpdir(), 'larry-web-consumer-'));
  t.after(() => rmSync(consumer, { recursive: true, force: true }));
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', [
    'install', archive, '--offline', '--ignore-scripts', '--package-lock=false',
    '--no-audit', '--no-fund', '--cache', join(consumer, '.npm-cache'),
  ], { cwd: consumer, stdio: 'pipe' });
  const installed = join(consumer, 'node_modules', ...manifest.name.split('/'));
  for (const file of files.filter(file => file !== 'package.json')) {
    assert.deepEqual(readFileSync(join(installed, file)), readFileSync(join(root, 'web', file)), file);
  }
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { existsSync } from 'node:fs';
    import { mountLarry } from '@travisfortney/larry';
    assert.equal(typeof mountLarry, 'function');
    for (const path of ['larry.css', 'assets/larry.webp', 'assets/larry-run-strip.webp',
      'assets/larry-look-strip.webp', 'assets/larry-extra-strip.webp', 'assets/larry-still.png']) {
      assert.ok(existsSync(new URL(import.meta.resolve('@travisfortney/larry/' + path))), path);
    }
    console.log('Consumer exports passed');
  `], { cwd: consumer, encoding: 'utf8' });
  assert.match(result, /Consumer exports passed/);
});
