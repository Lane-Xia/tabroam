import test from 'node:test';
import assert from 'node:assert/strict';

let instance = 0;
const EXTENSION_ORIGIN = 'chrome-extension://arc-search-test/';

async function worker(t, options = {}) {
  const calls = [];
  const events = {};
  const event = name => (events[name] = {
    listeners: [],
    addListener(listener) { this.listeners.push(listener); },
  });
  const record = (name, implementation = async () => {}) => async (...args) => {
    calls.push({ name, args });
    return implementation(...args);
  };
  let settings = Object.hasOwn(options, 'settings') ? options.settings : { engine: 'google', historyDays: 180 };
  const source = { id: 10, windowId: 1, index: 2, title: 'Source', url: 'https://source.test/', ...options.source };
  const target = { id: 20, windowId: 2, index: 0, title: 'Proxy', url: 'https://proxy.test/', lastAccessed: 20 };
  const tabMap = new Map([source, target, ...(options.extraTabs || [])].map(tab => [tab.id, tab]));
  const chrome = {
    runtime: {
      id: 'arc-search-test',
      getURL: path => new URL(String(path).replace(/^\//, ''), EXTENSION_ORIGIN).href,
      getPlatformInfo: async () => ({ os: 'mac' }),
      onMessage: event('runtime.onMessage'),
      onInstalled: event('runtime.onInstalled'),
      sendMessage: record('runtime.sendMessage', options.runtimeError
        ? async () => { throw new Error('Receiving end does not exist'); }
        : async () => options.runtimeResponse),
      openOptionsPage: record('runtime.openOptionsPage'),
    },
    commands: { onCommand: event('commands.onCommand') },
    action: { onClicked: event('action.onClicked') },
    storage: {
      local: {
        get: record('storage.local.get', async () => ({ settings })),
        set: record('storage.local.set', async values => { settings = values.settings; }),
      },
      session: {
        get: async () => ({ recent: {} }),
        set: record('storage.session.set'),
      },
      onChanged: event('storage.onChanged'),
    },
    tabs: {
      get: record('tabs.get', async id => {
        if (!tabMap.has(id)) throw new Error('No tab with this id');
        return tabMap.get(id);
      }),
      update: record('tabs.update', async (id, changes) => ({ ...tabMap.get(id), ...changes })),
      create: record('tabs.create', async properties => ({ id: 99, ...properties })),
      query: record('tabs.query', async () => options.existingPalette ? [options.existingPalette] : []),
      sendMessage: record('tabs.sendMessage'),
    },
    windows: {
      getAll: record('windows.getAll', options.windowsError
        ? async () => { throw new Error('tabs permission missing'); }
        : async () => options.windows || [{ id: 1, tabs: [source] }, { id: 2, tabs: [target] }]),
      update: record('windows.update'),
      onFocusChanged: event('windows.onFocusChanged'),
    },
    scripting: {
      executeScript: record('scripting.executeScript', options.injectionError
        ? async () => { throw new Error('Cannot access a chrome:// URL'); }
        : async () => []),
    },
    bookmarks: {
      getTree: record('bookmarks.getTree', options.bookmarksError
        ? async () => { throw new Error('bookmarks permission missing'); }
        : async () => options.bookmarks || []),
    },
    history: {
      search: record('history.search', options.historyError
        ? async () => { throw new Error('history permission missing'); }
        : async () => options.history || []),
      onVisited: event('history.onVisited'),
      onVisitRemoved: event('history.onVisitRemoved'),
    },
  };
  for (const name of ['onActivated', 'onRemoved', 'onUpdated', 'onCreated', 'onAttached', 'onDetached']) {
    chrome.tabs[name] = event(`tabs.${name}`);
  }
  for (const name of ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onImportEnded']) {
    chrome.bookmarks[name] = event(`bookmarks.${name}`);
  }
  const previousChrome = globalThis.chrome;
  globalThis.chrome = chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  // Refresh notifications are irrelevant to these request/response assertions.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    text: async () => ':host { display: block; }',
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  }));
  const module = await import(`${new URL('../extension/background.mjs', import.meta.url).href}?test=${++instance}`);
  const namedCalls = name => calls.filter(call => call.name === name);
  return { module, chrome, calls, events, source, target, namedCalls };
}

