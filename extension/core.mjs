const DEFAULT_SEARCH = 'https://www.google.com/search?q={query}';
const SOURCE_PRIORITY = { tab: 0, bookmark: 1, history: 2, url: 3, search: 4 };

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

export function canonicalUrl(value) {
  const text = String(value ?? '').trim();
  try { return new URL(text).href; } catch { return text; }
}

function searchUrl(query, template) {
  const candidate = String(template || DEFAULT_SEARCH);
  try {
    const parsed = new URL(candidate.replaceAll('{query}', encodeURIComponent(query)));
    if (candidate.includes('{query}') && /^https?:$/.test(parsed.protocol)) return parsed.href;
  } catch { /* An invalid saved template falls back to the built-in engine. */ }
  return DEFAULT_SEARCH.replace('{query}', encodeURIComponent(query));
}

export function classifyInput(input, searchTemplate = DEFAULT_SEARCH) {
  const title = String(input ?? '').trim();
  if (!title) return null;
  const text = title.normalize('NFKC');
  const search = () => ({ kind: 'search', title, url: searchUrl(title, searchTemplate) });
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.hostname) return { kind: 'url', title, url: url.href };
    } catch { /* Malformed addresses remain searchable text. */ }
    return search();
  }
  if (/\s/u.test(text)) return search();
  const address = text.startsWith('//') ? text.slice(2) : text;
  if (address.split(/[/?#]/, 1)[0].includes('@')) return search();
  try {
    const parsed = new URL(`https://${address}`);
    const host = parsed.hostname;
    const bareHost = host.replace(/\.$/, '');
    const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(bareHost);
    const ipv6 = host.startsWith('[') && host.endsWith(']');
    const localhost = bareHost === 'localhost' || bareHost.endsWith('.localhost');
    const domain = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}][\p{L}\p{N}-]{1,62}$/u.test(bareHost);
    const explicitPort = /:\d+$/.test(address.split(/[/?#]/, 1)[0]);
    const internalWithPort = /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(bareHost) && explicitPort;
    if (ipv4 || ipv6 || localhost || domain || internalWithPort) {
      // Reparse rather than mutating protocol: HTTPS parsing has already dropped an explicit :443.
      const url = ipv4 || ipv6 || localhost || internalWithPort ? new URL(`http://${address}`) : parsed;
      return { kind: 'url', title, url: url.href };
    }
  } catch { /* This also rejects invalid ports, IPv4 and unsupported schemes. */ }
  return search();
}

function searchableUrl(url) {
  let decoded = String(url ?? '');
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep malformed percent encodings literal. */ }
  return normalizeText(decoded).replace(/^https?:\/\//, '');
}

// One insertion, deletion, substitution or adjacent transposition; no broad subsequence matching.
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4 || a.length > 64) return false;
  if (a.length === b.length) {
    const differences = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) differences.push(i);
    if (differences.length <= 1) return true;
    const [left, right] = differences;
    return differences.length === 2 && right === left + 1 && a[left] === b[right] && a[right] === b[left];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0; let j = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i += 1; j += 1; }
    else if (i === j) j += 1;
    else return false;
  }
  return true;
}

