# StructFlow

> A developer's side-panel for JSON and code - format, explore, snapshot, and keep notes, all offline in your browser.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/gnjabohddgleaghkhglofkepfmadclmj?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/structflow/gnjabohddgleaghkhglofkepfmadclmj)
[![Firefox Add-ons](https://img.shields.io/amo/v/structflow?label=Firefox%20Add-ons&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/structflow/)

StructFlow is a browser (Manifest V3) **side-panel/sidebar extension** that combines a
multi-language code formatter, an interactive JSON viewer (in the panel **and**
on raw JSON pages), a CodeSnap-style PNG exporter, and a searchable local library
of saved snippets. Because Markdown and Plain Text are first-class, it also works
as a lightweight in-browser **note-taker**.

Everything runs locally. No accounts, no servers, no network calls - all data is
stored in your browser via IndexedDB.

---

## Screenshots

| Editor | JSON tree | Library |
| --- | --- | --- |
| ![In-place code editor](store-assets/screenshot-05-editor.png) | ![JSON tree viewer](store-assets/screenshot-02-json-tree.png) | ![Snippet library](store-assets/screenshot-03-library.png) |

---

## Features

- **In-place code editor** - a single CodeMirror-based surface with live syntax
  highlighting and line numbers. "Format & Beautify" rewrites your text in place,
  and the same surface toggles between **Edit**, **Preview** (Markdown), **Tree**
  (JSON), and **Diff** (exactly what formatting would change) - no separate
  input/output panels.
- **20+ languages** - beautify (format) for Markdown, JSON, JavaScript,
  TypeScript, HTML, CSS, SQL, and YAML; highlight-and-keep for Python, Go, Rust,
  Java, C/C++, C#, PHP, Ruby, Shell, TOML, Dockerfile, Kotlin, and Swift. VS
  Code-style format options for tab width, quotes, semicolons, print width,
  wrapping, and alphabetical key sorting.
- **Auto-detect on paste** - paste into an empty editor and JSON or Markdown is set
  automatically (the two high-confidence formats, which unlock the tree and preview),
  with a one-click **Undo**. A searchable language picker with Recent items, icons,
  and keyboard navigation covers everything else.
- **Note-taking** - Plain Text is a pure pass-through (never reformatted) and
  Markdown ships with a rendered preview that toggles against the source.
- **JSON viewer** - collapsible tree with key/value search, copy-path, copy-value,
  and type color-coding, plus a highlighted text view with line numbers.
- **In-page JSON viewer** - a content script takes over raw `.json` pages and JSON
  responses, rendering a Formatted (default) / Tree / Raw view with its own
  Editor & JSON theme picker and search. Turn it off anytime from the panel's
  **Settings** (gear) menu.
- **Syntax themes** - the author's **Aura Noir** family (7 dark + 2 light) plus
  VS Code, GitHub, Monokai, Dracula, Nord, and Solarized, applied independently of
  the app's light/dark chrome. A fresh install starts on a light or dark theme that
  matches your browser.
- **Code snapshot** - export the formatted output as a polished PNG: windowed card
  with traffic lights and filename, backdrop choices, padding, line numbers, and
  Copy PNG / Download PNG.
- **Library** - save output to IndexedDB and organize it into nested folders.
  Each folder has an options menu to rename, add a new item, create a nested
  folder, recolor (swatch
  palette), or delete, plus full-text search and re-open / copy / export / delete
  per entry. "Add new item" opens the editor pre-targeted to that folder.
- **Bulk export** - export all or selected folders as a single `.zip`: entries are
  written as real files organized into folders, alongside a `manifest.json` that
  captures the full structured data for backup/restore.
- **Pinned, tagged, and recent entries** - star important snippets, tag saved
  items, filter recent opens, duplicate entries, and edit saved entry details.
- **Side-panel shortcut** - open StructFlow with `Alt+Shift+S`, or
  `Command+Shift+S` on macOS by default.
- **Light & dark themes** - persisted and applied across the panel and viewers.

---

## Install

| Browser | Status | Link |
| --- | --- | --- |
| **Chrome** | ✅ Available | [Chrome Web Store](https://chromewebstore.google.com/detail/structflow/gnjabohddgleaghkhglofkepfmadclmj) |
| **Firefox** | ✅ Available | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/structflow/) |
| **Edge** | 🔜 Planned | _coming soon_ |

> Works in any Chromium browser (Edge, Brave, Arc) via the Chrome Web Store link
> above, or from source below.

---

## Install (from source)

```bash
pnpm install
pnpm build
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the generated `dist/` folder.
4. Click the StructFlow toolbar icon to open the side panel.

> Other Chromium browsers (Edge, Brave, Arc) use the same "Load unpacked" flow.

---

## Development

```bash
pnpm dev      # Vite dev server - previews the panel UI as a normal web app
pnpm build    # Production build to dist/ (panel + content script + assets)
pnpm preview  # Preview the production build
pnpm assets:store  # Capture real Chrome Web Store screenshots + promo tile
pnpm assets:store:annotated  # Build text-enhanced screenshots from the real captures
pnpm package:chrome   # Build releases/structflow-chrome-vX.Y.Z.zip
pnpm package:edge     # Build releases/structflow-edge-vX.Y.Z.zip
pnpm package:firefox  # Build releases/structflow-firefox-vX.Y.Z.zip
pnpm package:extension  # Alias for package:chrome
```

The same code runs both as the unpacked extension and in the browser preview;
IndexedDB works in both contexts, so you can iterate quickly without reloading
the extension for most UI work.

### Regenerating brand assets

The header logo, favicon, and the 16/32/48/128 extension icons are generated
from a single source image:

```bash
# 1. Drop new art at src/assets/logo-source.png
# 2. Regenerate everything (trims transparent padding via sharp)
node scripts/gen-icons.cjs
```

---

## Tech stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (design tokens in `src/index.css`)
- **Prettier (standalone)** + **sql-formatter** - formatting engine
- **CodeMirror 6** - the in-place editor (per-language grammars are lazy-loaded)
- **lowlight / highlight.js** - syntax highlighting for read-only views
- **marked** + **DOMPurify** - Markdown preview
- **html-to-image** - DOM → PNG snapshots
- **fflate** - client-side `.zip` for bulk library export
- **idb** - IndexedDB wrapper
- **chrome.sidePanel** / Firefox `sidebar_action` + service worker + content script

See [`context/architecture-context.md`](context/architecture-context.md)
for a full file map and subsystem notes.

---

## Project docs

- [`context/.project-context.md`](context/.project-context.md) - what it is, features, conventions, non-goals.
- [`context/architecture-context.md`](context/architecture-context.md) - stack, file map, data flow, subsystems.
- [`context/progress-tracker.md`](context/progress-tracker.md) - what's shipped, per phase.
- [`context/future-features.md`](context/future-features.md) - ideas backlog.
- [`STORE_LISTING.md`](STORE_LISTING.md) - copy for the Chrome Web Store listing.
- [`BROWSER_PUBLISHING.md`](BROWSER_PUBLISHING.md) - Edge and Firefox packaging/submission steps.
- [`store-assets/`](store-assets/) - generated screenshots and promo tile for the store.
- [`PRIVACY.md`](PRIVACY.md) - local-first privacy policy.
- [`SUPPORT.md`](SUPPORT.md) - support page source.
- [`CHANGELOG.md`](CHANGELOG.md) - release history.

---

## Support the project

StructFlow is built to be open-sourced. If it saves you time, you can support
development via the links in the in-app **Support** popover - configure them in
[`src/lib/support-links.ts`](src/lib/support-links.ts) (GitHub, Buy Me a Coffee,
Sponsor/Donate).

---

## License

Apache-2.0. Reuse is allowed, but redistributed copies and derivative works
must preserve the license and attribution notices in [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE).
