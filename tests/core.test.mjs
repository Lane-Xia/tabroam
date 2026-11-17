import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, canonicalUrl, classifyInput, rankResults } from '../extension/core.mjs';

test('normalizes Unicode, case and whitespace without inventing pinyin', () => {
  assert.equal(normalizeText('  ＧＯＯＧＬＥ\t数据库  '), 'google 数据库');
  assert.equal(normalizeText(null), '');
});

test('recognizes domains, IPs, ports, localhost, IPv6 and explicit HTTPS', () => {
  const cases = new Map([
    ['example.com/docs?q=test#intro', 'https://example.com/docs?q=test#intro'],
    ['HTTPS://EXAMPLE.COM/Path', 'https://example.com/Path'],
    ['//example.com/path', 'https://example.com/path'],
    ['192.0.2.10:8080/metrics', 'http://192.0.2.10:8080/metrics'],
    ['localhost:3000/path', 'http://localhost:3000/path'],
    ['localhost:443/path', 'http://localhost:443/path'],
    ['localhost/path', 'http://localhost/path'],
    ['db-proxy:8080/status', 'http://db-proxy:8080/status'],
    ['db-proxy:443/status', 'http://db-proxy:443/status'],
    ['[::1]:3000/path', 'http://[::1]:3000/path'],
    ['例子.中国/文档', 'https://xn--fsqu00a.xn--fiqs8s/%E6%96%87%E6%A1%A3'],
  ]);
  for (const [input, expected] of cases) {
    assert.equal(classifyInput(input).kind, 'url', input);
    assert.equal(classifyInput(input).url, expected, input);
  }
});

test('plain text, unsupported protocols and invalid addresses remain search actions', () => {
  for (const input of ['数据库 代理', 'hello world', 'google', 'javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/a', 'ftp://example.com', 'chrome-extension://abc/a.html', 'user@example.com', 'site:example.com', 'localhost:99999', '999.999.999.999']) {
    assert.equal(classifyInput(input).kind, 'search', input);
  }
  assert.equal(classifyInput('  '), null);
});

