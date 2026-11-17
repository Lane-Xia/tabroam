import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verification = resolve(project, 'verification');
const workspace = resolve(project, '../..');
await mkdir(verification, { recursive: true });
let puppeteer;
if (process.env.PUPPETEER_MODULE_PATH) {
  puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_MODULE_PATH).href)).default;
} else {
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch {
    const fallback = resolve(workspace, 'work/browser-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
    puppeteer = (await import(pathToFileURL(fallback).href)).default;
  }
}
const report = {
  startedAt: new Date().toISOString(),
  headless: process.env.HEADED !== '1',
  profile: resolve(process.env.ARC_TEST_PROFILE_ROOT || tmpdir(), `chrome-test-profile-${Date.now()}`),
  checks: [], screenshots: [], errors: [],
  limitations: [
    'Native OS shortcut registration/delivery is not verified by headless CDP keyboard input.',
    'IME checks dispatch CompositionEvent/InputEvent sequences; no native macOS IME was operated.',
    'This run uses a separate synthetic-data profile, not the user browser profile.',
    'The persistent test profile is intentionally retained; no files or directories are deleted.'
  ]
};
const titles = {
  '/dashboard': '演示控制台 Demo', '/resources': 'Workspace-资源列表', '/operations': 'Operations-运维面',
  '/project': '示例项目 - Project Workspace', '/contact': 'Contact the Team',
  '/cross': 'CrossWindowOmega', '/history': 'UniqueHistoryBeta', '/bookmarked': 'UniqueBookmarkAlpha',
};
const favicon = await readFile(resolve(project, 'extension/icons/32.png'));
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') {
    response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600' });
    response.end(favicon); return;
  }
  const title = titles[url.pathname] || `Local Fixture ${url.pathname}`;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="icon" href="/favicon.ico"><style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui}body{min-height:100vh;color:#e9e6f3;background:radial-gradient(ellipse at 92% 78%,#7c3e526b,transparent 55%),radial-gradient(ellipse at 2% 52%,#773c4b55,transparent 46%),linear-gradient(135deg,#3b3c49,#252630 55%,#372532)}main{padding:32px;opacity:.8}label{font-size:12px;display:block;margin-bottom:8px}input{border:1px solid #ffffff20;border-radius:8px;padding:8px;background:#ffffff08;color:#eee}h1{font-size:18px;font-weight:500}</style></head><body><main><h1>${title}</h1><label for="fixture-focus">Original page focus</label><input id="fixture-focus" value="Focus returns here"></main></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
report.fixtureOrigin = origin;
let browser;
let worker;
let extension;
let extensionId;
const pages = [];

async function check(name, run, status = 'passed') {
  const started = Date.now();
  try {
    const detail = await run();
    report.checks.push({ name, status, durationMs: Date.now() - started, ...(detail === undefined ? {} : { detail }) });
    console.log(`PASS ${name}`);
    return detail;
  } catch (error) {
    report.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack || String(error) });
    console.error(`FAIL ${name}: ${error.message}`);
    return null;
  }
}

async function realmFor(page) {
  if (page.url().startsWith(`chrome-extension://${extensionId}/`)) return page;
  for (const realm of page.extensionRealms()) {
    if ((await realm.extension())?.id === extensionId) return realm;
  }
  throw new Error('The action did not create an extension content-script realm.');
}

async function settle(page, expected) {
  const realm = await realmFor(page);
  return realm.evaluate(async expected => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const palette = globalThis.__arcSearchPalette;
      if (palette && !palette.closed && !palette.pendingQuery && !palette.composing && palette.input?.getAttribute('aria-busy') === 'false' && (expected === undefined || palette.input.value === expected)) {
        return { results: palette.results, selected: palette.selectedIndex };
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('The palette query did not settle.');
  }, expected);
}

