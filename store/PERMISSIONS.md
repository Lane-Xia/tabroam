# TabRoam — Chrome Web Store 权限填写文案

审核日期：2026-11-17（Asia/Shanghai）。适用当前 **1.0.5** 源码；本文件为提交材料草稿，没有在 Chrome Web Store 填写、上传或提交。代码路径均相对 `outputs/arc-search/`。数据分类和保留边界见 [DATA-PRACTICES.md](DATA-PRACTICES.md)。

## Single purpose description

以下 English 段落可直接粘贴到 Single purpose description：

```text
TabRoam provides one keyboard-driven command bar to find and navigate pages: search open tabs, bookmarks and browser history locally, switch to an existing tab across normal Chrome windows, open a URL, or send a user-submitted query to the selected search engine.
```

中文对照：

```text
TabRoam 提供一个键盘优先的页面查找与导航命令栏：在本地搜索已打开标签页、书签和浏览历史，跨普通 Chrome 窗口切换已有标签页，打开网址，或将用户主动提交的查询发送到所选搜索引擎。
```

依据：`extension/background.mjs:56–129`（本地数据及查询）、`:143–173`（切换与导航）；`extension/core.mjs:140–182`（本地匹配、去重、导航/搜索入口）。这些行为围绕同一个页面查找与导航目的，不包含侧边栏、Spaces、广告或分析服务。

## Permissions justification

当前 manifest 恰有以下七项权限：`extension/manifest.json:7`。English 块可分别粘贴到对应权限字段；中文为同义说明。权限的可授予能力可能大于当前代码实际使用范围，下列文案描述实际用途。

### activeTab

```text
Temporarily access the active page only after the user invokes TabRoam with its toolbar button or keyboard shortcut, so the command bar can be displayed on that page. This avoids persistent access to all websites. Restricted pages use a standalone extension page instead.
```

```text
仅在用户点击工具栏按钮或按快捷键唤起 TabRoam 后，临时访问当前页面以展示命令栏，避免申请所有网站的常驻访问权限。Chrome 不允许注入的页面使用独立扩展页作为备用入口。
```

依据：`extension/manifest.json:7,11–15`；`extension/background.mjs:239–264`。代码没有常驻 `content_scripts` 或 `host_permissions` 声明。该权限用途不能推导成“浏览数据只在用户打开面板时处理”：会话内标签激活时间仍由后台事件更新，见 `extension/background.mjs:269–291`。

### scripting

```text
Inject the packaged palette.js and content.js files into the user-invoked active tab to create the search overlay. The scripts implement TabRoam's own input and result controls; they do not scrape the page body or load executable code from a server.
```

```text
将安装包内的 palette.js 和 content.js 注入用户主动唤起的当前标签页，建立搜索浮层。这些脚本实现 TabRoam 自己的输入和结果控件，不抓取网页正文，也不从服务器加载执行代码。
```

依据：`extension/background.mjs:249–250`；`extension/palette.js:67–88,119–193`。脚本会操作扩展创建的 DOM 并保存原焦点元素引用以恢复焦点（`extension/palette.js:40–43,80,417–428`）；不要把“不抓正文”写成“完全不接触宿主 DOM”。

### tabs

```text
Read the titles, URLs and tab metadata needed to search open tabs across the user's normal Chrome windows. Activate a selected existing tab and focus its window, or open the user-selected URL/search in the requested tab. Incognito and TabRoam's own pages are excluded from search results.
```

```text
读取普通 Chrome 窗口内标签页的标题、网址及检索所需元数据，支持跨窗口查找、激活所选标签并聚焦窗口，以及按用户选择打开网址或搜索。检索排除无痕标签和 TabRoam 自身页面。
```

依据：`extension/background.mjs:56–64,132–173`；`extension/manifest.json:18`。权限理由主要是跨窗口标题/URL 读取，不应只写“创建新标签页”：创建标签页本身不是申请 `tabs` 的充分理由。

### history

```text
Read browser-history titles, URLs and last-visit times to include previously visited pages in local command-bar search. The selected time range defaults to 180 days, with at most 20,000 recent records per lookup. TabRoam does not modify or delete browser history and does not upload it to a developer server.
```

```text
读取浏览历史的标题、网址和最近访问时间，让用户在命令栏中本地查找曾访问页面。默认时间范围为 180 天，每次读取最多最近 20,000 条记录。TabRoam 不修改或删除浏览历史，也不向开发者服务器上传历史记录。
```

依据：`extension/background.mjs:9–10,87–105,113–127`；`extension/options.html:13–14`。历史 API 只在非空查询时读取；空输入仅列最近使用的已打开标签。这里的时间范围是检索范围，不是扩展承诺的数据删除期限。

### bookmarks

```text
Read the user's bookmark tree so saved HTTP/HTTPS page titles and URLs can appear in local command-bar search. Listen for bookmark changes to refresh results. TabRoam does not create, edit, move or delete bookmarks and does not upload the bookmark tree to a developer server.
```

