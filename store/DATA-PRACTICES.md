# TabRoam — 数据处理审计与商店披露映射

审计日期：2026-11-17（Asia/Shanghai）。审计对象：当前 `outputs/arc-search/extension/`，manifest **1.0.5**。仅审查与记录现有实现，没有运行新的浏览器验证、上传商店或提交发布。本文供隐私政策、商店字段与权限说明校准；它不替代公开隐私政策。所有代码路径相对 `outputs/arc-search/`。

## 审计结论

TabRoam **确实处理浏览数据和用户输入**，主要在用户设备内进行匹配、排序和显示；没有开发者接收服务器、账号系统、广告、分析 SDK 或主动遥测上传。选择网络搜索或网址访问后，会发生用户请求的正常浏览器导航，目标搜索引擎/站点可接收查询及请求信息。网页浮层的 closed Shadow DOM 不保证宿主页面无法观察输入事件。不能把这些事实缩写成“完全不处理数据”“没有任何第三方通信”或“输入对网站绝对保密”。

依据：`extension/background.mjs:56–129,152–210,269–302`；`extension/palette.js:61–64,80–87,160–184,203–255,343–388`；既有受控原生观察及当前 [README 中的隐私与输入限制](../README.md)。

## 实际数据清单

| 数据 | 来源、实际字段和时机 | 用途、去向及代码依据 |
|---|---|---|
| 已打开标签 | Chrome 普通窗口；使用 tab ID、window ID、标题、URL/待导航 URL、最近访问时间、固定状态。空查询和非空查询均读取；排除无痕与自身扩展页。 | 在本地列最近标签、搜索并跨窗口切换；返回匹配项给扩展面板。`extension/background.mjs:56–64,108–129,143–158`。 |
| 书签 | 非空查询时 `bookmarks.getTree()` 返回完整树，遍历 `children`；用于搜索的 HTTP/HTTPS 条目保留 ID、标题、URL、添加时间。 | 本地匹配；没有 create/update/move/remove 调用，不把书签树写入扩展持久存储。`extension/background.mjs:67–84,113–127,295–297`。 |
| 浏览历史 | 非空查询时读取；默认最近 180 天，可选 30/90/180/365 天或全部时间；Chrome 查询上限 20,000 条，再过滤 HTTP/HTTPS 且无 URL 用户名/密码的记录。使用 ID、标题、URL、最近访问时间。 | 本地搜索与排序；没有 history.delete* 调用。时间范围是读取范围，不是删除承诺。`extension/background.mjs:9–10,21–25,33–37,87–105,113–127`。 |
| 命令栏查询及组合输入 | 用户在 TabRoam 自己的输入框中输入。面板处理 input、composition、keydown 事件；后台收到查询文本后最多使用前 2,048 个 UTF-16 代码单元。 | 经扩展内部消息送给后台作本地匹配；查询与生成的搜索 URL 先留在内存，不因显示搜索建议而联网。`extension/palette.js:160–184,203–255,343–373`；`extension/background.mjs:108–129`；`extension/core.mjs:13–26,140–182`。 |
| 搜索/导航动作 | 用户点击真实结果或按 Enter；消息包含结果和新标签/当前标签的打开方式，以及必要的源 tab ID。 | 切换已有标签，或执行 `tabs.create` / `tabs.update`；关键词仅在用户执行网络搜索动作时包含在搜索目标 URL 中。`extension/palette.js:293–299,355–388`；`extension/background.mjs:132–173`。 |
| 会话内最近标签 | tab ID → 激活/窗口聚焦时间戳；来自后台事件。**即使命令栏未打开，也会更新。** | 为最近标签排序，在 worker 重启后恢复；保存在 `storage.session`，不是持久用户标识或 URL 浏览日志。`extension/background.mjs:18,62,143–150,269–291`。 |
| 页面图标 | 结果页 URL 作为本地 `_favicon` 查询参数；Chrome 返回图片字节，转为 data URL。 | 在面板显示网站图标；没有将 URL 交给外部 favicon 服务。worker 上限 256 个 URL 缓存项，单图字节上限 65,536；面板另有临时图标 Map。`extension/background.mjs:176–197`；`extension/palette.js:58,302,309–322`。 |
| 设置 | `engine`：google/bing/duckduckgo/baidu；`historyDays`：30/90/180/365/0。 | 唯一由产品写入 `storage.local` 的设置对象，用于选择搜索目标和历史读取范围。`extension/background.mjs:3–31,217–220,265–268`；`extension/options.js:9–25`。 |
| 平台及快捷键信息 | Chrome 返回平台类型和已注册扩展命令；面板初始化还使用 `navigator.platform` 作本地默认显示。 | 展示 ⌘/Ctrl 快捷键及选项页说明；不发送给开发者。`extension/background.mjs:209–210`；`extension/palette.js:79,401–403`；`extension/options.js:13–19`。 |
| 源标签 ID、窗口 ID与原焦点引用 | 备用页 URL 的 `source` 参数仅为本地 tab ID；网页浮层保存原焦点元素引用。 | 当前页打开/返回源标签及关闭后恢复焦点；不读取原网页输入框内容。`extension/background.mjs:132–140,239–259`；`extension/page.js:4–16`；`extension/palette.js:40–43,80,417–428`。 |