test('settings accept only known engines and allowed history ranges', async t => {
  const { module } = await worker(t);
  assert.deepEqual(module.sanitizeSettings({ engine: 'bing', historyDays: 90, injected: 'ignored' }), {
    engine: 'bing', historyDays: 90, engineName: 'Bing', searchTemplate: 'https://www.bing.com/search?q={query}',
  });
  for (const engine of ['unknown', '__proto__', 'constructor', '', null]) {
    const value = module.sanitizeSettings({ engine, historyDays: '365', searchTemplate: 'javascript:{query}' });
    assert.equal(value.engine, 'google');
    assert.equal(value.historyDays, 180);
    assert.equal(value.searchTemplate, 'https://www.google.com/search?q={query}');
  }
  assert.equal(module.sanitizeSettings({ historyDays: 0 }).historyDays, 0);
  for (const raw of [undefined, null, false, 123, 'bing']) {
    assert.equal(module.sanitizeSettings(raw).engine, 'google', `invalid settings: ${raw}`);
  }
});

test('saving settings persists the whitelist without arbitrary templates or fields', async t => {
  const { module, namedCalls } = await worker(t);
  const response = await module.handleMessage({ type: 'save-settings', settings: {
    engine: 'duckduckgo', historyDays: 30, searchTemplate: 'javascript:alert(1)', unrelated: true,
  } });
  assert.equal(response.settings.engine, 'duckduckgo');
  assert.deepEqual(namedCalls('storage.local.set')[0].args[0], { settings: { engine: 'duckduckgo', historyDays: 30 } });
});

test('switching a tab activates it and focuses its actual window', async t => {
  const { module, namedCalls } = await worker(t);
  await module.handleMessage({ type: 'open', result: { kind: 'tab', tabId: 20, windowId: 999 } });
  assert.deepEqual(namedCalls('tabs.update').map(call => call.args), [[20, { active: true }]]);
  assert.deepEqual(namedCalls('windows.update').map(call => call.args), [[2, { focused: true }]]);
  assert.equal(namedCalls('tabs.create').length, 0);
});

test('closed or incognito tab targets cannot be activated', async t => {
  const { module, namedCalls } = await worker(t, {
    extraTabs: [{ id: 30, windowId: 3, url: 'https://private.test/', incognito: true }],
  });
  for (const tabId of [404, 30]) {
    await assert.rejects(module.handleMessage({ type: 'open', result: { kind: 'tab', tabId } }), /已关闭或不可用/);
  }
  assert.equal(namedCalls('tabs.update').length, 0);
});

test('current disposition navigates the actual sender tab', async t => {
  const { module, source, namedCalls } = await worker(t);
  await module.handleMessage({ type: 'open', disposition: 'current', sourceTabId: 20,
    result: { kind: 'url', url: 'https://destination.test/a?q=中文' },
  }, { tab: source, url: source.url });
  assert.deepEqual(namedCalls('tabs.update')[0].args, [source.id, { url: 'https://destination.test/a?q=中文', active: true }]);
  assert.equal(namedCalls('tabs.create').length, 0);
  assert.deepEqual(namedCalls('windows.update')[0].args, [source.windowId, { focused: true }]);
});

test('default disposition opens a new adjacent tab in the source window', async t => {
  const { module, source, namedCalls } = await worker(t);
  await module.handleMessage({ type: 'open', result: { kind: 'search', url: 'https://google.com/search?q=proxy' } },
    { tab: source, url: source.url });
  assert.deepEqual(namedCalls('tabs.create')[0].args[0], {
    url: 'https://google.com/search?q=proxy', active: true, windowId: source.windowId, index: source.index + 1,
  });
  assert.equal(namedCalls('tabs.update').length, 0);
});

test('fallback extension page resolves the original source tab for current navigation', async t => {
  const { module, source, namedCalls } = await worker(t);
  await module.handleMessage({ type: 'open', sourceTabId: source.id, disposition: 'current',
    result: { kind: 'history', url: 'https://history.test/' },
  }, { tab: { id: 99 }, url: `${EXTENSION_ORIGIN}page.html?source=${source.id}` });
  assert.deepEqual(namedCalls('tabs.update')[0].args, [source.id, { url: 'https://history.test/', active: true }]);
});

test('current navigation with a closed source falls back to a new tab', async t => {
  const { module, namedCalls } = await worker(t);
  await module.handleMessage({ type: 'open', sourceTabId: 404, disposition: 'current',
    result: { kind: 'bookmark', url: 'http://localhost:3000/' },
  });
  assert.deepEqual(namedCalls('tabs.create')[0].args[0], { url: 'http://localhost:3000/', active: true });
  assert.equal(namedCalls('tabs.update').length, 0);
});

