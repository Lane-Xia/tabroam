import { rankResults } from './core.mjs';

const ENGINES = Object.freeze({
  google: { engineName: 'Google', searchTemplate: 'https://www.google.com/search?q={query}' },
  bing: { engineName: 'Bing', searchTemplate: 'https://www.bing.com/search?q={query}' },
  duckduckgo: { engineName: 'DuckDuckGo', searchTemplate: 'https://duckduckgo.com/?q={query}' },
  baidu: { engineName: '百度', searchTemplate: 'https://www.baidu.com/s?wd={query}' }
});
export const DEFAULT_SETTINGS = Object.freeze({ engine: 'google', historyDays: 180 });
const HISTORY_LIMIT = 20000;
const ownOrigin = chrome.runtime.getURL('');
let cssPromise;
let bookmarkPromise;
let historyCache;
let historyRevision = 0;
const clients = new Set();
const iconCache = new Map();
const recent = new Map();
let notifyTimer;

export function sanitizeSettings(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const engine = Object.hasOwn(ENGINES, raw.engine) ? raw.engine : 'google';
  const historyDays = [30, 90, 180, 365, 0].includes(raw.historyDays) ? raw.historyDays : 180;
  return { engine, historyDays, ...ENGINES[engine] };
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return sanitizeSettings(settings);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function refreshClients() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    for (const tabId of clients) {
      chrome.tabs.sendMessage(tabId, { type: 'refresh' }).catch(() => clients.delete(tabId));
    }
    chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
  }, 160);
}

function invalidateHistory() {
  historyRevision++;
  historyCache = null;
  refreshClients();
}

async function tabs() {
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  return windows.filter(window => !window.incognito).flatMap(window =>
    (window.tabs || []).filter(tab => !tab.incognito && !(tab.url || '').startsWith(ownOrigin)).map(tab => ({
      id: `tab:${tab.id}`, kind: 'tab', tabId: tab.id, windowId: window.id,
      title: tab.title || tab.url || 'Untitled tab', url: tab.url || tab.pendingUrl || '',
      lastAccessed: Math.max(tab.lastAccessed || 0, recent.get(tab.id) || 0), pinned: tab.pinned
    }))
  );
}

async function bookmarks() {
  if (!bookmarkPromise) {
    bookmarkPromise = chrome.bookmarks.getTree().then(tree => {
      const found = [];
      function visit(nodes) {
        for (const node of nodes) {
          if (node.url && safeUrl(node.url)) found.push({
            id: `bookmark:${node.id}`, kind: 'bookmark', title: node.title || node.url,
            url: node.url, dateAdded: node.dateAdded || 0
          });
          if (node.children) visit(node.children);
        }
      }
      visit(tree);
      return found;
    }).catch(error => { bookmarkPromise = null; throw error; });
  }
  return bookmarkPromise;
}

async function history(settings) {
  const now = Date.now();
  if (!historyCache || historyCache.days !== settings.historyDays || now - historyCache.time > 15000) {
    const revision = historyRevision;
    const promise = chrome.history.search({
      text: '', startTime: settings.historyDays ? now - settings.historyDays * 86400000 : 0,
      maxResults: HISTORY_LIMIT
    }).then(items => ({
      items: items.filter(item => safeUrl(item.url)).map(item => ({
        id: `history:${item.id}`, kind: 'history', title: item.title || item.url,
        url: item.url, lastVisitTime: item.lastVisitTime || 0
      })), capped: items.length === HISTORY_LIMIT
    })).catch(error => {
      if (historyCache?.promise === promise) historyCache = null;
      throw error;
    });
    historyCache = { days: settings.historyDays, time: now, revision, promise };
  }
  return historyCache.promise;
}