`tabs`/书签/历史接口返回的对象可能含更多 Chrome 字段；上表列出代码实际访问或保留的字段。标题、URL、书签名称和自由查询文本本身可能包含个人或敏感内容；代码不按此类语义做身份、健康或财务画像，不能据此保证这些字符串永远不含敏感信息。

## 数据流及网络边界

1. 用户唤起后，后台只注入包内 `palette.js` 和 `content.js`。没有全站点常驻脚本；`activeTab` 的临时权限与 `scripting` 用于创建浮层。`extension/background.mjs:239–264`；`extension/manifest.json:7–19`。
2. 面板与后台使用 `chrome.runtime` 消息传递查询和结果；匹配、去重与排序由包内 `core.mjs` 完成。没有外部消息监听器或声明外部网站连接。`extension/palette.js:61–64,218–232,378–384`；`extension/background.mjs:200–237`；`extension/core.mjs:140–182`；`extension/manifest.json:1–20`。
3. 运行时代码仅有两类 `fetch`：包内 `palette.css`，以及 `chrome-extension://…/_favicon/` 本地资源；没有 HTTP 接收端、遥测、广告、账号或分析 SDK 请求。`extension/background.mjs:176–210`。这里描述扩展自己的调用路径，不把 Chrome 自身的网络服务行为等同为扩展上传。
4. 主动网络搜索分别导航到 Google、Bing、DuckDuckGo 或百度的 HTTPS 网址；查询作为 URL 参数交给所选提供方。打开历史/书签/手输网址同样导航到目标站点。浏览器会按常规规则处理 IP、User-Agent、Cookie、Referer、历史记录和目标站点数据；扩展没有读取/上传 Cookie 的实现，也无法替这些目标方承诺保留期。`extension/background.mjs:3–7,152–173`；`extension/core.mjs:13–26`。
5. 地址访问允许 HTTP 和 HTTPS；IP、localhost、带端口内网主机可能默认生成 HTTP。**不能宣称所有访问都加密**，也不能把 URL 编码当成加密。所选引擎的内置搜索模板为 HTTPS。`extension/core.mjs:27–50`；`extension/background.mjs:3–7,33–37,160–170`。

查询虽没有写入扩展持久存储，但执行导航后，URL/查询可能出现在 Chrome 自身历史、目标搜索引擎记录或网站会话中；这与扩展维护的设置/缓存是不同数据存放位置。

## 存储、缓存、访问范围与删除

