import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../extension/palette.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// A deliberately small DOM stub tests startup ordering and input identity, not browser rendering or native IME.
function fixture({ queryHandler } = {}) {
  const document = {};
  class Node {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.parentNode = null; this.attributes = new Map();
      this.listeners = new Map(); this.dataset = {}; this.value = ''; this.className = ''; this.scrollTop = 0;
      this.style = { cssText: '', setProperty() {} }; this.focusCalls = 0;
      this.classList = {
        add: name => this.changeClass(name, true), remove: name => this.changeClass(name, false),
        toggle: (name, enabled) => this.changeClass(name, enabled)
      };
    }
    changeClass(name, enabled) {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      if (enabled) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    }
    get isConnected() { return this === document.documentElement || Boolean(this.parentNode?.isConnected); }
    set textContent(value) { this.replaceChildren(); this.text = String(value); }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
    replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.text = ''; this.append(...nodes); }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    attachShadow({ mode }) {
      const root = new Node('#shadow-root'); root.parentNode = this; root.host = this;
      this.shadowRoot = mode === 'open' ? root : null;
      return root;
    }
    focus() {
      this.focusCalls++;
      let parent = this.parentNode;
      while (parent && parent.tagName !== '#shadow-root') parent = parent.parentNode;
      if (parent) { parent.activeElement = this; document.activeElement = parent.host; }
      else document.activeElement = this;
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, fields = {}) {
      const event = { type, target: this, preventDefault() {}, stopPropagation() {}, ...fields };
      for (const listener of this.listeners.get(type) || []) listener(event);
    }
    querySelector(selector) {
      for (const child of this.children) {
        if (child.tagName === selector) return child;
        const found = child.querySelector(selector); if (found) return found;
      }
      return null;
    }
    scrollIntoView() {}
  }
  document.createElement = tag => new Node(tag);
  document.createElementNS = (_, tag) => new Node(tag);
  document.documentElement = new Node('html');
  document.body = new Node('body'); document.documentElement.append(document.body);
  const original = new Node('input'); document.body.append(original); original.focus();
  const messages = [], bootstraps = [], listeners = new Set();
  const chrome = { runtime: {
    onMessage: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) },
    sendMessage: async message => {
      messages.push(message);
      if (message.type === 'bootstrap') { const pending = deferred(); bootstraps.push(pending); return pending.promise; }
      if (message.type === 'query') return queryHandler ? queryHandler(message) : { ok: true, results: [{ id: 'action:' + message.query, kind: 'url', title: message.query, url: 'https://example.test/' + encodeURIComponent(message.query) }] };
      return { ok: true };
    }
  } };
  const context = vm.createContext({ document, chrome, navigator: { platform: 'MacIntel' }, setTimeout, clearTimeout, performance });
  vm.runInContext(source, context);
  const palette = new context.ArcSearchPalette();
  const ready = (index = 0, css = 'complete-css') => bootstraps[index].resolve({ ok: true, css, platform: 'mac', settings: { engineName: 'Bing' } });
  const refresh = () => { for (const listener of listeners) listener({ type: 'refresh' }); };
  return { palette, document, original, messages, bootstraps, ready, refresh };
}

function enter(palette, fields = {}) {
  palette.keydown({ key: 'Enter', target: palette.input, isTrusted: true, preventDefault() {}, stopPropagation() {}, ...fields });
}

async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('The deferred palette operation did not complete.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('focus is synchronous; bootstrap preserves the input and an active composition', async () => {
  const f = fixture();
  const opened = f.palette.open();
  const input = f.palette.input;
  assert(input?.isConnected, 'The input must exist before the bootstrap response.');
  assert.equal(f.palette.root.activeElement, input);
  assert.equal(input.focusCalls, 1);
  assert.equal(f.palette.host.shadowRoot, null);
  input.value = 'zhongwen'; input.emit('compositionstart'); input.emit('input');
  enter(f.palette);
  assert.equal(f.messages.filter(message => message.type !== 'bootstrap').length, 0);
  f.ready(); await opened;
  assert.equal(f.palette.input, input);
  assert.equal(input.value, 'zhongwen');
  assert.equal(input.focusCalls, 1, 'Bootstrap must not refocus or restart the native composition.');
  assert.equal(f.palette.composing, true);
  assert.equal(f.palette.style.textContent, 'complete-css');
  assert.equal(f.messages.filter(message => message.type === 'query').length, 0);
  input.value = '中文'; input.emit('compositionend'); input.emit('input');
  await until(() => !f.palette.pendingQuery);
  assert.equal(f.messages.find(message => message.type === 'query').query, '中文');
  assert.equal(f.messages.filter(message => message.type === 'open').length, 0);
  f.palette.close(); assert.equal(f.document.activeElement, f.original);
});