async function query(message, sender) {
  const input = String(message.query || '').slice(0, 2048);
  const settings = await getSettings();
  if (sender.tab?.id) clients.add(sender.tab.id);
  // Empty input is MRU tabs only. History/bookmarks are loaded only when searching.
  const outcomes = await Promise.allSettled([
    tabs(), input.trim() ? bookmarks() : Promise.resolve([]),
    input.trim() ? history(settings) : Promise.resolve({ items: [], capped: false })
  ]);
  const warnings = [];
  const labels = ['标签页', '书签', '历史记录'];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'rejected') warnings.push(`${labels[index]}暂时无法读取，请重试或检查扩展权限。`);
  });
  const tabItems = outcomes[0].status === 'fulfilled' ? outcomes[0].value : [];
  const bookmarkItems = outcomes[1].status === 'fulfilled' ? outcomes[1].value : [];
  const historyItems = outcomes[2].status === 'fulfilled' ? outcomes[2].value : { items: [], capped: false };
  if (input.trim() && historyItems.capped) warnings.push(`历史记录已达到 ${HISTORY_LIMIT.toLocaleString()} 条检索上限，可在设置中缩短时间范围。`);
  const ranked = rankResults(input, [...tabItems, ...bookmarkItems, ...historyItems.items], {
    limit: 40, now: Date.now(), ...settings
  });
  return { ...ranked, warnings, engineName: settings.engineName, settings };
}

async function sourceTab(message, sender) {
  if (sender.tab && !sender.url?.startsWith(ownOrigin)) return sender.tab;
  if (Number.isInteger(message.sourceTabId) && message.sourceTabId >= 0) {
    try {
      const tab = await chrome.tabs.get(message.sourceTabId);
      if (!tab.incognito && !tab.url?.startsWith(ownOrigin)) return tab;
    } catch { /* The original tab may have been closed while the palette was open. */ }
  }
  return null;
}

async function activateTab(id) {
  const tab = await chrome.tabs.get(id);
  if (tab.incognito) throw new Error('此扩展不读取或操作无痕窗口。');
  await chrome.tabs.update(id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  recent.set(id, Date.now());
  chrome.storage.session.set({ recent: Object.fromEntries(recent) }).catch(() => {});
}

async function openResult(message, sender) {
  const result = message.result;
  if (!result || typeof result !== 'object') throw new Error('请选择一个有效结果。');
  if (result.kind === 'tab' && Number.isInteger(result.tabId)) {
    try { await activateTab(result.tabId); }
    catch { throw new Error('该标签页已关闭或不可用，请重新搜索。'); }
    return {};
  }
  if (!['bookmark', 'history', 'url', 'search'].includes(result.kind) || !safeUrl(result.url)) {
    throw new Error('仅支持打开有效的 HTTP 或 HTTPS 地址。');
  }
  const source = await sourceTab(message, sender);
  if (message.disposition === 'current' && source?.id) {
    await chrome.tabs.update(source.id, { url: result.url, active: true });
    await chrome.windows.update(source.windowId, { focused: true });
  } else {
    const properties = { url: result.url, active: true };
    if (source?.id) Object.assign(properties, { windowId: source.windowId, index: source.index + 1 });
    await chrome.tabs.create(properties);
    if (source?.windowId) await chrome.windows.update(source.windowId, { focused: true });
  }
  return {};
}

async function favicon(url) {
  if (!safeUrl(url)) return { dataUrl: null };
  const pageUrl = new URL(url).href;
  if (iconCache.has(pageUrl)) return { dataUrl: await iconCache.get(pageUrl) };
  const promise = (async () => {
    try {
      const iconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
      iconUrl.searchParams.set('pageUrl', pageUrl);
      iconUrl.searchParams.set('size', '32');
      const response = await fetch(iconUrl);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 65536) return null;
      const mime = response.headers.get('content-type') || 'image/png';
      if (!mime.startsWith('image/')) return null;
      return `data:${mime};base64,${btoa(String.fromCharCode(...bytes))}`;
    } catch { return null; }
  })();
  // Bounded session cache; these are Chrome's local favicon resources, never site requests.
  if (iconCache.size >= 256) iconCache.delete(iconCache.keys().next().value);
  iconCache.set(pageUrl, promise);
  return { dataUrl: await promise };
}

