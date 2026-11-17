# TabRoam 隐私政策 / Privacy Policy

> 本政策适用于 TabRoam 1.0.6，发布者为 LaneXia。政策的公开提供不代表扩展已提交或获 Chrome Web Store 批准；扩展目前尚未提交商店。 / This policy applies to TabRoam 1.0.6, published by LaneXia. Public availability of the policy does not mean the extension has been submitted to or approved by the Chrome Web Store; the extension has not been submitted.

**适用版本 / Applies to：** TabRoam 1.0.6

**生效及更新日期 / Effective and updated：** 2026-11-17

**发布者 / Publisher：** LaneXia

**联系邮箱 / Contact email：** [xialei0792@gmail.com](mailto:xialei0792@gmail.com)

**公开政策地址 / Public policy URL：** [https://lane-xia.github.io/tabroam/](https://lane-xia.github.io/tabroam/)

## 中文

### 1. 范围与用途

本政策说明 TabRoam 扩展如何处理用户数据。TabRoam 的单一用途是通过命令栏在本地搜索已打开标签页、书签和浏览历史，并按你的选择切换标签、访问网址或执行网络搜索。

TabRoam 不要求注册账号，不包含开发者自建的数据接收服务器、分析 SDK、广告或遥测功能，也不销售用户数据。开发者不会通过该扩展收到你的标签页列表、书签、历史记录或输入内容。

### 2. 在设备上读取和使用的数据

| 数据 | 用途与处理方式 |
| --- | --- |
| 普通窗口的标签页标题、URL、标签和窗口 ID、最近活跃时间、固定状态 | 跨窗口搜索、切换标签、恢复来源标签和按最近使用情况排序。无痕窗口不启用本扩展。 |
| 书签树及条目的 ID、标题、URL、添加时间 | 在非空查询时读取本地书签；HTTP(S) 条目参与本地匹配和去重。 |
| 浏览历史条目的 ID、标题、URL、最近访问时间 | 在非空查询时读取历史。默认检索最近 180 天，可选 30 / 90 / 180 / 365 天或全部时间，每次最多读取最近 20,000 条；HTTP(S) 条目参与匹配。 |
| 你在命令栏输入的文本及选择的结果 | 在页面与扩展后台之间传递，用于本地匹配、展示与执行所选操作；不建立持久化的查询日志。 |
| 最近标签 ID 与活跃时间戳 | 在标签激活、窗口聚焦和扩展切换标签时更新，保存于 chrome.storage.session；面板关闭时也可更新。 |
| 搜索引擎、历史检索时间范围和操作系统平台类型 | 引擎和时间范围保存于 chrome.storage.local；平台类型仅用于显示相应键盘提示。 |
| 网站 favicon、对应页面 URL 与本地展示缓存 | 向 Chrome 自身的扩展 _favicon 端点请求图标，在本地缓存并显示；扩展不为获取图标自行请求目标站点或外部图标代理。 |

标签标题、URL、历史、书签和输入文本本身可能含有个人信息或敏感内容。即使这些信息仅在设备上处理，它们仍属于本政策披露的数据处理。扩展不抓取网页正文或其他网页表单字段值来建立索引，也不读取浏览器保存的密码或 Cookie。

### 3. 网络请求与第三方

输入期间，TabRoam 不向网络搜索建议接口发送文字，也不联网检索网页结果。扩展自身的资源读取限于安装包内的样式等文件和 Chrome 本地 favicon 端点。

当你执行网址、书签、历史或网络搜索结果时，扩展会让浏览器打开相应地址。目标网站会收到正常浏览请求；执行网络搜索时，你选择的 Google、Bing、DuckDuckGo 或百度会收到搜索词。浏览器还可能按其正常设置发送 IP 地址、请求头、该站点 Cookie 等请求信息。这些接收方按各自的隐私政策处理数据，而不是替 TabRoam 开发者收集本地候选。

预设搜索引擎地址使用 HTTPS。你可以选择访问 HTTP 或 HTTPS 网址；HTTP 目标请求不具有由 HTTPS 提供的传输保护，扩展没有增加另一层传输加密。

Chrome、Chrome Web Store、其他 Chromium 浏览器、输入法和目标网站可能有自己的同步、安全浏览、商店统计或其他数据处理行为，受其设置与政策约束。本扩展不调用 chrome.storage.sync，也不提供自有云同步。本隐私政策页面由 GitHub Pages 托管。访问本页时，GitHub 会记录并保存访问者的 IP 地址用于安全目的，无论访问者是否登录 GitHub。相关处理由 GitHub 的隐私声明约束；本页的托管访问日志与 TabRoam 扩展的本地标签、书签、历史和查询处理分开。本页面没有添加开发者的分析脚本或遥测代码。

[GitHub Pages 数据收集说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)；[GitHub 隐私声明](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)。

### 4. 本地缓存与保留边界

| 数据或位置 | 实际保留边界 |
| --- | --- |
| 引擎与时间范围设置：chrome.storage.local | 保留到你修改设置，或浏览器在移除扩展时清理扩展存储。清除普通浏览历史不等于清除这些设置。 |
| 最近标签：chrome.storage.session | Chrome 在内存中保存；按 Chrome 的机制，在禁用、重新加载、更新扩展或浏览器重启时清除。关闭单个标签并不保证已存会话条目即时删除。 |
| 历史与书签副本：后台运行内存 | 历史缓存会在相关事件或设置变化时失效，后续查询可替换缓存；15 秒是查询时判断能否复用的阈值，不是定时删除承诺。书签缓存随书签事件失效。后台上下文终止时，其内存由浏览器回收。 |
| favicon 缓存：后台与面板运行内存 | 后台缓存最多 256 个页面 URL 的图标；面板还有单独临时缓存。缓存可随替换、对象回收或对应运行上下文结束而释放，没有统一的定时清除期限。 |
| 输入与候选：页面及扩展运行内存 | 未主动写入持久化查询日志。关闭面板移除其界面，但不承诺立即安全擦除所有内存；剩余对象由浏览器按生命周期回收，刷新页面或结束相应上下文会结束页面运行状态。 |

历史检索的 180 天默认值和 20,000 条上限只是读取范围与条数上限，不是自动删除浏览器历史或长期归档历史的规则。执行访问和搜索之后，浏览器或目标服务可能按自己的规则保留记录。

### 5. 你的选择与删除

- 你可以在设置页更换搜索引擎或缩小历史检索范围，决定是否执行搜索或导航，并在浏览器扩展管理页禁用或卸载 TabRoam。
- 扩展目前没有独立的“清空全部数据”按钮。重新加载、禁用扩展或重启浏览器可按 Chrome 的机制清除会话存储；刷新已注入的网页可结束其中的面板运行状态。
- 卸载时 Chrome 会清理扩展自己的本地存储；这不删除浏览器已有的历史、书签、网站数据，也不删除搜索引擎或目标网站的记录。请使用相应浏览器或服务提供的数据管理功能。
- 本地历史或书签发生变化时，扩展监听相关事件，使缓存失效或更新展示；扩展本身不调用历史或书签删除接口。

### 6. 权限、存储与访问边界

tabs、history、bookmarks 用于本地检索和标签导航；storage 用于上述设置和会话最近标签；favicon 用于本地图标。activeTab 与 scripting 用于在你点击扩展或执行快捷键后按需显示网页浮层，不申请常驻全部站点权限。

命令栏运行在扩展隔离世界并使用封闭 Shadow DOM，host.shadowRoot 不直接提供候选内容。网页浮层仍位于你打开的网站中，网站脚本可能按浏览器事件规则观察到键盘或组合输入事件；封闭 Shadow DOM 不隔离所有输入事件。网站自身脚本如何处理这些事件，受网站的政策与实现约束。本扩展没有为本地设置、会话数据或缓存实现额外加密，不宣称所有本地数据已被扩展加密。

开发者没有接收本地浏览数据的接口，也不安排人员查看这些数据。如你主动发送支持邮件或附件，请避免包含完整浏览记录、密码、访问令牌或其他不必要的敏感信息；这种主动发送的内容由你选择的邮件服务处理。

### 7. Limited Use 声明

TabRoam 对通过 Chrome / Google API 获取的信息的使用与传输遵守 Chrome Web Store 用户数据政策及其中的 Limited Use 要求。浏览数据仅用于本政策披露的本地搜索与导航用途。

TabRoam 不将这些数据出售或交给广告平台、数据经纪商，不用于个性化广告、信用评估、放贷判断或与扩展用途无关的分析。除你主动执行导航或搜索所必需的目标请求外，扩展不主动向开发者或第三方传输本地候选数据，也不让开发者人员通过扩展读取这些数据；这不替代第 6 节说明的网站事件与浏览器边界。

[Chrome Web Store Limited Use 政策](https://developer.chrome.com/docs/webstore/program-policies/limited-use)

### 8. 政策变更与联系

本政策自 2026-11-17 生效，适用于 TabRoam 1.0.6，由 LaneXia 发布，并通过 GitHub Pages 提供公开访问。政策公开不代表扩展已提交或已获 Chrome Web Store 批准；扩展目前尚未提交商店。以后数据处理方式发生变化时，应更新本政策及相应商店披露。

隐私问题请联系：[xialei0792@gmail.com](mailto:xialei0792@gmail.com)。发布者：LaneXia。公开政策地址：[https://lane-xia.github.io/tabroam/](https://lane-xia.github.io/tabroam/)。

## English

### 1. Scope and purpose

This policy explains how the TabRoam extension handles user data. Its single purpose is to search open tabs, bookmarks and browsing history locally through a command bar, then switch tabs, navigate to a URL or run a web search when you choose an action.

TabRoam does not require an account and contains no developer-operated data receiver, analytics SDK, advertising or telemetry feature. It does not sell user data. The developer does not receive your tab list, bookmarks, browsing history or command-bar input through the extension.

### 2. Data read and used on your device

| Data | Purpose and handling |
| --- | --- |
| Normal-window tab titles, URLs, tab/window IDs, last-active times and pinned status | Searching across windows, switching tabs, restoring the source tab and ranking recent tabs. The extension is not enabled in incognito windows. |
| Bookmark tree and item IDs, titles, URLs and creation times | Reading local bookmarks for non-empty queries; HTTP(S) entries participate in local matching and deduplication. |
| Browsing-history item IDs, titles, URLs and last-visit times | Reading history for non-empty queries. The default range is 180 days; choices are 30, 90, 180 or 365 days, or all time. Each read is limited to the most recent 20,000 entries in the selected range. HTTP(S) entries participate in matching. |
| Command-bar input and selected results | Passing data between the page interface and extension background to match, display and execute your chosen action. No persistent query log is created. |
| Recent tab IDs and active timestamps | Updating on tab activation, window focus and extension-initiated tab switching; stored in chrome.storage.session. This can continue while the command bar is closed. |
| Search-engine choice, history range and operating-system platform type | Saving the engine and history range in chrome.storage.local. Platform type is used only to show relevant keyboard hints. |
| Website favicons, their page URLs and local display caches | Requesting icons from Chrome’s extension-local _favicon endpoint, caching and displaying them locally. The extension does not itself contact destination sites or an external favicon proxy to fetch icons. |

Titles, URLs, history, bookmarks and input can themselves contain personal or sensitive information. Processing them only on your device is still data handling covered by this policy. The extension does not scrape page body text or other website form values to build its index, and does not read browser-saved passwords or cookies.

### 3. Network requests and third parties

While you type, TabRoam does not send your text to online suggestion services or retrieve web search results. Its own resource reads are limited to packaged resources such as styles and Chrome’s extension-local favicon endpoint.

When you execute a URL, bookmark, history or web-search result, the extension asks the browser to open the corresponding address. The destination receives a normal browsing request; a web search sends the search terms to your chosen Google, Bing, DuckDuckGo or Baidu service. Depending on normal browser settings, requests may also include an IP address, request headers and that site’s cookies. These recipients handle requests under their own privacy policies; they are not collecting your local candidate list for the TabRoam developer.

Built-in search-engine URLs use HTTPS. You can choose HTTP or HTTPS destinations. HTTP requests do not have HTTPS transport protection, and the extension adds no separate transport-encryption layer.

Chrome, the Chrome Web Store, other Chromium browsers, input methods and destination sites may have independent sync, Safe Browsing, store-statistics or other data practices governed by their own settings and policies. The extension does not call chrome.storage.sync or implement its own cloud sync. This privacy-policy page is hosted on GitHub Pages. When you visit it, GitHub logs and stores the visitor’s IP address for security purposes, whether or not the visitor is signed into GitHub. GitHub handles this information under its own privacy statement. These hosting-access logs are separate from the TabRoam extension’s local handling of tabs, bookmarks, history and queries. This page adds no developer analytics scripts or telemetry code.

[GitHub Pages data-collection information](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection); [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

### 4. Local caches and retention boundaries

| Data or location | Actual retention boundary |
| --- | --- |
| Engine and history-range settings: chrome.storage.local | Kept until you change them or the browser clears extension storage when the extension is removed. Clearing normal browsing history does not by itself clear these settings. |
| Recent tabs: chrome.storage.session | Held in memory by Chrome and cleared under Chrome’s mechanism when the extension is disabled, reloaded or updated, or the browser restarts. Closing a single tab does not guarantee immediate removal of an already stored session entry. |
| History and bookmark copies: background memory | History caches are invalidated by relevant events or settings changes and may be replaced on later queries. Fifteen seconds is a cache-reuse threshold checked during queries, not a timed-deletion promise. Bookmark events invalidate the bookmark cache. The browser reclaims background memory when that context ends. |
| Favicon caches: background and panel memory | The background cache holds icons for at most 256 page URLs; the panel has a separate temporary cache. Entries may be released by replacement, garbage collection or termination of the relevant context. There is no universal timed-deletion period. |
| Input and candidates: page and extension memory | Not deliberately written to a persistent query log. Closing the panel removes its interface, but does not promise an immediate secure erasure of all memory. The browser reclaims remaining objects according to their lifecycle; refreshing the page or ending its context ends that page’s runtime state. |

The 180-day default and 20,000-entry cap are limits on history reads, not rules for deleting browser history or maintaining a long-term archive. After navigation or search, the browser or destination service may retain records under its own rules.

### 5. Your choices and deletion

- You can change the engine or narrow the history range in Settings, choose whether to execute a search or navigation action, and disable or uninstall TabRoam in the browser’s extension manager.
- The extension currently has no separate “clear all data” button. Reloading or disabling it, or restarting the browser, clears session storage under Chrome’s mechanism. Refreshing an injected page ends the panel state running in that page.
- Chrome clears the extension’s own local storage on removal. Uninstalling does not delete existing browser history, bookmarks, website data or records kept by search engines and destination sites. Use the relevant browser or service’s data controls for those records.
- When local history or bookmarks change, the extension listens for relevant events to invalidate caches or refresh the display. It does not itself call history- or bookmark-deletion APIs.

### 6. Permissions, storage and access boundaries

tabs, history and bookmarks support local search and tab navigation; storage supports the settings and recent-tab session state described above; favicon supports local icons. activeTab and scripting display the overlay on demand after you invoke the extension, without requesting persistent access to all sites.

The command bar runs in the extension’s isolated world and uses a closed Shadow DOM; host.shadowRoot does not directly expose candidate content. The overlay is still displayed within the site you opened. Site scripts may observe keyboard or composition events under the browser’s event rules; a closed Shadow DOM does not isolate every input event. How a site handles these events depends on that site’s policies and implementation. The extension does not implement additional encryption for local settings, session data or caches, and does not claim to encrypt all local data itself.

The developer has no interface for receiving your local browsing data and does not arrange human review of it. If you voluntarily send a support email or attachment, avoid including complete browsing records, passwords, access tokens or other unnecessary sensitive information. Such voluntary messages are handled by the email service you choose.

### 7. Limited Use statement

TabRoam’s use and transfer of information received through Chrome / Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Browsing data is used only for the local search and navigation purposes disclosed in this policy.

TabRoam does not sell this data or provide it to advertising platforms or data brokers, and does not use it for personalized advertising, credit evaluation, lending decisions or unrelated analytics. Other than destination requests needed for navigation or searches you choose to execute, the extension does not actively transfer local candidate data to the developer or third parties, or allow developer personnel to read it through the extension. This does not override the site-event and browser boundaries described in section 6.

[Chrome Web Store Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)

### 8. Changes and contact

This policy is effective from 2026-11-17, applies to TabRoam 1.0.6, is published by LaneXia, and is made publicly available through GitHub Pages. Publishing the policy does not mean the extension has been submitted to or approved by the Chrome Web Store; the extension has not been submitted. Changes to data practices should be reflected in this policy and the relevant store disclosures.

For privacy questions, contact: [xialei0792@gmail.com](mailto:xialei0792@gmail.com). Publisher: LaneXia. Public policy URL: [https://lane-xia.github.io/tabroam/](https://lane-xia.github.io/tabroam/).