async function open(page) {
  await page.bringToFront();
  const present = await page.evaluate(() => Boolean(document.querySelector('#arc-search-root')));
  if (!present) await page.triggerExtensionAction(extension);
  await page.waitForFunction(() => {
    const host = document.querySelector('#arc-search-root');
    return host && getComputedStyle(host).visibility === 'visible';
  }, { timeout: 10000 });
  return settle(page);
}

async function close(page) {
  if (await page.evaluate(() => Boolean(document.querySelector('#arc-search-root')))) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#arc-search-root'));
  }
}

async function query(page, value) {
  await open(page);
  await (await realmFor(page)).evaluate(() => {
    const input = globalThis.__arcSearchPalette.root.querySelector('.search-input');
    input.focus(); input.select();
  });
  await page.keyboard.press('Backspace');
  if (value) await page.keyboard.type(value);
  return settle(page, value);
}

async function screenshot(page, filename) {
  const path = resolve(verification, filename);
  await page.screenshot({ path });
  report.screenshots.push({ filename, path, viewport: page.viewport() });
}

async function inspectRows(page) {
  return (await realmFor(page)).evaluate(() => [...globalThis.__arcSearchPalette.root.querySelectorAll('.result')].map(row => ({
    title: row.querySelector('.result-title')?.textContent, url: row.title, kind: row.dataset.kind,
    selected: row.getAttribute('aria-selected'), subtitle: row.querySelector('.result-url')?.textContent,
    label: row.getAttribute('aria-label')
  })));
}

async function chromeTabs() { return worker.evaluate(() => chrome.tabs.query({})); }
async function tabByUrl(url) { return (await chromeTabs()).find(tab => tab.url === url); }

