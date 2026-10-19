import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'web/package.json'), 'utf8'));
const archive = join(root, 'dist', `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`);
const engines = await import(process.env.LARRY_PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.LARRY_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browserName)) throw new Error('Unknown test browser.');
let consumer, server, browser, url;
const errors = [];

before(async () => {
  consumer = mkdtempSync(join(tmpdir(), 'larry-web-browser-'));
  const publicRoot = join(consumer, 'public');
  mkdirSync(publicRoot);
  execFileSync('tar', ['-xzf', archive, '-C', publicRoot]);
  renameSync(join(publicRoot, 'package'), join(publicRoot, 'larry'));
  writeFileSync(join(publicRoot, 'index.html'), `<!doctype html><html lang="en">
    <meta name="viewport" content="width=device-width"><title>Larry</title>
    <link rel="icon" href="data:,"><link rel="stylesheet" href="/larry/larry.css">
    <style>body { margin: 0; min-height: 100vh; background: #141f27; color: #e5edf0; }
      button { margin: 20px; padding: 10px; }</style>
    <body><button id="control" onclick="this.textContent = 'Clicked'">Page control</button>
    <a id="watched" href="#notes">Notes</a><button id="secret">Discover</button>
    <dialog id="notes"><p>Page notes</p><button onclick="this.closest('dialog').close()">Close</button></dialog>
    <script type="module">import { mountLarry } from '/larry/larry.js';
      window.mountLarry = mountLarry;</script></body></html>`);
  server = createServer((request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = resolve(publicRoot, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
      if (relative(publicRoot, file).startsWith('..')) throw new Error('Outside consumer');
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      response.end(readFileSync(file));
    } catch { response.writeHead(404); response.end('Missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
  browser = await engines[browserName].launch({ ...(browserName === 'chromium' ? { channel: 'chrome' } : {}), headless: true });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (consumer) rmSync(consumer, { recursive: true, force: true });
  assert.deepEqual(errors, []);
});

async function pageFor(t, options = {}) {
  const settings = { viewport: { width: 960, height: 720 }, ...options };
  if (browserName === 'firefox') delete settings.isMobile;
  const context = await browser.newContext(settings);
  t.after(() => context.close());
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(url).origin) {
      errors.push('Unexpected external request'); return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.testHidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.testHidden });

  });
  await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.mountLarry === 'function');
  await page.evaluate(() => {
    const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    window.intervals = new Set();
    window.setInterval = (...args) => { const id = set(...args); window.intervals.add(id); return id; };
    window.clearInterval = id => { window.intervals.delete(id); clear(id); };
  });
  return page;
}

async function motion(page, preference) {
  await page.evaluate(preference => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    window.motionChanged = query.matches === (preference === 'reduce') ? Promise.resolve(true)
      : new Promise(resolve => query.addEventListener('change', () => resolve(true), { once: true }));
  }, preference);
  await page.emulateMedia({ reducedMotion: preference });
  await page.evaluate(() => window.motionChanged);
}

async function mount(page, options = {}) {
  await page.evaluate(options => window.larry = window.mountLarry({ preloadArtwork: true, ...options }), options);
  await page.waitForFunction(() => {
    const image = document.querySelector('#larry img');
    return image?.complete && image.naturalWidth > 0;
  });
}
async function shown(page) {
  await page.waitForFunction(() => !document.querySelector('#pet-layer').hidden && document.querySelector('#larry img').complete);
}
async function capture(page, name) {
  if (!process.env.LARRY_ARTIFACT_DIR) return;
  mkdirSync(process.env.LARRY_ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.LARRY_ARTIFACT_DIR, `${browserName}-${name}.png`) });
}
const hidden = page => page.locator('#pet-layer').evaluate(node => node.hidden);

test('Companion remains the default and still feeds, tracks and cleans up', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  await mount(page);
  assert.equal(await page.locator('#larry').getAttribute('data-mode'), 'companion');
  await capture(page, 'companion-still');
  await page.mouse.click(250, 400); await page.clock.runFor(32);
  assert.equal(await page.locator('#larry').getAttribute('data-eaten'), '1');
  assert.equal(await page.locator('#pet-bubble').isVisible(), true);
  await motion(page, 'no-preference');
  await page.mouse.move(30, 200);
  await page.waitForFunction(() => document.querySelector('#larry').dataset.lookReady === 'true');
  await page.clock.runFor(32);
  assert.notEqual(await page.locator('#larry').getAttribute('data-look-direction'), null);
  await page.getByRole('button', { name: 'Page control' }).click();
  assert.equal(await page.getByRole('button', { name: 'Clicked' }).count(), 1);
  await page.evaluate(() => window.larry.destroy());
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
});

