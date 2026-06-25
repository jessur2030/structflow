# StructFlow — Build Plan

> The plan used to build the current codebase. StructFlow is a Chrome MV3 side-panel
> extension that is a JSON viewer + multi-language code formatter with an
> IndexedDB-backed saved-entries library.

## Goals

1. A **JSON viewer** that can parse, format, and pretty-print JSON, with both an
   interactive collapsible tree and a syntax-highlighted text view.
2. A **multi-language formatter** in the Chrome side panel supporting JSON,
   JavaScript, TypeScript, HTML, CSS, Markdown, and SQL.
3. A **saved-entries library** with folders, search, and
   copy / save / export / re-open actions.
4. **Dark + light mode** for both the viewer and the side panel.

## Decisions (confirmed with user)

| Question        | Decision                                                            |
| --------------- | ------------------------------------------------------------------- |
| Build target    | Both — previewable web app now, real MV3 extension wiring (Vite)    |
| Storage         | **IndexedDB** (via `idb`)                                           |
| JSON viewer     | Both interactive tree + pretty-printed text                         |
| Languages       | All: JSON, JS, TS, HTML, CSS, Markdown, SQL                         |
| Formatter defaults | VS Code-like defaults, with extra options exposed                |

## Tech Stack

- **Vite + React + TypeScript** — builds to a static bundle that loads as an
  unpacked MV3 extension and also runs in a normal browser preview.
- **Prettier (standalone + plugins)** — JS/TS/HTML/CSS/Markdown/JSON formatting.
- **sql-formatter** — SQL indentation/spacing cleanup only.
- **highlight.js** — read-only syntax highlighting in the text/code view.
- **idb** — thin IndexedDB wrapper for the library (entries + projects).
- **chrome.sidePanel + service worker** — opens StructFlow in the side panel.

## Build Phases

1. **Scaffold** — convert from Next.js to Vite MV3: `manifest.json`, side-panel
   HTML entry, `background.ts` service worker, theme CSS, icons.
2. **Core libs** — `types.ts`, `formatter.ts` (engine), `storage.ts` (IndexedDB),
   `use-theme.ts`, `io.ts` (clipboard/download).
3. **Viewer + formatter UI** — `code-view`, `json-tree`, `options-panel`,
   `language-select`, `formatter` (the main editor view).
4. **Library** — `library` view with folders, search, per-entry actions,
   and the App shell tying tabs + theme + save modal together.

## Verification

- Dev server runs clean on Vite.
- Verified in-browser at side-panel width (≈400px): format JSON → valid badge +
  highlighting, tree view + search, dark mode, save to library → IndexedDB
  persistence → Library tab shows the saved entry.

## How to load in Chrome

`pnpm build` → `chrome://extensions` → enable Developer mode →
"Load unpacked" → select `dist/`. Click the toolbar icon to open the side panel.
