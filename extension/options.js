(() => {
  const form = document.querySelector('#settings');
  const status = document.querySelector('#status');
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || '设置加载失败，请重新打开此页面。');
    return result;
  }
  send({ type: 'get-settings' }).then(({ settings }) => {
    form.elements.engine.value = settings.engine;
    form.elements.historyDays.value = String(settings.historyDays);
  }).catch(error => { status.textContent = error.message; });
  chrome.commands.getAll().then(commands => {
    const shortcut = commands.find(command => command.name === '_execute_action')?.shortcut;
    document.querySelector('#shortcut').textContent = shortcut || '未分配，请点击下方按钮设置';
  });
  chrome.runtime.getPlatformInfo().then(info => {
    document.querySelector('#current').textContent = info.os === 'mac' ? '⌘ Enter' : 'Ctrl Enter';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '正在保存…';
    try {
      await send({ type: 'save-settings', settings: { engine: form.elements.engine.value, historyDays: Number(form.elements.historyDays.value) } });
      status.textContent = '已保存';
    } catch (error) { status.textContent = error.message; }
  });
  document.querySelector('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
})();
