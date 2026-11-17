(() => {
  if (globalThis.__arcSearchPalette) {
    globalThis.__arcSearchPalette.close('close');
    return;
  }
  const palette = new globalThis.ArcSearchPalette({
    onClose: reason => { if (reason !== 'retry' && globalThis.__arcSearchPalette === palette) globalThis.__arcSearchPalette = null; }
  });
  globalThis.__arcSearchPalette = palette;
  palette.open().catch(error => { console.error('TabRoam:', error); palette.close('close'); });
})();