test('a trusted pre-bootstrap Enter executes once after the matching query is ready', async () => {
  const f = fixture(); const opened = f.palette.open();
  f.palette.input.value = 'example.test'; f.palette.input.emit('input'); enter(f.palette, { metaKey: true });
  assert.equal(f.messages.length, 1);
  f.ready(); await opened;
  const actions = f.messages.filter(message => message.type === 'open');
  assert.equal(actions.length, 1); assert.equal(actions[0].disposition, 'current');
  assert.equal(actions[0].result.title, 'example.test'); assert.equal(f.palette.closed, true);
});

test('refresh invalidating the initial query preserves early Enter for the newest committed query', async () => {
  const queries = [];
  const f = fixture({ queryHandler: () => { const pending = deferred(); queries.push(pending); return pending.promise; } });
  const opened = f.palette.open();
  f.palette.input.value = 'queued'; f.palette.input.emit('input'); enter(f.palette);
  f.ready(); await until(() => queries.length === 1);
  f.refresh();
  queries[0].resolve({ ok: true, results: [{ id: 'stale', kind: 'url', title: 'stale', url: 'https://example.test/stale' }] });
  await opened;
  assert.equal(f.palette.deferredEnter?.query, 'queued', 'An invalidated query must not consume the queued submission.');
  assert.equal(f.messages.filter(message => message.type === 'open').length, 0);
  await until(() => queries.length === 2);
  queries[1].resolve({ ok: true, results: [{ id: 'latest', kind: 'url', title: 'latest', url: 'https://example.test/latest' }] });
  await until(() => f.palette.closed);
  const actions = f.messages.filter(message => message.type === 'open');
  assert.equal(actions.length, 1); assert.equal(actions[0].result.id, 'latest');
  assert.equal(f.palette.deferredEnter, null);
});

test('a failed current query cancels queued Enter before a later refresh succeeds', async () => {
  let fail = true;
  const f = fixture({ queryHandler: () => fail ? { ok: false, error: 'Query unavailable' } : { ok: true, results: [{ id: 'later', kind: 'url', title: 'later', url: 'https://example.test/later' }] } });
  const opened = f.palette.open();
  f.palette.input.value = 'queued'; f.palette.input.emit('input'); enter(f.palette);
  f.ready(); await opened;
  assert.equal(f.palette.deferredEnter, null);
  fail = false; f.refresh(); await until(() => !f.palette.pendingQuery);
  assert.equal(f.messages.filter(message => message.type === 'open').length, 0);
  f.palette.close();
});

test('editing cancels an early Enter instead of submitting different text', async () => {
  const f = fixture(); const opened = f.palette.open();
  f.palette.input.value = 'first'; f.palette.input.emit('input'); enter(f.palette);
  f.palette.input.value = 'second'; f.palette.input.emit('input');
  f.ready(); await opened;
  assert.equal(f.messages.find(message => message.type === 'query').query, 'second');
  assert.equal(f.messages.filter(message => message.type === 'open').length, 0);
  f.palette.close();
});

test('bootstrap failure and retry retain input identity and clear stale submission', async () => {
  const f = fixture(); const opened = f.palette.open(); const input = f.palette.input;
  input.value = 'keep me'; input.emit('input'); enter(f.palette);
  f.bootstraps[0].reject(new Error('Worker unavailable')); await opened;
  assert.equal(f.palette.input, input); assert.equal(input.value, 'keep me');
  assert.equal(f.palette.deferredEnter, null);
  f.palette.status.querySelector('button').emit('click');
  f.ready(1); await until(() => f.palette.bootstrapReady && !f.palette.pendingQuery);
  assert.equal(f.palette.input, input); assert.equal(input.value, 'keep me'); assert.equal(input.focusCalls, 1);
  assert.equal(f.messages.filter(message => message.type === 'open').length, 0);
  f.palette.close();
});

test('a closed/reopened palette ignores the earlier bootstrap response', async () => {
  const f = fixture(); const first = f.palette.open(); const oldInput = f.palette.input;
  f.palette.close(); const second = f.palette.open(); const currentInput = f.palette.input;
  assert.notEqual(oldInput, currentInput);
  f.ready(0, 'stale-css'); await first;
  assert.equal(f.palette.bootstrapReady, false);
  assert.notEqual(f.palette.style.textContent, 'stale-css');
  f.ready(1, 'current-css'); await second;
  assert.equal(f.palette.input, currentInput); assert.equal(f.palette.style.textContent, 'current-css');
  f.palette.close();
});