test('navigation rejects unsafe schemes, credential URLs, and unsupported result types', async t => {
  const { module, namedCalls } = await worker(t);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd',
    'chrome://settings/', `${EXTENSION_ORIGIN}page.html`, 'ftp://example.com/', 'https://user:password@example.com/', 'not a url']) {
    await assert.rejects(module.handleMessage({ type: 'open', result: { kind: 'url', url } }), /HTTP 或 HTTPS/);
  }
  await assert.rejects(module.handleMessage({ type: 'open', result: { kind: 'command', url: 'https://example.com/' } }), /HTTP 或 HTTPS/);
  assert.equal(namedCalls('tabs.create').length, 0);
  assert.equal(namedCalls('tabs.update').length, 0);
});

test('ordinary page injection succeeds without creating a fallback tab', async t => {
  const { module, source, namedCalls } = await worker(t);
  await module.togglePalette(source);
  assert.deepEqual(namedCalls('scripting.executeScript')[0].args[0], {
    target: { tabId: source.id }, files: ['palette.js', 'content.js'],
  });
  assert.equal(namedCalls('tabs.create').length, 0);
  assert.equal(namedCalls('tabs.query').length, 0);
});

test('restricted-page injection failure opens a source-aware extension fallback', async t => {
  const { module, source, namedCalls } = await worker(t, { injectionError: true, source: { url: 'chrome://extensions/' } });
  await module.togglePalette(source);
  const created = namedCalls('tabs.create')[0].args[0];
  assert.equal(created.windowId, source.windowId);
  assert.equal(created.active, true);
  assert.equal(created.url.startsWith(EXTENSION_ORIGIN), true);
  assert.equal(new URL(created.url).pathname, '/page.html');
  assert.equal(new URL(created.url).searchParams.get('source'), String(source.id));
});

test('restricted-page fallback reuses an existing palette in the same window', async t => {
  const { module, source, namedCalls } = await worker(t, { injectionError: true, existingPalette: { id: 77 } });
  await module.togglePalette(source);
  assert.equal(namedCalls('tabs.create').length, 0);
  const [id, update] = namedCalls('tabs.update')[0].args;
  assert.equal(id, 77);
  assert.equal(update.active, true);
  assert.equal(new URL(update.url).searchParams.get('source'), String(source.id));
  assert.deepEqual(namedCalls('windows.update')[0].args, [source.windowId, { focused: true }]);
});

test('own fallback page toggles through runtime messaging without injecting or creating a tab', async t => {
  const { module, source, namedCalls } = await worker(t, {
    source: { url: `${EXTENSION_ORIGIN}page.html?source=20` }, runtimeResponse: { ok: true },
  });
  await module.togglePalette(source);
  assert.deepEqual(namedCalls('runtime.sendMessage')[0].args[0], { type: 'toggle-page', tabId: source.id });
  assert.equal(namedCalls('tabs.sendMessage').length, 0);
  assert.equal(namedCalls('scripting.executeScript').length, 0);
  assert.equal(namedCalls('tabs.query').length, 0);
  assert.equal(namedCalls('tabs.create').length, 0);
  assert.equal(namedCalls('tabs.update').length, 0);
});

test('own page without a receiver reopens the fallback and preserves the original source', async t => {
  const { module, source, namedCalls } = await worker(t, {
    source: { url: `${EXTENSION_ORIGIN}page.html?source=20` },
    runtimeError: true, injectionError: true, existingPalette: { id: 10 },
  });
  await module.togglePalette(source);
  assert.deepEqual(namedCalls('runtime.sendMessage')[0].args[0], { type: 'toggle-page', tabId: source.id });
  assert.equal(namedCalls('scripting.executeScript').length, 0);
  assert.equal(namedCalls('tabs.query').length, 0);
  assert.equal(namedCalls('tabs.create').length, 0);
  const [id, update] = namedCalls('tabs.update')[0].args;
  assert.equal(id, source.id);
  assert.equal(update.active, true);
  assert.equal(update.url, source.url);
  assert.equal(new URL(update.url).searchParams.get('source'), '20');
});

test('empty query reads only MRU tabs and excludes incognito and own pages', async t => {
  const { module, namedCalls } = await worker(t, { windows: [
    { id: 1, tabs: [
      { id: 1, title: 'Old', url: 'https://old.test/', lastAccessed: 10 },
      { id: 2, title: 'Recent', url: 'https://recent.test/', lastAccessed: 100 },
      { id: 3, title: 'Own page', url: `${EXTENSION_ORIGIN}page.html`, lastAccessed: 1000 },
      { id: 4, title: 'Private tab', url: 'https://private.test/', incognito: true, lastAccessed: 2000 },
    ] },
    { id: 2, incognito: true, tabs: [{ id: 5, title: 'Private window', url: 'https://private-window.test/' }] },
  ] });
  const response = await module.handleMessage({ type: 'query', query: '   ' });
  assert.deepEqual(response.results.map(result => result.tabId), [2, 1]);
  assert.equal(namedCalls('history.search').length, 0);
  assert.equal(namedCalls('bookmarks.getTree').length, 0);
  assert.deepEqual(response.warnings, []);
});