function matchScore(query, tokens, title, rawUrl) {
  const url = searchableUrl(rawUrl);
  const name = normalizeText(title);
  const matchTokens = tokens.map(searchableUrl).filter(Boolean);
  if (!matchTokens.length) return null;
  let points = 0; let fuzzy = false;
  let words;
  for (const token of matchTokens) {
    const titleAt = name.indexOf(token);
    const urlAt = url.indexOf(token);
    if (titleAt >= 0) {
      points += titleAt === 0 || /[\s\-_/.:]/.test(name[titleAt - 1]) ? 90 : 65;
    } else if (urlAt >= 0) {
      points += urlAt === 0 || /[\s\-_/.:]/.test(url[urlAt - 1]) ? 65 : 45;
    } else {
      if (!/^[a-z0-9]{4,64}$/.test(token)) return null;
      words ??= `${name} ${url}`.match(/[a-z0-9]+/g) || [];
      if (!words.some(word => oneEdit(token, word))) return null;
      points += 15;
      fuzzy = true;
    }
  }
  if (fuzzy) return 200 + Math.min(points, 100);
  const rootlessUrl = url.replace(/^([^/?#]+)\/$/, '$1');
  const rootlessQuery = searchableUrl(query).replace(/^([^/?#]+)\/$/, '$1');
  if (/^https?:\/\//.test(query) && normalizeText(canonicalUrl(rawUrl)) === normalizeText(canonicalUrl(query))) return 1350;
  if (rootlessUrl === rootlessQuery) return 1300;
  if (name === query) return 1250;
  if (name.startsWith(query)) return 1100;
  if (url.startsWith(rootlessQuery)) return 1050;
  if (name.includes(query)) return 1000;
  if (url.includes(query)) return 950;
  return 500 + Math.min(points, 350);
}

function recency(item) {
  return Number(item.lastAccessed ?? item.lastVisitTime ?? item.dateAdded ?? 0) || 0;
}

function compare(a, b) {
  return b.score - a.score
    || (SOURCE_PRIORITY[a.kind] ?? 9) - (SOURCE_PRIORITY[b.kind] ?? 9)
    || recency(b) - recency(a)
    || String(a.id).localeCompare(String(b.id));
}

function groupedCandidates(candidates) {
  const groups = new Map();
  for (const [index, item] of candidates.entries()) {
    if (!item || !['tab', 'bookmark', 'history'].includes(item.kind) || !item.url) continue;
    const key = canonicalUrl(item.url);
    const candidate = { ...item, id: item.id ?? `${item.kind}:${item.tabId ?? `${key}:${index}`}` };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  return groups;
}

export function rankResults(input, candidates, {
  limit = 12,
  searchTemplate = DEFAULT_SEARCH,
  engineName = 'Google',
} = {}) {
  const rawQuery = String(input ?? '').trim();
  const query = normalizeText(rawQuery);
  const maximum = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 12;
  const groups = groupedCandidates(Array.isArray(candidates) ? candidates : []);
  const matches = [];
  const tokens = query.split(' ').filter(Boolean);
  for (const group of groups.values()) {
    const tabs = group.filter(item => item.kind === 'tab');
    const sources = [...new Set(group.map(item => item.kind))].sort((a, b) => SOURCE_PRIORITY[a] - SOURCE_PRIORITY[b]);
    if (!query) {
      matches.push(...tabs.map(item => ({ ...item, sources, score: 0 })));
      continue;
    }
    const scored = group.map(item => ({ item, score: matchScore(query, tokens, item.title, item.url) }));
    const eligible = scored.filter(item => item.score !== null);
    if (!eligible.length) continue;
    const score = Math.max(...eligible.map(item => item.score));
    // Titles from a bookmark/history remain aliases when the URL is already open.
    const representatives = tabs.length ? tabs : [group.toSorted((a, b) => (SOURCE_PRIORITY[a.kind] - SOURCE_PRIORITY[b.kind]) || recency(b) - recency(a))[0]];
    matches.push(...representatives.map(item => ({ ...item, sources, score })));
  }
  matches.sort(compare);
  if (!query) return { results: matches.slice(0, maximum), total: matches.length };
  const action = classifyInput(rawQuery, searchTemplate);
  if (action.kind === 'url') {
    matches.push({ ...action, id: `url:${action.url}`, score: 1150 });
    matches.sort(compare);
  }
  const search = {
    id: `search:${rawQuery}`,
    kind: 'search',
    title: rawQuery,
    url: searchUrl(rawQuery, searchTemplate),
    engineName,
    score: -1,
  };
  // Reserve a slot so a long local list never removes the network-search action.
  return { results: [...matches.slice(0, maximum - 1), search], total: matches.length + 1 };
}
