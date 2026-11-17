# TabRoam: English store listing

Target version: 1.0.5. Prepared: 2026-11-17. These are store-listing handoff materials. The privacy policy is public; the extension has not been uploaded to the Chrome Web Store, submitted for review, or released there.

## Title

TabRoam

## Short description

Search tabs, bookmarks and history in one command bar. Switch windows, open URLs, or search the web with your chosen engine.

Character count: 124, including spaces and punctuation; within the 132-character limit. This is proposed copy, not a declaration that locale-specific manifest metadata is already configured. See the [official description-field documentation](https://developer.chrome.com/docs/extensions/reference/manifest/description).

## Detailed description

Copy the following text into the English detailed-description field:

```text
TabRoam brings tabs, bookmarks, browsing history, URL navigation and web search into one command bar. Enter a title, address or keyword, then switch to an existing page or open your next destination.

Find pages across your browser
• Search open tabs across normal windows in your current Chrome profile, including pinned tabs.
• Find local bookmarks and browsing history by title and URL.
• See recently used tabs when the input is empty.
• Search Chinese or English text with case-insensitive, multiword matching and light English typo tolerance.
• When a URL appears in several sources, prefer switching to an existing tab. Separate open tabs remain individually selectable.

Switch tabs or open an address
• Selecting an open tab activates it and focuses its window.
• Bookmarks, history entries, addresses and web searches open in a new tab by default.
• Use Cmd+Enter on macOS or Ctrl+Enter on Windows to open in the original tab.
• Enter HTTP/HTTPS URLs, domains, IP addresses with ports, or localhost addresses.

Choose your search settings
• Choose Google, Bing, DuckDuckGo or Baidu. Google is the default.
• Run a search action to open the selected engine's results page.
• Search history from the last 30, 90, 180 or 365 days, or all time. The default is 180 days.
• History lookup reads at most the newest 20,000 entries in the selected range and shows a notice when the limit is reached. The candidate list returns up to 40 items.

Use the keyboard
• Open the command bar with Cmd+Shift+Space on macOS or Ctrl+Shift+Space on Windows, or click the toolbar icon.
• Use Up/Down to select, Enter to open, and Esc to close and return focus to the original page.
• Shortcuts may conflict with the operating system or other extensions. Change the assignment at chrome://extensions/shortcuts.

Local processing, explicit network actions
Tab, bookmark and history matching takes place locally in your browser. TabRoam does not read webpage body content, upload local candidates, request online suggestions, use telemetry, or connect to a developer-operated server. When you execute a web search, the selected search engine receives your query. When you visit a destination, that site receives the normal browsing request. Your search-engine and history-range settings are stored locally.

Availability and known limitations
Chrome 121 or later is required. Normal webpages use a centered overlay. Chrome internal pages, the Chrome Web Store and other pages that block injection use a separate extension page. Incognito windows are not enabled.

A known issue remains: starting Chinese IME typing immediately after shortcut activation can drop initial characters. Confirm that the command-bar input is visible and focused before typing. This issue is not fully resolved. Pinyin and pinyin-initial matching are not included.

TabRoam is an independent extension and is not affiliated with Arc or The Browser Company.
```

## Screenshot order and captions

These captions support asset handoff and accessible descriptions; they do not assume that the Dashboard provides a separate caption field. Match each caption to the final screenshot.

| Order | File | English caption |
| --- | --- | --- |
| 1 | [01-command-bar.png](screenshots/01-command-bar.png) | View recently used tabs in a centered command bar and select a page to switch to. |
| 2 | [02-unified-search.png](screenshots/02-unified-search.png) | Find tabs, bookmarks and history by title or URL, with the available action shown for each result. |
| 3 | [03-settings.png](screenshots/03-settings.png) | Choose a default search engine and history range, and find keyboard controls and shortcut settings. |

The target image size is 1280×800. Assets use the real extension UI and demonstration data in a separate browser profile, rather than the user's daily browsing data. Confirm the actual generated files before upload.

## Store-field handoff

- Suggested category: **Functionality & UI**. The official category description includes tab managers, shortcut managers and app launchers. See the [category guidance](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well).
- Refer to [PERMISSIONS.md](PERMISSIONS.md) and [DATA-PRACTICES.md](DATA-PRACTICES.md) for the single purpose, permission justifications and data disclosures.
- Publisher: **LaneXia**. Public support and privacy contact: **xialei0792@gmail.com**. Both were confirmed by the user and recorded in the local materials. Source code and the policy share the [Lane-Xia/tabroam repository](https://github.com/Lane-Xia/tabroam); GitHub Pages publishes `docs/index.html` from the `main` branch’s `/docs` folder. The privacy policy is published on GitHub Pages at [https://lane-xia.github.io/tabroam/](https://lane-xia.github.io/tabroam/), with hosting IP-address logging disclosed. The [local policy text](PRIVACY-POLICY.md) and [HTML source](privacy/index.html) are retained. The extension has not been uploaded, submitted for review, or listed in the Chrome Web Store. See [SUBMISSION-GUIDE.md](../README.md).
- This copy does not claim AI, webpage-body search, full-text indexing, pinyin matching, a fixed response time, or complete native IME validation.
