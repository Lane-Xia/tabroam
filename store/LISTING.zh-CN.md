# TabRoam：简体中文商店文案

目标版本：1.0.5。准备日期：2026-11-17。此文件为商店文案交接材料；隐私政策已公开，扩展尚未上传 Chrome Web Store、未提交审核、未上架。

## 标题

TabRoam

## 短描述

在一个命令栏中搜索标签页、书签和历史记录，切换窗口、打开网址，或使用你选择的搜索引擎。

字符数：43，含标点；不超过 132 字符。此段为短描述候选，不代表当前包已配置简体中文清单元数据。清单字段的长度限制见 [Chrome 官方说明](https://developer.chrome.com/docs/extensions/reference/manifest/description)。

## 详细描述

以下正文可复制到简体中文详细描述字段：

```text
TabRoam 将标签页、书签、历史记录、网址访问和网络搜索放进同一个命令栏。输入标题、网址或关键词，选择结果后切换到已有页面，或打开新的目标。

一个入口，查找浏览器里的页面
• 搜索当前 Chrome 用户配置下各普通窗口的标签页，包括固定标签页。
• 同时按标题和 URL 查找本地书签与浏览历史。
• 空输入时展示最近使用的标签页。
• 支持中英文、大小写不敏感、多关键词，以及轻度英文拼写容错。
• 同一 URL 来自多个来源时优先提供切换已有标签页的入口；实际打开的多个标签页仍分别保留。

切换页面，或直接访问网址
• 选择已有标签页时，切换标签页并聚焦它所在的窗口。
• 书签、历史、网址和网络搜索默认在新标签页打开。
• 使用 ⌘ Enter（macOS）或 Ctrl Enter（Windows），在原标签页打开。
• 支持 HTTP/HTTPS 网址、域名、IP 与端口、localhost 等地址。

选择你的搜索方式
• 可选择 Google、Bing、DuckDuckGo 或百度，默认使用 Google。
• 执行搜索动作后跳转到对应搜索引擎的结果页。
• 历史范围可选最近 30、90、180、365 天或全部时间，默认 180 天。
• 历史检索最多读取所选范围内最近 20,000 条记录，达到上限时显示提示。候选列表最多返回 40 项。

键盘操作
• 唤起命令栏：macOS 为 ⌘ Shift Space；Windows 为 Ctrl Shift Space，也可以点击工具栏图标。
• ↑ / ↓ 选择结果，Enter 打开，Esc 关闭并恢复原页面焦点。
• 快捷键可能与系统或其他扩展冲突，可在 chrome://extensions/shortcuts 修改。

本地处理，明确的网络行为
标签页、书签和历史记录在浏览器本地匹配；TabRoam 不读取网页正文，不上传本地候选，不提供联网搜索建议，也没有遥测或开发者服务器。执行网络搜索时，你选择的搜索引擎会接收查询关键词；访问目标网页时，该站点会正常接收浏览请求。搜索引擎与历史范围保存在本地。

使用范围与已知限制
需要 Chrome 121 或更高版本。普通网页使用居中浮层；Chrome 内部页面、Chrome 应用商店等不允许注入的位置使用备用扩展页。无痕窗口不启用。

当前仍存在快捷键唤起后立即开始中文拼音输入可能缺失开头字符的问题。请确认命令栏输入框已出现并获得焦点后再输入；该问题尚未完全解决。当前版本不提供拼音或拼音首字母匹配。

TabRoam 是独立扩展，与 Arc 或 The Browser Company 无隶属关系。
```

## 截图顺序与配套说明

这些说明用于素材交接与无障碍描述，不假定 Dashboard 一定有独立的截图说明字段。正式上传时保持截图与文字对应。

| 顺序 | 文件 | 简体中文说明 |
| --- | --- | --- |
| 1 | [01-command-bar.png](screenshots/01-command-bar.png) | 在居中命令栏查看最近使用的标签页，并选择要切换的页面。 |
| 2 | [02-unified-search.png](screenshots/02-unified-search.png) | 按标题或 URL 统一查找标签页、书签与历史记录，查看对应的打开动作。 |
| 3 | [03-settings.png](screenshots/03-settings.png) | 设置默认搜索引擎和历史记录范围，并查看键盘操作及快捷键设置入口。 |

截图目标规格为 1280×800；使用真实扩展界面和独立测试配置中的演示数据，不以日常浏览数据作为商店素材。尺寸和画面以本轮实际生成的文件为准。

## 商店字段交接

- 分类建议：**Functionality & UI**。官方将标签管理器、快捷键管理器和启动器归入此类，见 [分类说明](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well)。
- 单一用途、权限理由及数据披露分别见 [权限说明](PERMISSIONS.md)、[数据实践](DATA-PRACTICES.md)。
- 发布者 **LaneXia**，公开支持及隐私联系邮箱 **xialei0792@gmail.com**，均已由用户确认并填入本地材料。政策与源码统一维护于 [Lane-Xia/tabroam](https://github.com/Lane-Xia/tabroam)，从 `main` 分支的 `docs/` 目录发布 `docs/index.html`。隐私政策已通过 GitHub Pages 公开，正式 URL 为 [https://lane-xia.github.io/tabroam/](https://lane-xia.github.io/tabroam/)，并已披露托管访问 IP 日志处理；本地[政策正文](PRIVACY-POLICY.md)与[HTML 源文件](privacy/index.html)同步保留。扩展尚未上传、送审或上架，见 [提交指南](../README.md)。
- 本文只描述现有功能，不声明 AI、网页正文检索、全文索引、拼音匹配、固定响应速度或全部原生输入法流程通过。
