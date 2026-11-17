(() => {
  if (globalThis.ArcSearchPalette) return;

  // Mount and focus before messaging the service worker: startup can otherwise lose the first keystrokes.
  const INITIAL_CSS = `:host{all:initial;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}.backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:#12101861;backdrop-filter:blur(11px);font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#d1d0d2}.panel{width:min(766px,100%);max-height:calc(100dvh - 40px);overflow:hidden;background:#1c1b1e;border:1px solid #57535b;border-radius:12px}.search-row{display:flex;align-items:center;gap:14px;height:64px;margin:0 11px;padding:0 10px 0 13px;border-bottom:1px solid #ffffff1a}.search-icon{width:14px;height:14px;flex:0 0 14px;color:#fff}svg{display:block;width:100%;height:100%}.search-input{flex:1;min-width:0;width:0;height:48px;padding:0;background:transparent;border:0;outline:0;color:#efedf1;font:550 18px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.4px;caret-color:#4d8add}.search-input::placeholder{color:#666265}.info-button{width:24px;height:24px;flex:0 0 24px;padding:4px;border:0;border-radius:50%;background:#0c0c26;color:#9494b1}.results:empty{display:none}.status{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 23px;font-size:12px;line-height:18px;color:#9e99a5}.status.error{color:#f3b4bc}.retry{padding:6px 10px;color:#fff;background:#4249d8;border:0;border-radius:5px;cursor:pointer}`;

  const paths = {
    search: ["M21 21l-4.6-4.6", "M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0"],
    arrow: ["M5 12h14", "m13 6 6 6-6 6"],
    info: ["M12 16v-4", "M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"],
    bookmark: ["M6 3h12v18l-6-4-6 4V3Z"],
    history: ["M3 11a9 9 0 1 1 2.5 7.2", "M3 4v7h7", "M12 7v5l3 2"],
    globe: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "M3 12h18", "M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18"],
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const d of paths[name] || paths.globe) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  }

  function focusedElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  class ArcSearchPalette {
    constructor({ standalone = false, sourceTabId = null, onClose = () => {} } = {}) {
      this.standalone = standalone;
      this.sourceTabId = sourceTabId;
      this.onClose = onClose;
      this.host = null;
      this.results = [];
      this.selectedIndex = 0;
      this.queryVersion = 0;
      this.composing = false;
      this.opening = false;
      this.closed = true;
      this.iconCache = new Map();
    }

    async send(message) {
      const response = await chrome.runtime.sendMessage(message);
      if (!response?.ok) throw new Error(response?.error || "The extension did not respond. Please reload it and refresh this page.");
      return response;
    }

    async open() {
      if (this.host?.isConnected) {
        this.input?.focus({ preventScroll: true });
        return;
      }
      this.closed = false;
      this.bootstrapError = null;
      this.bootstrapReady = false;
      this.pendingQuery = true;
      this.deferredEnter = null;
      this.composing = false;
      this.opening = false;
      this.context = { css: INITIAL_CSS, settings: {}, platform: globalThis.navigator?.platform?.includes("Mac") ? "mac" : "win" };
      this.previousFocus = focusedElement();
      this.host = element("div");
      this.host.id = "arc-search-root";
      this.host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;visibility:visible!important;";
      this.root = this.host.attachShadow({ mode: "closed" });
      (document.documentElement || document.body).append(this.host);
      this.build();
      this.input.focus({ preventScroll: true });
      await this.bootstrap();
    }

    async bootstrap() {
      const host = this.host;
      const version = this.bootstrapVersion = (this.bootstrapVersion || 0) + 1;
      this.bootstrapError = null;
      this.bootstrapReady = false;
      this.pendingQuery = true;
      this.input.setAttribute("aria-busy", "true");
      this.panel.classList.add("loading");
      this.setStatus("Loading command bar…");
      try {
        const context = await this.send({ type: "bootstrap" });
        if (this.closed || host !== this.host || version !== this.bootstrapVersion) return;
        this.context = context;
        this.style.textContent = context.css;
        this.bootstrapReady = true;
        this.updateInfoTitle();
        if (this.composing) return;
        await this.query();
      } catch (error) {
        if (this.closed || host !== this.host || version !== this.bootstrapVersion) return;
        this.bootstrapError = error;
        this.deferredEnter = null;
        this.panel.classList.remove("loading");
        this.input.setAttribute("aria-busy", "false");
        this.showError(error, true);
      }
    }

    build() {
      this.style = element("style");
      this.style.textContent = this.context.css;
      this.backdrop = element("div", `backdrop${this.standalone ? " standalone" : ""}`);
      this.panel = element("section", "panel");
      this.panel.setAttribute("role", "dialog");
      this.panel.setAttribute("aria-modal", "true");
      this.panel.setAttribute("aria-label", "TabRoam — Search or Enter URL");
      const row = element("div", "search-row");
      const searchIcon = element("span", "search-icon");
      searchIcon.append(icon("search"));
      this.input = element("input", "search-input");
      this.input.id = "arc-search-input";
      this.input.type = "text";
      this.input.placeholder = "Search or Enter URL...";
      this.input.autocomplete = "off";
      this.input.spellcheck = false;
      this.input.setAttribute("autocapitalize", "off");
      this.input.setAttribute("role", "combobox");
      this.input.setAttribute("aria-label", "Search tabs, history, bookmarks, or enter a URL");
      this.input.setAttribute("aria-expanded", "true");
      this.input.setAttribute("aria-autocomplete", "list");
      this.input.setAttribute("aria-controls", "arc-search-results");
      this.infoButton = element("button", "info-button");
      this.infoButton.type = "button";
      this.infoButton.setAttribute("aria-label", "TabRoam settings and keyboard shortcuts");
      this.updateInfoTitle();
      this.infoButton.append(icon("info"));
      row.append(searchIcon, this.input, this.infoButton);
      this.list = element("div", "results");
      this.list.id = "arc-search-results";
      this.list.setAttribute("role", "listbox");
      this.list.setAttribute("aria-label", "Search results");
      this.status = element("div", "status");
      this.status.setAttribute("role", "status");
      this.status.setAttribute("aria-live", "polite");
      this.status.hidden = true;
      this.panel.append(row, this.list, this.status);
      this.backdrop.append(this.panel);
      this.root.append(this.style, this.backdrop);

      this.input.addEventListener("input", () => {
        this.deferredEnter = null;
        if (!this.composing) this.scheduleQuery();
      });
      this.input.addEventListener("compositionstart", () => {
        this.deferredEnter = null;
        this.composing = true;
        this.queryVersion += 1;
        this.pendingQuery = true;
        clearTimeout(this.timer);
      });
      this.input.addEventListener("compositionend", () => {
        this.composing = false;
        this.suppressEnterUntil = performance.now() + 50;
        this.scheduleQuery();
      });
      this.infoButton.addEventListener("click", async () => {
        try { await this.send({ type: "settings" }); }
        catch (error) { this.showError(error); }
      });
      this.root.addEventListener("keydown", (event) => this.keydown(event));
      this.root.addEventListener("keyup", (event) => event.stopPropagation());
      this.backdrop.addEventListener("pointerdown", (event) => {
        if (event.target === this.backdrop) {
          event.preventDefault();
          this.close("outside");
        }
      });
      this.refreshListener = (message) => {
        if (message.type === "refresh" && !this.closed && !this.composing) {
          if (message.settings) this.context.settings = message.settings;
          this.scheduleQuery();
        }
      };
      chrome.runtime.onMessage.addListener(this.refreshListener);
    }

    scheduleQuery() {
      clearTimeout(this.timer);
      this.queryVersion += 1;
      this.pendingQuery = true;
      if (!this.bootstrapReady) return;
      this.timer = setTimeout(() => this.query(), 120);
    }

    async query() {
      if (this.closed || this.composing || !this.bootstrapReady) return;
      clearTimeout(this.timer);
      const version = ++this.queryVersion;
      const query = this.input.value;
      let committed = false;
      this.pendingQuery = true;
      this.input.setAttribute("aria-busy", "true");
      this.panel.classList.add("loading");
      const loadingTimer = setTimeout(() => {
        if (version === this.queryVersion && !this.closed) this.setStatus("Searching your browser…");
      }, 180);
      try {
        const response = await this.send({ type: "query", query, sourceTabId: this.sourceTabId });
        if (this.closed || version !== this.queryVersion) return;
        if (response.settings) this.context.settings = response.settings;
        this.updateInfoTitle();
        const sameQuery = this.renderedQuery === query;
        const scrollTop = sameQuery ? this.list.scrollTop : 0;
        const selectedId = sameQuery ? this.results[this.selectedIndex]?.id : null;
        this.results = response.results || [];
        this.selectedIndex = Math.max(0, this.results.findIndex(result => result.id === selectedId));
        this.renderedQuery = query;
        this.render(query, { scrollTop, preserveSelection: sameQuery });
        if (response.warnings?.length) this.setStatus(response.warnings.join(" · "), "warning");
        else if (!this.results.length) this.setStatus(query.trim() ? "No results. Try another title, URL, or keyword." : "No open tabs yet. Enter a URL or a search term.");
        else this.setStatus("");
        committed = true;
      } catch (error) {
        if (!this.closed && version === this.queryVersion) {
          this.deferredEnter = null;
          this.results = [];
          this.list.replaceChildren();
          this.input.removeAttribute("aria-activedescendant");
          this.showError(error);
        }
      } finally {
        clearTimeout(loadingTimer);
        if (!this.closed && version === this.queryVersion) {
          this.pendingQuery = false;
          this.panel.classList.remove("loading");
          this.input.setAttribute("aria-busy", "false");
        }
      }
      if (committed && !this.closed && version === this.queryVersion) {
        const intent = this.deferredEnter;
        this.deferredEnter = null;
        if (intent && !this.composing && this.input.value === intent.query && this.results[this.selectedIndex]) {
          await this.execute(this.results[this.selectedIndex], intent.disposition);
        }
      }
    }

    render(query, { scrollTop = 0, preserveSelection = false } = {}) {
      this.list.replaceChildren();
      this.panel.dataset.hasQuery = String(Boolean(query.trim()));
      const tabCounts = new Map();
      for (const result of this.results) {
        if (result.kind === "tab") tabCounts.set(result.url, (tabCounts.get(result.url) || 0) + 1);
      }
      this.rows = this.results.map((result, index) => {
        const row = element("div", "result");
        row.id = `arc-search-option-${index}`;
        row.dataset.kind = result.kind;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(index === this.selectedIndex));
        row.title = result.url || result.title;
        const favicon = element("span", "favicon");
        favicon.append(icon(result.kind === "search" ? "search" : result.kind === "url" ? "globe" : result.kind === "bookmark" ? "bookmark" : result.kind === "history" ? "history" : "globe"));
        const copy = element("span", "result-copy");
        const title = element("span", "result-title", result.title || result.url || "Untitled");
        copy.append(title);
        const duplicateTab = result.kind === "tab" && tabCounts.get(result.url) > 1;
        if (duplicateTab || (query.trim() && result.url && !["url", "search"].includes(result.kind))) {
          const windowHint = duplicateTab ? `Window ${result.windowId} · Tab ${result.tabId}` : "";
          const subtitle = element("span", "result-url", [windowHint, query.trim() ? result.url.replace(/^https?:\/\//i, "") : ""].filter(Boolean).join(" · "));
          copy.append(subtitle);
          if (duplicateTab) row.setAttribute("aria-label", `${result.title || result.url}, ${windowHint}`);
        }
        const action = element("span", "result-action");
        const label = element("span", "action-label", {
          tab: "Switch to Tab",
          bookmark: "Open Bookmark",
          history: "Open History",
          url: "Go to URL",
          search: `Search ${this.context.settings?.engineName || "Google"}`,
        }[result.kind] || "Open");
        const arrow = element("span", "action-arrow");
        arrow.append(icon("arrow"));
        action.append(label, arrow);
        row.append(favicon, copy, action);
        row.addEventListener("pointerdown", (event) => event.preventDefault());
        row.addEventListener("pointermove", () => this.select(index, false));
        row.addEventListener("click", (event) => {
          if (event.isTrusted) this.execute(result, event.metaKey || event.ctrlKey ? "current" : "new");
        });
        this.list.append(row);
        if (!["url", "search"].includes(result.kind) && result.url) this.loadFavicon(result.url, favicon);
        return row;
      });
      this.list.scrollTop = scrollTop;
      this.select(this.selectedIndex, preserveSelection);
    }

    async loadFavicon(url, container) {
      try {
        if (!this.iconCache.has(url)) {
          this.iconCache.set(url, this.send({ type: "favicon", url }).then((response) => response.dataUrl).catch(() => null));
        }
        const dataUrl = await this.iconCache.get(url);
        if (this.closed || !container.isConnected || !/^data:image\//.test(dataUrl || "")) return;
        const img = element("img");
        img.src = dataUrl;
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        img.addEventListener("error", () => { if (container.isConnected) container.replaceChildren(icon("globe")); }, { once: true });
        container.replaceChildren(img);
      } catch { /* A missing cached favicon keeps the local fallback icon. */ }
    }

    select(index, scroll = true) {
      if (!this.results.length) {
        this.input.removeAttribute("aria-activedescendant");
        return;
      }
      this.selectedIndex = Math.max(0, Math.min(index, this.results.length - 1));
      this.rows?.forEach((row, rowIndex) => {
        const selected = rowIndex === this.selectedIndex;
        row.classList.toggle("selected", selected);
        row.setAttribute("aria-selected", String(selected));
      });
      const active = this.rows?.[this.selectedIndex];
      if (active) {
        this.input.setAttribute("aria-activedescendant", active.id);
        if (scroll) active.scrollIntoView({ block: "nearest" });
      }
    }

    keydown(event) {
      event.stopPropagation();
      if (this.composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.close("escape");
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (this.results.length) this.select((this.selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + this.results.length) % this.results.length);
      } else if ((event.key === "Home" || event.key === "End") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.select(event.key === "Home" ? 0 : this.results.length - 1);
      } else if (event.key === "Enter" && event.target === this.input) {
        event.preventDefault();
        if (!event.isTrusted) return;
        if (performance.now() < (this.suppressEnterUntil || 0)) return;
        if (!this.bootstrapReady) {
          if (!this.bootstrapError) {
            this.deferredEnter = { query: this.input.value, disposition: event.metaKey || event.ctrlKey ? "current" : "new" };
            this.setStatus("Loading command bar…");
          }
          return;
        }
        if (this.pendingQuery) {
          this.deferredEnter = { query: this.input.value, disposition: event.metaKey || event.ctrlKey ? "current" : "new" };
          this.query();
        } else if (this.results[this.selectedIndex]) this.execute(this.results[this.selectedIndex], event.metaKey || event.ctrlKey ? "current" : "new");
      } else if (event.key === "Tab") {
        const focusable = [this.input, this.infoButton, this.status.querySelector("button")].filter(Boolean);
        const index = focusable.indexOf(this.root.activeElement);
        event.preventDefault();
        focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
      }
    }

    async execute(result, disposition) {
      if (this.opening || this.composing || this.closed) return;
      if (!this.bootstrapReady || this.pendingQuery) return;
      this.opening = true;
      this.panel.classList.add("opening");
      try {
        await this.send({ type: "open", result, disposition, sourceTabId: this.sourceTabId });
        this.close("opened");
      } catch (error) {
        if (!this.closed) this.showError(error);
      } finally {
        this.opening = false;
        this.panel?.classList.remove("opening");
      }
    }

    setStatus(message, kind = "") {
      this.status.replaceChildren();
      this.status.className = `status ${kind}`.trim();
      this.status.textContent = message;
      this.status.hidden = !message;
    }

    updateInfoTitle() {
      this.infoButton.title = `${this.context.settings?.engineName || "Google"} · ↑↓ Select · Enter Open · ${this.context.platform === "mac" ? "⌘" : "Ctrl"}+Enter Open in current tab · Esc Close`;
    }

    showError(error, bootstrap = false) {
      this.setStatus(error.message || String(error), "error");
      const retry = element("button", "retry", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => {
        if (bootstrap) {
          this.bootstrap();
        } else this.query();
      });
      this.status.append(retry);
    }

    close(reason = "close") {
      if (this.closed) return;
      this.closed = true;
      this.deferredEnter = null;
      this.bootstrapVersion = (this.bootstrapVersion || 0) + 1;
      this.queryVersion += 1;
      clearTimeout(this.timer);
      if (this.refreshListener) chrome.runtime.onMessage.removeListener(this.refreshListener);
      this.host?.remove();
      if (this.previousFocus?.isConnected) {
        try { this.previousFocus.focus({ preventScroll: true }); } catch { /* The original control may no longer accept focus. */ }
      }
      this.onClose(reason);
    }
  }

  globalThis.ArcSearchPalette = ArcSearchPalette;
})();
