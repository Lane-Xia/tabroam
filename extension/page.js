(() => {
  let palette;
  let currentTabId;
  chrome.tabs.getCurrent().then(tab => { currentTabId = tab?.id; });
  const raw = new URL(location.href).searchParams.get('source');
  const sourceTabId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const open = async () => {
    if (palette) return;
    const current = new globalThis.ArcSearchPalette({
      standalone: true, sourceTabId,
      onClose: reason => {
        if (reason === 'retry') return;
        palette = null;
        if (globalThis.__arcSearchPalette === current) globalThis.__arcSearchPalette = null;
        if (reason === 'escape' && sourceTabId !== null) {
          chrome.runtime.sendMessage({ type: 'dismiss', sourceTabId }).catch(() => {});
        } else if (reason !== 'opened') document.querySelector('#reopen').focus();
      }
    });
    palette = current;
    globalThis.__arcSearchPalette = current;
    try { await current.open(); }
    catch (error) { console.error(error); current.close('close'); }
  };
  document.querySelector('#reopen').addEventListener('click', open);
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'toggle-page' && message.tabId === currentTabId) {
      if (palette) palette.close('close');
      else open();
      respond({ ok: true });
    }
    return false;
  });
  open();
})();