| 位置 | 内容与实际保留行为 | 清除/访问边界及证据 |
|---|---|---|
| `chrome.storage.local` | `settings: {engine, historyDays}`。没有 TTL；保存新值会覆盖对应设置。 | Chrome 在扩展移除时清除。默认可被本扩展的 content scripts 访问；代码没有调用 `setAccessLevel`，不能写“只有后台可读”。普通网页脚本不因此获得 extension storage 权限。代码：`extension/background.mjs:28–31,217–220,265–268`；平台行为：[Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)。 |
| `chrome.storage.session` | `recent: {tabId: timestamp}`，在内存中跨 worker 重启保留。没有设置固定小时数的过期时间，也不使用 `storage.sync`。 | Chrome 在扩展禁用、重新加载、更新或浏览器重启时清除；默认不向 content scripts 暴露，代码未改变该级别。标签关闭会先删除 worker 内存中的条目，session 中的旧值可能直到下次整体回写/会话清除才消失。`extension/background.mjs:143–150,269–291`；[Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)。 |
| worker 历史缓存 | 记录历史读取范围、读取时刻及已取得的条目。**15 秒是下次读取时是否复用的条件，不是定时擦除器。** | 下次查询发现过期/范围变化时替换；历史变化、部分标签加载完成、设置变化会失效；worker 结束后内存不再保留。没有“满 15 秒必定删除”的实现。`extension/background.mjs:14–15,50–54,87–105,278–280,298–302`。 |
| worker 书签缓存 | `bookmarkPromise` 保存已读搜索条目，没有时间 TTL。 | 书签变化事件使其失效；worker 结束后释放。查询返回失败时清除缓存引用以便重试。`extension/background.mjs:13,67–84,295–297`。 |
| worker 图标与辅助内存 | 图标 Map 最多 256 项；`clients` 为接收刷新消息的 tab ID 集合；`recent` 为排序 Map；样式缓存只含包内 CSS。 | 新图标达到上限时淘汰最早插入项；客户端失效/关闭标签时移除 ID；worker 生命周期内保留，不承诺实时安全擦除。`extension/background.mjs:12–18,40–47,176–208,277`。 |
| 面板内存与 DOM | 输入、组合状态、查询结果、待提交意图、源 tab ID、图片 data URL Map、原焦点元素引用。 | 关闭时取消计时器/待提交意图、解绑刷新监听、移除 DOM、解除全局实例引用；没有逐字段清零或密码学安全擦除。内存由浏览器垃圾回收管理。`extension/palette.js:46–58,417–428`；`extension/content.js:6–10`；`extension/page.js:9–17`。 |
| Chrome 原有历史/书签及目标站点数据 | 由浏览器/站点原本维护；扩展读取或按用户指令导航。 | 本版本没有删除原历史/书签的功能。清除原历史会使相关缓存失效，但不清除扩展设置；如需移除扩展保存的设置，可卸载扩展。查询后的站点记录按浏览器/提供方机制处理。`extension/background.mjs:67–105,152–173,298–302`；[Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)。 |

当前没有一键清除所有扩展数据按钮，没有 `storage.clear/remove`、本地查询日志、云同步、远程删除接口或应用层加密。不得在材料中虚构这些能力。关闭一个窗口不等于完整退出/重启 Chrome。

## 输入隔离与原生测试边界

网页浮层使用 closed Shadow DOM（`extension/palette.js:84`）。按键监听在 shadow root 的冒泡路径中停止传播（`extension/palette.js:180–181,343–345`）；这不阻止宿主页面更早的捕获阶段监听，也不自动阻断组合/输入事件。

此前受控 Tabbit 原生观察记录到了 `target: arc-search-root` 的 trusted `compositionupdate` / `input` 及部分组合文本。因此，当前实现**不构成对宿主页面的安全输入隔离**。可确认的是测试页面能够观察这些事件；没有据此证明任意真实网站已经收集或外传数据。本次材料不作架构重写，也不把 closed Shadow DOM 作为“其他网站绝不可能读取搜索词”的承诺。原始事件材料仅作本地备份，不随公开资料分发；原始 `trusted` 字段事实未被改写，新的合成展示图片也不能充当旧原生观察的证据。

隐私措辞应限定为：**扩展自身不主动向开发者或遥测服务器发送查询，用户执行搜索/导航时按正常浏览器机制访问目标方。**不要承诺整个浏览器环境或宿主站点都无法观察输入。原生快速输入仍有首字符缺失的已知问题，见 [README 中保留的已知输入限制](../README.md)。既有 40 项 Node 测试验证受控逻辑，不能替代原生 IME/快捷键稳定性验证。

## Chrome Web Store 数据类别填写建议

本地处理与“开发者服务器收集”是两个维度。官方 FAQ 明确要求披露仅在设备本地处理/存储的数据；Privacy practices 的数据类别应与实际使用相符，而不是因为没有服务器就全部留空。依据：[User Data FAQ，问题 2–3、14](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)、[Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)。

以下为本次代码审计对类别的**保守映射建议**，不是已在 Dashboard 保存的答案，也不是平台针对 TabRoam 作出的审核裁决。勾选数据种类不等于声明把相应数据上传服务器；隐私政策应在同一处说明本地处理和用户主动导航的区别。提交者需按实际 Dashboard 所展示的类别说明复核，不能把未见到的细分定义当成已核验事实。