test('Companion loads only the still image for reduced-motion startup and loads poses on demand', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  const artwork = [];
  page.on('request', request => { if (/\.(webp|png)$/.test(request.url())) artwork.push(new URL(request.url()).pathname); });
  await mount(page, { preloadArtwork: false });
  assert.deepEqual(artwork, ['/larry/assets/larry-still.png']);
  await page.mouse.click(250, 400); await page.clock.runFor(32);
  assert.equal(await page.locator('#larry').getAttribute('data-eaten'), '1');
  assert.equal(artwork.includes('/larry/assets/larry-run-strip.webp'), false);
  assert.equal(artwork.includes('/larry/assets/larry-look-strip.webp'), false);
  await motion(page, 'no-preference');
  await page.mouse.move(30, 200);
  await page.waitForFunction(() => document.querySelector('#larry').dataset.lookReady === 'true');
  await page.mouse.click(100, 400);
  await page.waitForFunction(() => document.querySelector('#larry').dataset.walkReady === 'true');
  await page.evaluate(() => window.larry.destroy());
  await page.clock.runFor(60000);
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
});

test('Cameo is explicit, silent, wave-only and restarts its visible time', async t => {
  const page = await pageFor(t);
  const artwork = [];
  page.on('request', request => { if (/\.(webp|png)$/.test(request.url())) artwork.push(new URL(request.url()).pathname); });
  await mount(page, { mode: 'cameo', duration: 1000 });
  assert.equal(await hidden(page), true);
  assert.deepEqual(artwork, ['/larry/assets/larry-still.png']);
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
  await page.evaluate(() => window.larry.show());
  await shown(page);
  assert.equal(await hidden(page), false);
  await page.mouse.click(250, 400); await page.clock.runFor(800);
  assert.equal(await page.locator('.treat').count(), 0);
  assert.equal(await page.locator('#pet-bubble').isVisible(), false);
  await page.evaluate(() => window.larry.show());
  await page.clock.runFor(800); assert.equal(await hidden(page), false);
  await page.clock.runFor(201); assert.equal(await hidden(page), true);
  await page.evaluate(() => { window.larry.show(); window.larry.hide(); });
  assert.equal(await hidden(page), true);
});

test('Greeter appears once for six seconds and never feeds or repeats on activity', async t => {
  const page = await pageFor(t);
  await mount(page, { mode: 'greeter' });
  assert.equal(await hidden(page), false);
  await page.clock.runFor(5900); assert.equal(await hidden(page), false);
  await page.clock.runFor(101); assert.equal(await hidden(page), true);
  await page.mouse.click(250, 400); await page.mouse.move(100, 300);
  await page.clock.runFor(90000);
  assert.equal(await hidden(page), true);
  assert.equal(await page.locator('.treat').count(), 0);
  assert.equal(await page.locator('#pet-bubble').isVisible(), false);
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
});

test('a cancelled slow-loading greeting does not return after the page becomes visible', async t => {
  const page = await pageFor(t);
  let release;
  const ready = new Promise(resolve => release = resolve);
  await page.route('**/larry/assets/larry.webp', async route => { await ready; await route.continue(); });
  await page.evaluate(() => {
    window.larry = window.mountLarry({ mode: 'greeter' });
    window.testHidden = true; document.dispatchEvent(new Event('visibilitychange'));
  });
  release();
  await page.waitForFunction(() => document.querySelector('#larry img').complete);
  await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await hidden(page), true);
  await page.evaluate(() => window.larry.show());
  await shown(page);
  assert.equal(await hidden(page), false);
  await page.evaluate(() => { window.larry.destroy(); window.larry.show(); });
  await page.clock.runFor(10000);
  assert.equal(await page.locator('#pet-layer').count(), 0);
});