```text
读取书签树，将保存的 HTTP/HTTPS 页面标题和网址加入命令栏本地搜索，并监听书签变化以更新结果。TabRoam 不创建、修改、移动或删除书签，也不向开发者服务器上传书签树。
```

依据：`extension/background.mjs:67–84,113–127,295–297`。Chrome 返回完整书签树；扩展遍历后保留用于搜索的网页条目，不把完整树写入持久存储。

### storage

```text
Save the selected search engine and history time range in chrome.storage.local. Keep tab IDs and their recent activation timestamps in chrome.storage.session to order recent tabs across service-worker restarts. Search queries, page titles and full history/bookmark lists are not written to extension storage; storage.sync is not used.
```

```text
在 chrome.storage.local 中保存搜索引擎及历史时间范围；在 chrome.storage.session 中保存标签 ID 与最近激活时间，用于 Service Worker 重启后的最近标签排序。不向扩展存储写入查询词、页面标题或完整历史/书签列表，不使用 storage.sync。
```

依据：`extension/background.mjs:28–31,143–150,217–220,265–291`。本地设置保留至覆盖或扩展移除；会话存储遵循 Chrome 的生命周期，不等于关闭面板即删除。代码没有应用层加密或一键清除按钮，详见数据说明。

### favicon

```text
Retrieve page icons through Chrome's extension-origin _favicon resource and display them beside local search results so users can identify pages. The extension reads the icon bytes in its service worker and sends image data to the panel; it does not call a third-party favicon service or execute image data as code.
```

```text
通过 Chrome 扩展来源下的 _favicon 资源取得页面图标，显示在本地搜索结果旁帮助识别页面。后台读取图标字节并将图片数据交给面板，不调用第三方 favicon 服务，也不把图片数据作为代码执行。
```

依据：`extension/background.mjs:176–197`；`extension/palette.js:302,309–322`。实际 `fetch` 的来源是 `chrome-extension://…/_favicon/`，不是把结果 URL 发送到外部图标网站。此结论不代表 Chrome 浏览器自身永不联网。

## Host permissions

当前无 `host_permissions`、`optional_host_permissions` 或 `<all_urls>`，也没有常驻站点匹配声明；不需要为并不存在的全站点权限填写理由。`activeTab` 提供用户唤起时的临时授权。依据：`extension/manifest.json:1–20`；[Chrome activeTab 官方说明](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)。

## Remote code

选择：**No, I am not using remote code.**

如有说明字段，可粘贴：

```text
All executable JavaScript is included in the extension package. The service worker imports only the packaged core module; injected scripts and extension-page scripts are packaged files. The only fetch calls read the packaged stylesheet and Chrome's extension-origin favicon resource. No remote JavaScript, WebAssembly, eval, dynamic code loader or analytics SDK is used. A user-requested search opens a normal browser page; its content is not loaded as extension code.
```

中文对照：

```text
全部可执行 JavaScript 均随扩展打包。后台仅导入包内核心模块，注入脚本和扩展页面脚本也都是包内文件。仅有的 fetch 用于读取包内样式和 Chrome 扩展来源的 favicon 资源；未使用远程 JavaScript、WebAssembly、eval、动态代码加载器或分析 SDK。用户执行网络搜索时打开普通浏览器页面，不把其内容加载为扩展代码。
```

依据：`extension/manifest.json:8,19`；`extension/background.mjs:1,176–210,249–250`；`extension/page.html:9–10`；`extension/options.html:5`。已逐文件读取运行时 JS 并检索外部加载入口，未发现其他网络请求、远程脚本导入、`eval`、`new Function`、WebAssembly 或遥测 SDK。官方定义见 [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)。

## 填写时保留的事实边界

- “本地搜索”和“开发者没有接收服务器”不等于“不处理用户数据”。Chrome 要求披露本地数据处理；请按 [DATA-PRACTICES.md](DATA-PRACTICES.md) 填数据类别，并保持隐私政策与后台一致。[官方 User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- 执行网络搜索会将关键词交给所选搜索引擎；打开网址会产生正常站点请求，目标方按自己的政策处理网络信息。`extension/background.mjs:3–7,152–173`。
- 网页浮层不是对宿主网站的安全输入隔离。受控原生日志已显示宿主捕获阶段能观察部分组合/输入事件；不能承诺其他网站绝对无法观察输入。详见数据说明中的实现边界。
- 原生快速输入仍有已知的首字符缺失问题；现有 40 项本地测试不构成原生输入稳定性通过。参见 [README 中保留的已知输入限制](../README.md)。本次权限材料不宣称修复或重测该问题。

Chrome Web Store 的字段含义和审核原则以 [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) 为准。本文件提供可复制草稿与代码依据，不表示已取得商店审核通过。