export async function handleMessage(message, sender = {}) {
  if (sender.id && sender.id !== chrome.runtime.id) throw new Error('Invalid sender.');
  switch (message.type) {
    case 'bootstrap': {
      if (sender.tab?.id) clients.add(sender.tab.id);
      cssPromise ||= fetch(chrome.runtime.getURL('palette.css')).then(response => {
        if (!response.ok) throw new Error('无法读取界面样式。');
        return response.text();
      }).catch(error => { cssPromise = null; throw error; });
      const [css, settings, info] = await Promise.all([cssPromise, getSettings(), chrome.runtime.getPlatformInfo()]);
      return { css, settings, platform: info.os };
    }
    case 'query': return query(message, sender);
    case 'open': return openResult(message, sender);
    case 'favicon': return favicon(message.url);
    case 'settings': await chrome.runtime.openOptionsPage(); return {};
    case 'get-settings': return { settings: await getSettings(), engines: ENGINES, historyLimit: HISTORY_LIMIT };
    case 'save-settings': {
      const settings = sanitizeSettings(message.settings);
      await chrome.storage.local.set({ settings: { engine: settings.engine, historyDays: settings.historyDays } });
      invalidateHistory();
      return { settings };
    }
    case 'dismiss': {
      const tab = await sourceTab(message, sender);
      if (tab) await activateTab(tab.id);
      return {};
    }
    default: throw new Error('Unknown message.');
  }
}

const messageTypes = new Set(['bootstrap', 'query', 'open', 'favicon', 'settings', 'get-settings', 'save-settings', 'dismiss']);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || !messageTypes.has(message.type)) return false;
  handleMessage(message, sender).then(data => respond({ ok: true, ...data }), error => respond({ ok: false, error: error.message || '操作失败，请重试。' }));
  return true;
});

export async function togglePalette(tab) {
  if (!tab?.id || tab.incognito) return;
  if (tab.url?.startsWith(ownOrigin + 'page.html')) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'toggle-page', tabId: tab.id });
      if (response?.ok) return;
    } catch { /* The fallback page may still be loading. Preserve its original source. */ }
    await chrome.tabs.update(tab.id, { url: tab.url, active: true });
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['palette.js', 'content.js'] });
  } catch {
    const url = new URL(chrome.runtime.getURL('page.html'));
    url.searchParams.set('source', String(tab.id));
    const [existing] = await chrome.tabs.query({ url: ownOrigin + 'page.html*', windowId: tab.windowId });
    if (existing) {
      await chrome.tabs.update(existing.id, { url: url.href, active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: url.href, active: true, windowId: tab.windowId });
    }
  }
}

chrome.action.onClicked.addListener(tab => { togglePalette(tab).catch(console.error); });
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
});
chrome.storage.session.get('recent').then(({ recent: values = {} }) => {
  for (const [id, time] of Object.entries(values)) if (Number.isFinite(time)) recent.set(Number(id), time);
}).catch(() => {});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  recent.set(tabId, Date.now());
  chrome.storage.session.set({ recent: Object.fromEntries(recent) }).catch(() => {});
  refreshClients();
});
chrome.tabs.onRemoved.addListener(tabId => { recent.delete(tabId); clients.delete(tabId); refreshClients(); });
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.title || change.url || change.status === 'complete' || change.pinned !== undefined) refreshClients();
  if (change.status === 'complete') { historyRevision++; historyCache = null; }
});
chrome.tabs.onCreated.addListener(refreshClients);
chrome.tabs.onAttached.addListener(refreshClients);
chrome.tabs.onDetached.addListener(refreshClients);
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId < 0) return;
  chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab && !tab.incognito) {
      recent.set(tab.id, Date.now());
      chrome.storage.session.set({ recent: Object.fromEntries(recent) }).catch(() => {});
      refreshClients();
    }
  }).catch(() => {});
});
for (const event of ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onImportEnded']) {
  chrome.bookmarks[event].addListener(() => { bookmarkPromise = null; refreshClients(); });
}
chrome.history.onVisited.addListener(invalidateHistory);
chrome.history.onVisitRemoved.addListener(invalidateHistory);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) invalidateHistory();
});