test('quiet modes keep mobile layout, reduced motion, teardown and validation intact', async t => {
  const page = await pageFor(t, { viewport: { width: 320, height: 740 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  for (const mode of ['cameo', 'greeter']) {
    await mount(page, { mode });
    await page.evaluate(() => window.larry.show());
    assert.equal(await page.locator('#larry img').isVisible(), true);
    assert.match(await page.locator('#larry img').getAttribute('src'), /larry-still\.png$/);
    assert.equal(await page.locator('#larry').evaluate(node => getComputedStyle(node).margin), '0px');
    const bounds = await page.locator('#larry').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 740);
    await page.touchscreen.tap(160, 350);
    assert.equal(await page.locator('.treat').count(), 0);
    await page.evaluate(() => { window.larry.destroy(); window.larry.destroy(); });
    await page.clock.runFor(10000);
    assert.equal(await page.locator('#pet-layer').count(), 0);
  }
  const failures = await page.evaluate(() => ['unknown', 0, -1, Infinity, '6000'].map(value => {
    try { window.mountLarry(typeof value === 'string' && value !== '6000' ? { mode: value } : { duration: value }); }
    catch (error) { return error.name; }
  }));
  assert.deepEqual(failures, Array(5).fill('RangeError'));
  assert.equal(await page.locator('#pet-layer').count(), 0);
});


test('Inspector follows its dialog without stealing controls or leaving a footer behind', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.larry = window.mountLarry({ mode: 'inspector', dialog: document.querySelector('#notes') }));
  await page.waitForFunction(() => document.querySelector('#larry img').complete);
  assert.equal(await page.locator('.larry-inspection').isVisible(), false);
  await page.locator('#notes').evaluate(node => node.showModal());
  await page.waitForFunction(() => !document.querySelector('.larry-inspection').hidden);
  assert.equal(await page.locator('.larry-inspection #larry').count(), 1);
  assert.equal(await page.locator('#larry').isDisabled(), true);
  assert.match(await page.locator('#larry img').getAttribute('src'), /larry-still\.png$/);
  await capture(page, 'inspector');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.larry-inspection').hidden);
  assert.equal(await hidden(page), true);
  await page.locator('#notes').evaluate(node => node.showModal());
  await page.waitForFunction(() => !document.querySelector('.larry-inspection').hidden);
  await page.evaluate(() => window.larry.destroy());
  assert.equal(await page.locator('.larry-inspection').count(), 0);
  assert.equal(await page.locator('#notes').evaluate(node => node.open), true);
});