test('encodes queries and rejects unsafe or malformed search templates', () => {
  const result = classifyInput('中文 & a/b?', 'https://www.bing.com/search?q={query}');
  assert.equal(new URL(result.url).searchParams.get('q'), '中文 & a/b?');
  assert.match(classifyInput('hello world', 'javascript:{query}').url, /^https:\/\/www\.google\.com\//);
  assert.match(classifyInput('hello world', 'https://example.com/').url, /^https:\/\/www\.google\.com\//);
});

test('canonicalizes browser-equivalent URLs but preserves navigation distinctions', () => {
  assert.equal(canonicalUrl('HTTPS://EXAMPLE.COM:443'), 'https://example.com/');
  for (const [left, right] of [
    ['http://example.com/', 'https://example.com/'],
    ['https://example.com/Path', 'https://example.com/path'],
    ['https://example.com/a', 'https://example.com/a/'],
    ['https://example.com/#a', 'https://example.com/#b'],
    ['https://example.com/?a=1', 'https://example.com/?a=2'],
  ]) assert.notEqual(canonicalUrl(left), canonicalUrl(right));
});

test('empty query shows actual tabs by recency across windows, including pinned tabs', () => {
  const { results, total } = rankResults('', [
    { id: 'old', kind: 'tab', tabId: 1, windowId: 1, title: 'Old', url: 'https://old.test', lastAccessed: 10 },
    { id: 'bookmark', kind: 'bookmark', title: 'Bookmark', url: 'https://bookmark.test', dateAdded: 1000 },
    { id: 'recent', kind: 'tab', tabId: 2, windowId: 9, title: 'Pinned', url: 'https://recent.test', pinned: true, lastAccessed: 20 },
  ]);
  assert.equal(total, 2);
  assert.deepEqual(results.map(item => item.id), ['recent', 'old']);
  assert.equal(results[0].windowId, 9);
  assert.equal(results[0].pinned, true);
});

test('dedup prefers existing tabs while preserving each actual tab and bookmark aliases', () => {
  const { results } = rankResults('代理文档', [
    { id: 't1', kind: 'tab', tabId: 1, title: 'Document', url: 'https://docs.test/' },
    { id: 't2', kind: 'tab', tabId: 2, title: 'Document copy', url: 'https://docs.test/' },
    { id: 'b1', kind: 'bookmark', title: '代理文档', url: 'https://docs.test/' },
    { id: 'h1', kind: 'history', title: 'Read me', url: 'https://docs.test/' },
  ]);
  assert.deepEqual(results.filter(item => item.kind === 'tab').map(item => item.id), ['t1', 't2']);
  assert.equal(results.some(item => ['bookmark', 'history'].includes(item.kind)), false);
  assert.deepEqual(results[0].sources, ['tab', 'bookmark', 'history']);
});

test('relevance dominates source priority; equal relevance prefers tabs then bookmarks', () => {
  const { results } = rankResults('proxy', [
    { id: 't1', kind: 'tab', title: 'A guide to proxy', url: 'https://a.test' },
    { id: 'b1', kind: 'bookmark', title: 'Proxy', url: 'https://b.test' },
    { id: 'h1', kind: 'history', title: 'Proxy', url: 'https://h.test' },
    { id: 't2', kind: 'tab', title: 'Proxy', url: 'https://t.test' },
  ]);
  assert.deepEqual(results.slice(0, 4).map(item => item.id), ['t2', 'b1', 'h1', 't1']);
});

test('matches multilingual tokens across title and URL, including percent-encoded paths', () => {
  const candidates = [
    { id: 'a', kind: 'tab', title: '数据库 Proxy Guide', url: 'https://docs.test/%E8%BF%90%E7%BB%B4/mysql' },
    { id: 'b', kind: 'tab', title: '数据库 Redis', url: 'https://redis.test/' },
  ];
  assert.equal(rankResults('数据库 MYSQL', candidates).results[0].id, 'a');
  assert.equal(rankResults('运维', candidates).results[0].id, 'a');
  assert.equal(rankResults('不存在 mysql', candidates).results.some(item => item.kind === 'tab'), false);
});

test('light fuzzy matching handles typos without fuzzy-matching short Chinese or URL syntax', () => {
  const candidates = [{ id: 'a', kind: 'tab', title: 'Google 数据库', url: 'https://google.com/docs' }];
  for (const query of ['gogle', 'googlw', 'googel']) assert.equal(rankResults(query, candidates).results[0].id, 'a', query);
  for (const query of ['数剧', 'gogl', 'gogle.com']) assert.equal(rankResults(query, candidates).results.some(item => item.kind === 'tab'), false, query);
});

test('keeps URL navigation and network search usable even with many local matches', () => {
  const candidates = Array.from({ length: 30 }, (_, i) => ({ id: String(i), kind: 'tab', title: `example.com guide ${i}`, url: `https://a${i}.test/` }));
  const { results, total } = rankResults('example.com', candidates, { limit: 5, engineName: 'Bing', searchTemplate: 'https://www.bing.com/search?q={query}' });
  assert.equal(results.length, 5);
  assert.equal(total, 32);
  assert.equal(results[0].kind, 'url');
  assert.equal(results.at(-1).kind, 'search');
  assert.equal(results.at(-1).engineName, 'Bing');
  assert.equal(new URL(results.at(-1).url).hostname, 'www.bing.com');
  assert.equal(rankResults('example.com', candidates, { limit: 1 }).results[0].kind, 'search');
});

test('no local match still produces a real network-search action', () => {
  const { results, total } = rankResults('no matching query', []);
  assert.equal(total, 1);
  assert.equal(results[0].kind, 'search');
  assert.equal(new URL(results[0].url).searchParams.get('q'), 'no matching query');
});

test('a full URL selects the exact existing scheme and matches encoded paths', () => {
  const candidates = [
    { id: 'http', kind: 'tab', title: 'HTTP', url: 'http://example.com/' },
    { id: 'https', kind: 'tab', title: 'HTTPS', url: 'https://example.com/' },
    { id: 'cn', kind: 'tab', title: '中文', url: 'https://docs.test/%E6%96%87%E6%A1%A3' },
  ];
  assert.equal(rankResults('https://example.com/', candidates).results[0].id, 'https');
  assert.equal(rankResults('https://docs.test/%E6%96%87%E6%A1%A3', candidates).results[0].id, 'cn');
  assert.equal(rankResults('https://', candidates).results.some(item => item.kind === 'tab'), false);
  assert.equal(rankResults('https://example.com/path/', [{ id: 'without-slash', kind: 'tab', title: 'A', url: 'https://example.com/path' }]).results[0].kind, 'url');
});