| Dashboard 类别 | 当前建议 | 对照代码的实际内容 |
|---|---|---|
| Web history / 网络浏览记录 | **勾选** | 已打开页面、书签和历史的 URL/标题，以及访问时间元数据，是明确的浏览活动。`extension/background.mjs:56–105`。 |
| User activity / 用户活动 | **建议勾选并说明范围** | 本地记录标签激活/窗口聚焦对应的 tab ID 与时间戳；处理命令栏输入和选择以提供检索，不是全站点击/滚动统计或广告跟踪。`extension/background.mjs:269–291`；`extension/palette.js:160–184,203–255`。 |
| Website content / 网站内容 | **保守建议勾选并限定为元数据/查询** | 处理页面标题、书签名称、URL/链接及页面图标，并处理用户自行输入的查询文本。没有抓取网页正文、邮件、文档内容或 HTTP 响应正文的实现。若当前 Dashboard 将该类严格限定为正文抓取，应按其说明调整，而仍在政策中披露上述元数据。`extension/background.mjs:56–105,176–197`；`extension/palette.js:267–302`。 |
| Personally identifiable information / 身份识别信息 | 不因现有结构化字段单独勾选 | 没有账号注册、身份/联系人字段或持久用户标识。临时 tab ID 不等于个人账号 ID。任意标题、URL、查询仍可能附带个人文字，政策不得声称内容绝不会包含个人信息。 |
| Health information / 健康信息 | 当前没有专门字段/API | 不读取或提取健康记录；自由查询的语义不是一个单独的健康数据库处理功能。 |
| Financial and payment information / 财务和支付信息 | 当前没有专门字段/API | 没有支付、财务账户或交易数据接口。 |
| Authentication information / 身份验证信息 | 当前没有专门字段/API | 没有登录、密码字段、Cookie 或认证 API；非 tab 导航 URL 还拒绝 URL 用户名/密码。`extension/background.mjs:33–37,160–162`。不能保证任意 URL 查询参数永远不含 token。 |
| Personal communications / 个人通信 | 当前没有专门字段/API | 不读取邮件、消息或聊天正文；页面/书签标题按一般文本处理。 |
| Location / 位置 | 当前没有定位读取 | 没有定位 API，也不读取/计算用户 IP 位置。主动导航时目标站点正常接收 IP，与扩展读取定位是不同事实。 |

上述后六类的依据是对运行时文件完整读取及 API/字段检索，而不是对用户可能输入的所有文字作语义保证。不要把“未专门获取”改写成“绝不接触任何可能敏感的字符串”；也不要仅因为任意文本潜在包含各种内容而机械勾选全部敏感类别。

## 用途限制及认证草稿

仅在发布者确认公开政策与最终包一致后，以下事实可支持相应 Limited Use 认证；本审计没有代替发布者点击认证或提交：

| 认证含义 | 当前代码支持的事实与边界 |
|---|---|
| 不出售/不在允许用途之外转移用户数据 | 没有销售、广告、数据代理或开发者接收端；用户执行搜索或导航时交给目标方的数据必须明确披露为查找/导航所必需的行为，不能宣称“完全没有第三方接收”。`extension/background.mjs:3–7,152–210`。 |
| 不将数据用于与单一目的无关的用途 | 数据用于本地查找、排序、页面识别和导航；没有其他业务管道。`extension/background.mjs:108–173`；`extension/core.mjs:140–182`。 |
| 不将数据用于信用评估或放贷 | 没有此类模型、接口或用途。依据为运行时文件完整审计。 |

Limited Use 声明可表述为：

```text
TabRoam's use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only for the disclosed page-finding and navigation purpose. TabRoam does not sell this data or use it for advertising, unrelated profiling, creditworthiness, or lending.
```

这是结合当前实现拟定的产品声明；需要与可公开访问的隐私政策、商店说明及发布者身份信息一致。官方要求与允许用途见 [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)。

## Remote code 与可复核基线

Remote code 应选 **No**：代码随包提供；`background.mjs` 只导入包内 `core.mjs`，脚本注入使用包内文件，两个 `fetch` 都是扩展来源资源。访问搜索结果页不把其代码执行在扩展上下文内。依据：`extension/background.mjs:1,176–210,249–250`；`extension/manifest.json:8,19`；[官方 RHC 定义](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)。可粘贴理由见 [PERMISSIONS.md](PERMISSIONS.md)。

本轮读取的关键文件 SHA-256（便于后续包变更时确认审计范围）：

```text
extension/manifest.json  8a5c6b45fd3d72e18ac4bc455fadbc486adca1d9f4df9a1a4c50bfcf2edfb3e1
extension/background.mjs f25dcb5973d605bcdd6fcc28b9875c73521bbf682d56eb8c65f5f9978768f987
extension/core.mjs       4bbf4f1c1103e78d3937f2e661feb76d25acd00bdfc5c01e1668ebbf3a27ddec
extension/palette.js     4de9b0f4bce02002d3f4579b8e0e2643c263e1fadc510d7991be046fa38f2418
```

若最终包改动了上述数据读取、事件处理、网络或存储逻辑，应重新核对本文；文档本身不证明商店审核通过、政策页面已经发布或原生快速输入问题已经修复。