test('a failing history source keeps tab and bookmark results with a useful warning', async t => {
  const { module } = await worker(t, { historyError: true, bookmarks: [
    { id: 'folder', children: [{ id: 'b1', title: 'Proxy bookmark', url: 'https://bookmark.test/' }] },
  ] });
  const response = await module.handleMessage({ type: 'query', query: 'proxy' });
  assert.equal(response.results.some(result => result.kind === 'tab'), true);
  assert.equal(response.results.some(result => result.kind === 'bookmark'), true);
  assert.equal(response.results.at(-1).kind, 'search');
  assert.equal(response.warnings.length, 1);
  assert.match(response.warnings[0], /历史记录/);
});

test('failed tabs and bookmarks still return usable history and search', async t => {
  const { module } = await worker(t, { windowsError: true, bookmarksError: true,
    history: [{ id: 'h1', title: 'Proxy history', url: 'https://history.test/', lastVisitTime: 123 }],
  });
  const response = await module.handleMessage({ type: 'query', query: 'proxy' });
  assert.equal(response.results.some(result => result.kind === 'history'), true);
  assert.equal(response.results.at(-1).kind, 'search');
  assert.equal(response.warnings.length, 2);
  assert.match(response.warnings[0], /标签页/);
  assert.match(response.warnings[1], /书签/);
});

test('foreign extension senders are rejected and unknown runtime messages are ignored', async t => {
  const { module, events } = await worker(t);
  await assert.rejects(module.handleMessage({ type: 'get-settings' }, { id: 'another-extension' }), /Invalid sender/);
  const listener = events['runtime.onMessage'].listeners[0];
  assert.equal(listener({ type: 'unrelated' }, {}, () => assert.fail('must not respond')), false);
});

test('favicons use local resources, cache exact page URLs, and reject unsafe URLs', async t => {
  const { module } = await worker(t);
  assert.deepEqual(await module.handleMessage({ type: 'favicon', url: 'javascript:alert(1)' }), { dataUrl: null });
  assert.equal(globalThis.fetch.mock.calls.length, 0);
  const pageUrl = 'https://icons.test/private/path?token=local-only';
  const first = await module.handleMessage({ type: 'favicon', url: pageUrl });
  const second = await module.handleMessage({ type: 'favicon', url: pageUrl });
  assert.deepEqual(first, { dataUrl: 'data:image/png;base64,iVBORw==' });
  assert.deepEqual(second, first);
  assert.equal(globalThis.fetch.mock.calls.length, 1);
  const request = new URL(globalThis.fetch.mock.calls[0].arguments[0]);
  assert.equal(request.href.startsWith(`${EXTENSION_ORIGIN}_favicon/`), true);
  assert.equal(request.searchParams.get('pageUrl'), pageUrl);
  assert.equal(request.searchParams.get('size'), '32');
  await module.handleMessage({ type: 'favicon', url: 'https://icons.test/another-page' });
  assert.equal(globalThis.fetch.mock.calls.length, 2);
  const secondRequest = new URL(globalThis.fetch.mock.calls[1].arguments[0]);
  assert.equal(secondRequest.href.startsWith(`${EXTENSION_ORIGIN}_favicon/`), true);
  assert.equal(secondRequest.searchParams.get('pageUrl'), 'https://icons.test/another-page');
});

test('history and bookmark changes invalidate their respective cached sources', async t => {
  const { module, events, namedCalls } = await worker(t);
  for (let i = 0; i < 2; i++) await module.handleMessage({ type: 'query', query: 'proxy' });
  assert.equal(namedCalls('history.search').length, 1);
  assert.equal(namedCalls('bookmarks.getTree').length, 1);
  events['history.onVisited'].listeners[0]({ url: 'https://new-history.test/' });
  await module.handleMessage({ type: 'query', query: 'proxy' });
  assert.equal(namedCalls('history.search').length, 2);
  assert.equal(namedCalls('bookmarks.getTree').length, 1);
  events['bookmarks.onChanged'].listeners[0]('b1', { title: 'Updated' });
  await module.handleMessage({ type: 'query', query: 'proxy' });
  assert.equal(namedCalls('history.search').length, 2);
  assert.equal(namedCalls('bookmarks.getTree').length, 2);
});