try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: report.headless, pipe: true, enableExtensions: true, userDataDir: report.profile,
    defaultViewport: { width: 1508, height: 944, deviceScaleFactor: 2 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost']
  });
  report.version = await browser.version();
  browser.on('targetcreated', async target => {
    if (target.type() !== 'page') return;
    try {
      const page = await target.page();
      page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    } catch { /* Closing a fixture may race with this observer. */ }
  });
  await check('Manifest V3 installation and real service worker', async () => {
    extensionId = await browser.installExtension(resolve(project, 'extension'));
    extension = (await browser.extensions()).get(extensionId);
    assert(extension);
    const target = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().endsWith('/background.mjs'));
    worker = await target.worker();
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, '1.0.6');
    assert.equal(manifest.name, 'TabRoam');
    report.extensionId = extensionId;
    return { id: extensionId, name: extension.name, worker: target.url(), manifestVersion: manifest.manifest_version };
  });
  if (!worker) throw new Error('Extension installation is a prerequisite for all browser checks.');

  const initial = (await browser.pages())[0];
  pages.push(initial);
  await initial.goto(origin + '/dashboard');
  for (const path of ['/resources', '/operations', '/project', '/contact']) {
    const page = await browser.newPage(); pages.push(page);
    await page.goto(origin + path);
  }
  for (const page of [...pages].reverse()) await page.bringToFront();
  const source = pages[0];
  const sourceTab = await tabByUrl(origin + '/dashboard');
  await worker.evaluate(tabId => chrome.tabs.update(tabId, { pinned: true }), sourceTab.id);
  await source.focus('#fixture-focus');

  await check('Toolbar action grants activeTab and injects focused Shadow DOM overlay', async () => {
    await open(source);
    const state = await (await realmFor(source)).evaluate(() => {
      const root = globalThis.__arcSearchPalette.root;
      return { focused: root.activeElement === root.querySelector('input'), count: root.querySelectorAll('.result').length, role: root.querySelector('section').getAttribute('role') };
    });
    assert.equal(state.focused, true); assert.equal(state.role, 'dialog'); assert.equal(state.count, 5);
    return state;
  });
  await check('Closed shadow hides private results and rejects synthetic execution', async () => {
    const outer = await source.evaluate(() => {
      const host = document.querySelector('#arc-search-root');
      return { closed: host.shadowRoot === null, text: host.textContent, instanceExposed: Boolean(globalThis.__arcSearchPalette) };
    });
    assert.equal(outer.closed, true); assert.equal(outer.text, ''); assert.equal(outer.instanceExposed, false);
    await (await realmFor(source)).evaluate(() => {
      const palette = globalThis.__arcSearchPalette;
      palette.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      palette.rows[0].click();
    });
    assert.equal(await source.evaluate(() => Boolean(document.querySelector('#arc-search-root'))), true);
    return outer;
  });
  await check('Reference viewport geometry and real-data empty-query screenshot', async () => {
    await source.evaluate(() => { document.querySelector('main').style.visibility = 'hidden'; });
    const geometry = await (await realmFor(source)).evaluate(() => {
      const panel = globalThis.__arcSearchPalette.root.querySelector('.panel');
      const rect = panel.getBoundingClientRect();
      return { width: rect.width, height: rect.height, x: rect.x, y: rect.y, font: getComputedStyle(panel).fontFamily };
    });
    assert.equal(geometry.width, 766); assert.equal(geometry.height, 328);
    assert.equal(geometry.x, (1508 - 766) / 2);
    await (await realmFor(source)).waitForFunction(() => [...globalThis.__arcSearchPalette.root.querySelectorAll('.favicon img')].every(img => img.complete && img.naturalWidth > 0));
    await screenshot(source, 'preview.png');
    const path = resolve(verification, 'panel.png');
    await source.screenshot({ path, clip: { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height } });
    report.screenshots.push({ filename: 'panel.png', path, clip: geometry, viewport: source.viewport() });
    await source.evaluate(() => { document.querySelector('main').style.visibility = ''; });
    return geometry;
  });
  await check('Cached favicon is a decoded local data URL', async () => {
    await (await realmFor(source)).waitForFunction(() => [...globalThis.__arcSearchPalette.root.querySelectorAll('.favicon img')].some(img => img.src.startsWith('data:image/') && img.complete && img.naturalWidth > 0));
    const detail = await (await realmFor(source)).evaluate(async origin => {
      const images = [...globalThis.__arcSearchPalette.root.querySelectorAll('.favicon img')];
      const expected = await createImageBitmap(await (await fetch(origin + '/favicon.ico')).blob());
      const canvas = new OffscreenCanvas(32, 32); const context = canvas.getContext('2d');
      context.drawImage(expected, 0, 0, 32, 32); const reference = context.getImageData(0, 0, 32, 32).data;
      context.clearRect(0, 0, 32, 32); context.drawImage(images[0], 0, 0, 32, 32);
      const actual = context.getImageData(0, 0, 32, 32).data;
      const averageChannelDifference = actual.reduce((sum, value, index) => sum + Math.abs(value - reference[index]), 0) / actual.length;
      return { decoded: images.filter(img => img.complete && img.naturalWidth > 0).length, averageChannelDifference };
    }, origin);
    assert(detail.averageChannelDifference < 2, 'Chrome cached icon must match the fixture icon, not the generic globe.');
    return detail;
  });
  await check('Arrow navigation and ARIA active descendant', async () => {
    await source.keyboard.press('ArrowDown');
    return (await realmFor(source)).evaluate(() => {
      const root = globalThis.__arcSearchPalette.root;
      const rows = [...root.querySelectorAll('.result')];
      if (rows[1].getAttribute('aria-selected') !== 'true') throw new Error('ArrowDown did not select the second result.');
      if (root.querySelector('input').getAttribute('aria-activedescendant') !== rows[1].id) throw new Error('ARIA active result was not updated.');
      return { selected: rows[1].textContent };
    });
  });
  await check('Escape restores original page focus', async () => {
    await close(source);
    assert.equal(await source.evaluate(() => document.activeElement?.id), 'fixture-focus');
  });

  const crossWindow = await worker.evaluate(url => chrome.windows.create({ url, focused: false }), origin + '/cross');
  const crossTarget = await browser.waitForTarget(target => target.type() === 'page' && target.url() === origin + '/cross');
  const crossPage = await crossTarget.page();
  await crossPage.waitForFunction(() => document.title === 'CrossWindowOmega');
  await check('Pinned tabs are searchable', async () => {
    const { results } = await query(source, '演示');
    assert(results.some(result => result.kind === 'tab' && result.tabId === sourceTab.id && result.pinned));
    return { rows: await inspectRows(source) };
  });
  await check('Cross-window Enter switches tab and focuses its window', async () => {
    const { results } = await query(source, 'CrossWindowOmega');
    assert.equal(results[0].kind, 'tab');
    assert.equal(results[0].windowId, crossWindow.id);
    await source.keyboard.press('Enter');
    await source.waitForFunction(() => !document.querySelector('#arc-search-root'));
    const actual = await worker.evaluate(windowId => chrome.windows.get(windowId, { populate: true }), crossWindow.id);
    assert.equal(actual.focused, true);
    assert(actual.tabs.some(tab => tab.active && tab.url === origin + '/cross'));
    return { windowFocused: actual.focused, activeUrl: actual.tabs.find(tab => tab.active)?.url };
  });
  await check('Background tab refresh preserves the same-query selected result', async () => {
    await query(source, '');
    for (let i = 0; i < 5; i++) await source.keyboard.press('ArrowDown');
    const realm = await realmFor(source);
    const selected = await realm.evaluate(() => {
      const palette = globalThis.__arcSearchPalette;
      return palette.results[palette.selectedIndex].id;
    });
    await crossPage.evaluate(() => { document.title = 'CrossWindowOmega refreshed'; });
    const current = await realm.evaluate(async () => {
      for (let i = 0; i < 400; i++) {
        const palette = globalThis.__arcSearchPalette;
        if (!palette.pendingQuery && palette.results.some(result => result.title === 'CrossWindowOmega refreshed')) {
          const row = palette.rows[palette.selectedIndex].getBoundingClientRect();
          const list = palette.list.getBoundingClientRect();
          return { id: palette.results[palette.selectedIndex].id, scrollTop: palette.list.scrollTop, selectedVisible: row.top >= list.top && row.bottom <= list.bottom };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('The actual Chrome tab title change did not reach the palette.');
    });
    assert.equal(current.id, selected); assert(current.scrollTop > 0); assert.equal(current.selectedVisible, true);
    return { selectedIdPreserved: current.id, scrollTop: current.scrollTop, selectedVisible: current.selectedVisible };
  });

  await worker.evaluate(async url => {
    await chrome.bookmarks.create({ title: 'UniqueBookmarkAlpha', url: url + '/bookmarked' });
    await chrome.bookmarks.create({ title: '演示控制台 Demo', url: url + '/dashboard' });
  }, origin);
  const historyPage = await browser.newPage();
  await historyPage.goto(origin + '/history');
  await historyPage.waitForFunction(() => document.title === 'UniqueHistoryBeta');
  await historyPage.close();
  await check('Real Chrome bookmarks and closed-page history are searchable', async () => {
    const bookmark = await query(source, 'UniqueBookmarkAlpha');
    assert.equal(bookmark.results[0].kind, 'bookmark');
    const history = await query(source, 'UniqueHistoryBeta');
    assert.equal(history.results[0].kind, 'history');
    return { bookmark: bookmark.results[0].url, history: history.results[0].url };
  });
  await check('Open tab wins duplicate bookmark/history URL', async () => {
    const { results } = await query(source, '演示控制台 Demo');
    const matching = results.filter(result => result.url === origin + '/dashboard');
    assert.equal(matching.length, 1); assert.equal(matching[0].kind, 'tab');
  });
  await check('Duplicate actual tabs remain selectable and identify window/tab', async () => {
    await worker.evaluate(({ windowId, url }) => chrome.tabs.create({ windowId, url, active: false }), { windowId: crossWindow.id, url: origin + '/dashboard' });
    const realm = await realmFor(source);
    const actual = await query(source, '演示控制台 Demo');
    const tabs = actual.results.filter(result => result.kind === 'tab' && result.url === origin + '/dashboard');
    assert.equal(tabs.length, 2);
    const rows = (await inspectRows(source)).filter(row => row.kind === 'tab' && row.url === origin + '/dashboard');
    assert.equal(rows.length, 2);
    assert(rows.every(row => /Window \d+ · Tab \d+/.test(row.subtitle) && row.label?.includes('Window')));
    assert.notEqual(rows[0].label, rows[1].label);
    return { rows };
  });
  await check('Chinese, case-insensitive, multiword and fuzzy matching', async () => {
    const chinese = await query(source, '示例项目'); assert.equal(chinese.results[0].title, titles['/project']);
    const multiword = await query(source, 'SPACE 资源'); assert.equal(multiword.results[0].title, titles['/resources']);
    const fuzzy = await query(source, 'contcat'); assert.equal(fuzzy.results[0].title, titles['/contact']);
    await query(source, 'Workspace'); await screenshot(source, 'search.png');
    return { chinese: chinese.results[0].title, multiword: multiword.results[0].title, fuzzy: fuzzy.results[0].title };
  });
  await check('IME composition Enter does not submit', async () => {
    await query(source, '');
    const before = (await chromeTabs()).length;
    await (await realmFor(source)).evaluate(() => {
      const input = globalThis.__arcSearchPalette.root.querySelector('input');
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      input.value = '演示';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '示', isComposing: true }));
    });
    await source.keyboard.press('Enter');
    assert.equal((await chromeTabs()).length, before);
    assert.equal(await source.evaluate(() => Boolean(document.querySelector('#arc-search-root'))), true);
    await (await realmFor(source)).evaluate(() => {
      const input = globalThis.__arcSearchPalette.root.querySelector('input');
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '演示' }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '演示', isComposing: false }));
    });
    const actual = await settle(source, '演示');
    assert.equal(actual.results[0].title, titles['/dashboard']);
    return { events: 'Synthetic CompositionEvent/InputEvent; actual Enter delivered through CDP', nativeIme: false };
  }, 'passed_simulated_ime');

  await check('Out-of-order query responses cannot replace newer results', async () => {
    const realm = await realmFor(source);
    await realm.evaluate(() => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime);
      globalThis.__restoreTestTransport = () => { chrome.runtime.sendMessage = original; };
      globalThis.__testSlowResponseDone = false;
      chrome.runtime.sendMessage = async message => {
        const response = await original(message);
        if (message.type === 'query' && message.query === 'Workspace') {
          await new Promise(resolve => setTimeout(resolve, 600));
          globalThis.__testSlowResponseDone = true;
        }
        return response;
      };
    });
    try {
      await realm.evaluate(() => {
        const input = globalThis.__arcSearchPalette.root.querySelector('input');
        input.value = 'Workspace'; input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await realm.evaluate(async () => {
        for (let i = 0; i < 100; i++) {
          if (globalThis.__arcSearchPalette.input.getAttribute('aria-busy') === 'true') return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error('The delayed query did not start.');
      });
      const latest = await query(source, 'Operations');
      assert.equal(latest.results[0].title, titles['/operations']);
      await realm.evaluate(async () => {
        for (let i = 0; i < 150; i++) {
          if (globalThis.__testSlowResponseDone) return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error('The deliberately delayed response did not finish.');
      });
      const final = await settle(source, 'Operations');
      assert.equal(final.results[0].title, titles['/operations']);
      return { technique: 'Real worker query responses; controlled 600ms delay in test content-script transport.' };
    } finally { await realm.evaluate(() => globalThis.__restoreTestTransport()); }
  }, 'passed_controlled_response_delay');

  await check('Enter opens URL in a new tab', async () => {
    const url = origin + '/opened-new';
    const { results } = await query(source, url);
    assert.equal(results[0].kind, 'url');
    const count = (await chromeTabs()).length;
    const targetPromise = browser.waitForTarget(target => target.type() === 'page' && target.url() === url);
    await source.keyboard.press('Enter');
    const target = await targetPromise; const page = await target.page();
    await page.waitForFunction(() => document.readyState === 'complete');
    assert.equal((await chromeTabs()).length, count + 1);
    assert.equal(source.url(), origin + '/dashboard');
    return { url: page.url(), newTab: true };
  });
  await check('Cmd+Enter opens URL in the current source tab', async () => {
    const url = origin + '/opened-current';
    await query(source, url);
    const count = (await chromeTabs()).length;
    const navigation = source.waitForNavigation();
    await source.keyboard.down('Meta'); await source.keyboard.press('Enter'); await source.keyboard.up('Meta');
    await navigation;
    assert.equal(source.url(), url); assert.equal((await chromeTabs()).length, count);
    assert.equal((await tabByUrl(url)).id, sourceTab.id);
    return { url: source.url(), tabIdPreserved: true };
  });
  await check('Settings UI changes engine and live query search action', async () => {
    await query(source, 'engine check');
    const options = await browser.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.waitForSelector('#settings');
    await options.select('select[name="engine"]', 'bing');
    await options.click('button[type="submit"]');
    await options.waitForFunction(() => document.querySelector('#status').textContent === '已保存');
    const state = await query(source, 'engine check');
    const result = state.results.find(result => result.kind === 'search');
    assert(result.url.startsWith('https://www.bing.com/search?q='));
    const rows = await inspectRows(source);
    assert(rows.some(row => row.kind === 'search' && row.title.includes('engine check')));
    assert.equal(await (await realmFor(source)).evaluate(() => globalThis.__arcSearchPalette.root.querySelector('.result[data-kind="search"] .action-label').textContent), 'Search Bing');
    return { engine: 'Bing', searchUrl: result.url, networkNavigationPerformed: false };
  });
  await check('No local match retains a usable web search action', async () => {
    const state = await query(source, 'no-local-match-738913742');
    assert.equal(state.results.length, 1); assert.equal(state.results[0].kind, 'search');
  });
  await check('Search action attempts the correct navigation with external request blocked', async () => {
    const text = 'browser search 中文 & encoded';
    const expected = 'https://www.bing.com/search?q=' + encodeURIComponent(text);
    let resolveRequest;
    const captured = new Promise(resolve => { resolveRequest = resolve; });
    let timeout;
    const handler = request => {
      if (request.url().startsWith('https://www.bing.com/')) {
        resolveRequest(request.url()); request.abort().catch(() => {});
      } else request.continue().catch(() => {});
    };
    await source.setRequestInterception(true); source.on('request', handler);
    try {
      const state = await query(source, text);
      assert.equal(state.results[0].kind, 'search'); assert.equal(state.results[0].url, expected);
      const navigation = source.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await source.keyboard.down('Meta'); await source.keyboard.press('Enter'); await source.keyboard.up('Meta');
      const url = await Promise.race([captured, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('No Bing navigation was attempted.')), 10000); })]);
      clearTimeout(timeout); await navigation;
      assert.equal(url, expected);
      return { requestedUrl: url, navigationAttempted: true, externalRequestBlocked: true };
    } finally {
      clearTimeout(timeout); source.off('request', handler); await source.setRequestInterception(false);
      await source.goto(origin + '/opened-current');
    }
  });
  await check('Small 320×300 viewport keeps input, selection and close usable', async () => {
    await source.setViewport({ width: 320, height: 300, deviceScaleFactor: 2 });
    await query(source, '');
    const geometry = await (await realmFor(source)).evaluate(() => {
      const root = globalThis.__arcSearchPalette.root;
      const panel = root.querySelector('.panel').getBoundingClientRect();
      const input = root.querySelector('input').getBoundingClientRect();
      return { panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height }, input: { width: input.width }, overflow: root.querySelector('.results').scrollHeight > root.querySelector('.results').clientHeight };
    });
    assert(geometry.panel.x >= 0 && geometry.panel.y >= 0);
    assert(geometry.panel.x + geometry.panel.width <= 320);
    assert(geometry.panel.y + geometry.panel.height <= 300);
    assert(geometry.input.width > 100); assert(geometry.overflow);
    await source.keyboard.press('ArrowDown');
    await screenshot(source, 'mobile.png');
    await close(source);
    await source.setViewport({ width: 1508, height: 944, deviceScaleFactor: 2 });
    return geometry;
  });

  let fallbackPage;
  await check('Restricted chrome://settings action opens actual fallback page', async () => {
    const restricted = await browser.newPage();
    await restricted.goto('chrome://settings/'); await restricted.bringToFront();
    const original = (await chromeTabs()).find(tab => tab.url?.startsWith('chrome://settings'));
    const targetPromise = browser.waitForTarget(target => target.type() === 'page' && target.url().startsWith(`chrome-extension://${extensionId}/page.html?source=`));
    await restricted.triggerExtensionAction(extension);
    const fallback = await (await targetPromise).page();
    fallbackPage = fallback;
    await fallback.waitForFunction(() => globalThis.__arcSearchPalette?.root?.querySelector('input'));
    assert.equal(new URL(fallback.url()).searchParams.get('source'), String(original.id));
    assert.equal(await fallback.evaluate(() => globalThis.__arcSearchPalette.root.activeElement?.className), 'search-input');
    await screenshot(fallback, 'fallback.png');
    await fallback.keyboard.press('Escape');
    await fallback.waitForFunction(() => !document.querySelector('#arc-search-root'));
    const active = await worker.evaluate(id => chrome.tabs.get(id), original.id);
    assert.equal(active.active, true);
    return { fallback: fallback.url(), originalTabRestored: active.active };
  });
  await check('Fallback toolbar action toggles existing page without duplicate tabs', async () => {
    assert(fallbackPage);
    const count = (await chromeTabs()).length;
    const url = fallbackPage.url();
    await fallbackPage.bringToFront();
    await fallbackPage.triggerExtensionAction(extension);
    await fallbackPage.waitForFunction(() => globalThis.__arcSearchPalette?.root?.querySelector('input'));
    await fallbackPage.triggerExtensionAction(extension);
    await fallbackPage.waitForFunction(() => !document.querySelector('#arc-search-root'));
    await fallbackPage.triggerExtensionAction(extension);
    await fallbackPage.waitForFunction(() => globalThis.__arcSearchPalette?.root?.querySelector('input'));
    assert.equal(fallbackPage.url(), url); assert.equal((await chromeTabs()).length, count);
    return { toggled: 3, tabCountPreserved: count };
  });

  const shortcuts = await worker.evaluate(() => chrome.commands.getAll());
  report.checks.push({ name: 'Native operating-system launch shortcut', status: 'not_verified', detail: { registeredCommands: shortcuts, reason: 'Headless tests do not exercise native macOS shortcut routing or conflicts.' } });
  report.checks.push({ name: 'Windows native browser and keyboard environment', status: 'not_verified', detail: 'This machine is macOS. Windows Ctrl+Enter code path is implemented but not run in native Windows.' });
} catch (error) {
  report.errors.push({ fatal: true, message: error.stack || String(error) });
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter(item => item.status.startsWith('passed')).length,
    failed: report.checks.filter(item => item.status === 'failed').length,
    notVerified: report.checks.filter(item => item.status === 'not_verified').length
  };
  await writeFile(resolve(verification, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed || report.errors.some(error => error.fatal)) process.exitCode = 1;
}