test('Page reactions respect hover dwell, keyboard focus and existing link actions', async t => {
  const page = await pageFor(t);
  await mount(page, { mode: 'reactions', hoverTargets: '#watched', duration: 1000 });
  const target = page.locator('#watched');
  await target.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await page.clock.runFor(349); assert.equal(await hidden(page), true);
  await target.dispatchEvent('pointerout', { pointerType: 'mouse' });
  await page.clock.runFor(1000); assert.equal(await hidden(page), true);
  await target.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await page.clock.runFor(351); await shown(page);
  assert.equal(await page.locator('#pet-bubble').isVisible(), false);
  await target.click(); assert.match(page.url(), /#notes$/);
  await page.clock.runFor(1001); assert.equal(await hidden(page), true);
  await target.blur(); await target.focus(); await page.clock.runFor(1); await shown(page);
  await page.evaluate(() => window.larry.destroy());
  await target.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await page.clock.runFor(1000);
  assert.equal(await page.locator('#pet-layer').count(), 0);
});

test('Task buddy shares existing poses, keeps working states still and finishes a gentle success hop', async t => {
  const page = await pageFor(t);
  const artwork = new Set();
  page.on('request', request => { if (/\.(webp|png)$/.test(request.url())) artwork.add(new URL(request.url()).pathname); });
  await mount(page, { mode: 'task-buddy', duration: 1000 });
  await page.evaluate(() => window.larry.react('working'));
  await shown(page);
  await page.waitForFunction(() => !document.querySelector('#larry canvas').hidden);
  await page.clock.runFor(10000); assert.equal(await hidden(page), false);
  assert.equal(await page.locator('#larry').getAttribute('data-state'), 'working');
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
  await capture(page, 'task-buddy-working');
  await page.evaluate(() => window.larry.react('waiting'));
  assert.equal(await hidden(page), false);
  await page.evaluate(() => window.larry.react('success'));
  await page.clock.runFor(330);
  assert.ok(parseFloat(await page.locator('#larry').evaluate(node => node.style.getPropertyValue('--larry-hop'))) < -5);
  await capture(page, 'task-buddy-success');
  await page.clock.runFor(371);
  assert.equal(await page.locator('#larry').evaluate(node => node.style.getPropertyValue('--larry-hop')), '');
  await page.clock.runFor(301); assert.equal(await hidden(page), true);
  assert.deepEqual([...artwork].sort(), ['/larry/assets/larry-extra-strip.webp', '/larry/assets/larry-still.png']);
  await page.evaluate(() => window.larry.react('attention')); await shown(page);
  assert.match(await page.locator('#larry img').getAttribute('src'), /larry\.webp$/);
  await page.evaluate(() => window.larry.react('idle')); assert.equal(await hidden(page), true);
  await motion(page, 'reduce');
  await page.evaluate(() => window.larry.react('success')); await shown(page);
  await page.clock.runFor(330);
  assert.equal(await page.locator('#larry').evaluate(node => node.style.getPropertyValue('--larry-hop')), '');
});

test('Lookout is still, Easter egg uses only its trigger, and both suspend when hidden', async t => {
  const page = await pageFor(t);
  await mount(page, { mode: 'lookout' }); await shown(page);
  await page.clock.runFor(90000); assert.equal(await hidden(page), false);
  assert.match(await page.locator('#larry img').getAttribute('src'), /larry-still\.png$/);
  await capture(page, 'lookout');
  await page.evaluate(() => { window.testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await hidden(page), true);
  await page.evaluate(() => { window.larry.destroy(); window.testHidden = false; document.dispatchEvent(new Event('visibilitychange'));
    window.larry = window.mountLarry({ mode: 'easter-egg', trigger: document.querySelector('#secret'), duration: 1000 }); });
  await page.getByRole('button', { name: 'Page control' }).click(); assert.equal(await hidden(page), true);
  await page.getByRole('button', { name: 'Discover' }).click(); await shown(page);
  await capture(page, 'easter-egg-wave');
  await page.clock.runFor(1001); assert.equal(await hidden(page), true);
  await page.evaluate(() => window.larry.destroy());
  await page.getByRole('button', { name: 'Discover' }).click();
  assert.equal(await page.locator('#pet-layer').count(), 0);
});

test('Every quiet preset fits narrow screens and stays decorative', async t => {
  const page = await pageFor(t, { viewport: { width: 320, height: 740 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  for (const mode of ['cameo', 'greeter', 'reactions', 'task-buddy', 'lookout', 'easter-egg']) {
    await mount(page, { mode });
    await page.evaluate(() => window.larry.show()); await shown(page);
    const bounds = await page.locator('#larry').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320 && bounds.y >= 0 && bounds.y + bounds.height <= 740, mode);
    assert.equal(await page.locator('#pet-layer').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#larry').getAttribute('tabindex'), '-1');
    assert.match(await page.locator('#larry img').getAttribute('src'), /larry-still\.png$/);
    await capture(page, `mobile-${mode}`);
    await page.evaluate(() => window.larry.destroy());
  }
  await page.evaluate(() => window.larry = window.mountLarry({ mode: 'inspector', dialog: document.querySelector('#notes') }));
  await page.locator('#notes').evaluate(node => node.showModal());
  await page.waitForFunction(() => !document.querySelector('.larry-inspection').hidden);
  const bounds = await page.locator('#larry').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  await capture(page, 'mobile-inspector');
});

test('A failed wave falls back to the original still and missing atlases keep feeding functional', async t => {
  const page = await pageFor(t);
  await page.route('**/*.webp', route => route.abort());
  await mount(page, { mode: 'cameo' });
  await page.evaluate(() => window.larry.show()); await shown(page);
  await page.waitForFunction(() => document.querySelector('#larry img').src.endsWith('larry-still.png'));
  await capture(page, 'fallback');
  await page.evaluate(() => window.larry.destroy());
  await mount(page);
  await page.waitForFunction(() => document.querySelector('#larry').dataset.walkReady === 'failed');
  await motion(page, 'reduce');
  await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.mouse.click(250, 400); await page.clock.runFor(32);
  assert.equal(await page.locator('#larry').getAttribute('data-eaten'), '1');
  assert.equal(await page.locator('#pet-bubble').isVisible(), true);
  await page.evaluate(() => window.larry.destroy());
  const missing = await pageFor(t);
  await missing.route('**/larry/assets/*', route => route.abort());
  await missing.evaluate(() => { window.larry = window.mountLarry({ mode: 'greeter' }); });
  await missing.waitForFunction(() => document.querySelector('#larry').dataset.artworkFailed === 'true');
  assert.equal(await hidden(missing), true);
});

test('Hidden Companion cancels movement and idle work without a burst on return', async t => {
  const page = await pageFor(t);
  await mount(page);
  await page.mouse.click(50, 400); await page.clock.runFor(100);
  assert.equal(await page.locator('.treat').count(), 1);
  await page.evaluate(() => { window.testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.evaluate(() => window.intervals.size), 0);
  assert.equal(await page.locator('.treat').count(), 0);
  const transform = await page.locator('#larry').getAttribute('style');
  await page.clock.runFor(120000);
  assert.equal(await page.locator('#larry').getAttribute('style'), transform);
  assert.equal(await page.locator('#pet-bubble').isVisible(), false);
  assert.match(await page.locator('#larry img').getAttribute('src'), /larry-still\.png$/);
  await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(1000);
  assert.equal(await page.evaluate(() => window.intervals.size), 1);
  assert.equal(await page.locator('#pet-bubble').isVisible(), false);
  await page.clock.runFor(30000);
  assert.equal(await page.locator('#larry').getAttribute('data-state'), 'sleepy');
  assert.equal(await page.locator('.treat').count(), 0);
});

test('Travel speed is stable at 60 and 120 Hz with at most twenty sprite paints per second', async t => {
  const page = await pageFor(t);
  const samples = [];
  for (const hz of [60, 120]) {
    await mount(page);
    await page.waitForFunction(() => ['walkReady', 'lookReady', 'extraReady'].every(key => document.querySelector('#larry').dataset[key] === 'true'));
    const result = await page.evaluate(hz => {
      let next = 0, paints = 0;
      const frames = new Map(), request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
      window.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
      window.cancelAnimationFrame = id => frames.delete(id);
      const pet = document.querySelector('#larry'), painter = pet.querySelector('canvas').getContext('2d');
      const draw = painter.drawImage;
      painter.drawImage = function (...args) { paints++; return draw.apply(this, args); };
      const start = pet.getBoundingClientRect();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: start.y + start.height - 11 }));
      for (let tick = 1; tick <= hz; tick++) {
        const callbacks = [...frames.values()]; frames.clear();
        for (const callback of callbacks) callback(1000 + tick * 1000 / hz);
      }
      const end = pet.getBoundingClientRect();
      const result = { distance: start.x - end.x, paints, transform: pet.style.transform, pending: frames.size };
      window.larry.destroy();
      result.afterDestroy = frames.size;
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel; painter.drawImage = draw;
      return result;
    }, hz);
    samples.push(result);
    assert.ok(result.distance > 238 && result.distance < 243, JSON.stringify({ hz, ...result }));
    assert.ok(result.paints <= 20 && result.paints >= 8, JSON.stringify({ hz, ...result }));
    assert.match(result.transform, /^translate3d/);
    assert.equal(result.pending, 1); assert.equal(result.afterDestroy, 0);
  }
  assert.ok(Math.abs(samples[0].distance - samples[1].distance) < 3, JSON.stringify(samples));
  t.diagnostic(JSON.stringify({ browser: browserName, travel: samples.map(({ distance, paints }) => ({ distance, paints })) }));
});


test('Hops and blinks paint only changed poses at 60 and 120 Hz', async t => {
  const page = await pageFor(t);
  const samples = [];
  for (const hz of [60, 120]) {
    await mount(page);
    await page.waitForFunction(() => ['walkReady', 'lookReady', 'extraReady'].every(key => document.querySelector('#larry').dataset[key] === 'true'));
    samples.push(await page.evaluate(hz => {
      let next = 0, time = 1000, poses = [], hops = [];
      const frames = new Map(), request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame, random = Math.random;
      window.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
      window.cancelAnimationFrame = id => frames.delete(id);
      Math.random = () => 0;
      const pet = document.querySelector('#larry'), painter = pet.querySelector('canvas').getContext('2d');
      const draw = painter.drawImage;
      painter.drawImage = function (...args) {
        if (args[0].src.endsWith('/larry-extra-strip.webp')) poses.push(`${args[2] / 117}:${args[1] / 108}`);
        return draw.apply(this, args);
      };
      function step() {
        time += 1000 / hz;
        const callbacks = [...frames.values()]; frames.clear();
        for (const callback of callbacks) callback(time);
        if (pet.dataset.state === 'hopping') hops.push(parseFloat(pet.style.getPropertyValue('--larry-hop')));
      }
      function feed() {
        const box = pet.getBoundingClientRect();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height - 11 }));
        step();
      }
      const transitions = values => values.filter((value, i) => !i || value !== values[i - 1]);
      feed(); feed();
      for (let tick = 0; tick < hz; tick++) step();
      const blink = { paints: poses.length, poses: transitions(poses), pending: frames.size };
      poses = [];
      feed();
      for (let tick = 0; tick < hz; tick++) step();
      const hop = { paints: poses.length, poses: transitions(poses), offsets: hops, pending: frames.size };
      const eaten = pet.dataset.eaten, state = pet.dataset.state;
      window.larry.destroy();
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      painter.drawImage = draw; Math.random = random;
      return { hz, blink, hop, eaten, state, afterDestroy: frames.size };
    }, hz));
  }
  t.diagnostic(JSON.stringify({ browser: browserName, gestures: samples.map(({ hz, blink, hop }) => ({ hz, blink: { paints: blink.paints, poses: blink.poses }, hop: { paints: hop.paints, poses: hop.poses } })) }));
  for (const sample of samples) {
    assert.deepEqual(sample.blink.poses, ['1:0', '1:3', '1:0']);
    assert.deepEqual(sample.hop.poses, ['0:0', '0:1', '0:2', '0:3', '0:4']);
    assert.equal(sample.blink.paints, 3);
    assert.equal(sample.hop.paints, 5);
    assert.ok(sample.hop.offsets.length > sample.hop.paints, 'Keep the hop transform smooth between sprite poses.');
    assert.ok(Math.min(...sample.hop.offsets) < -7.9);
    assert.equal(sample.blink.pending, 0); assert.equal(sample.hop.pending, 0);
    assert.equal(sample.eaten, '3'); assert.equal(sample.state, 'idle'); assert.equal(sample.afterDestroy, 0);
  }
});


test('Companion renders walking and gaze cleanly, reaches a treat and fits after resize', async t => {
  for (const mobile of [false, true]) {
    const page = await pageFor(t, mobile ? { viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {});
    await mount(page);
    await page.waitForFunction(() => document.querySelector('#larry').dataset.walkReady === 'true' && document.querySelector('#larry').dataset.lookReady === 'true');
    await page.mouse.move(20, 200); await page.clock.runFor(32);
    assert.notEqual(await page.locator('#larry').getAttribute('data-look-direction'), null);
    await capture(page, mobile ? 'mobile-gaze' : 'desktop-gaze');
    await page.mouse.click(30, 530);
    for (let tick = 0; tick < 4; tick++) {
      await page.clock.runFor(100);
      assert.equal(await page.locator('#larry').getAttribute('data-state'), 'walking');
      await capture(page, `${mobile ? 'mobile' : 'desktop'}-walk-${tick}`);
    }
    await page.clock.runFor(5000);
    assert.equal(await page.locator('#larry').getAttribute('data-eaten'), '1');
    assert.equal(await page.locator('.treat').count(), 0);
    await page.setViewportSize({ width: 280, height: 500 });
    await page.waitForFunction(() => {
      const bounds = document.querySelector('#larry').getBoundingClientRect();
      return bounds.x >= 0 && bounds.right <= 280 && bounds.y >= 0 && bounds.bottom <= 500;
    }, null, { polling: 50 });
  }
});


test('Fractional caption widths retain the mobile margin after feeding and resize', async t => {
  const page = await pageFor(t, { viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });
  await page.evaluate(() => { Math.random = () => .999999; });
  await mount(page);
  await page.waitForFunction(() => document.querySelector('#larry').dataset.extraReady === 'true');
  for (let count = 1; count <= 8; count++) {
    await page.mouse.click(300, 400); await page.clock.runFor(32);
    assert.equal(await page.locator('#larry').getAttribute('data-eaten'), String(count));
    const bounds = await page.locator('#pet-bubble').boundingBox();
    assert.ok(bounds.x >= 8 && bounds.x + bounds.width <= 312, JSON.stringify(bounds));
  }
  await capture(page, 'mobile-caption');
  await page.mouse.click(4, 4); await page.clock.runFor(32);
  const petBounds = await page.locator('#larry').boundingBox();
  const captionBounds = await page.locator('#pet-bubble').boundingBox();
  assert.ok(captionBounds.y >= petBounds.y + petBounds.height + 8, JSON.stringify({ petBounds, captionBounds }));
  await capture(page, 'mobile-top-caption');
  await page.setViewportSize({ width: 280, height: 500 });
  await page.waitForFunction(() => {
    const bounds = document.querySelector('#pet-bubble').getBoundingClientRect();
    return bounds.x >= 8 && bounds.right <= 272;
  }, null, { polling: 50 });
});
