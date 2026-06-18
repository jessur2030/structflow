# Progress Tracker — StructFlow

Legend: [x] done · [~] partial · [ ] not started

## Phase 1 — Scaffold (MV3 + Vite)
- [x] Convert project from Next.js to Vite + React + TS
- [x] `manifest.json` (side_panel, background, permissions)
- [x] Side-panel HTML entry + `main.tsx` React root
- [x] `background.ts` service worker (open side panel on icon click)
- [x] Theme CSS + design tokens (`index.css`)
- [x] Extension icons (16/32/48/128)

## Phase 2 — Core libraries
- [x] `types.ts` — Language, FormatOptions, Entry, Project
- [x] `formatter.ts` — Prettier + sql-formatter engine
- [x] `storage.ts` — IndexedDB CRUD (entries + projects)
- [x] `use-theme.ts` — dark/light theme hook (persisted)
- [x] `io.ts` — clipboard copy + file export/download

## Phase 3 — Viewer + formatter UI
- [x] `code-view.tsx` — highlighted text + line numbers + wrap
- [x] `json-tree.tsx` — collapsible tree, search, copy path/value
- [x] `options-panel.tsx` — formatter options (VS Code-style defaults)
- [x] `language-select.tsx` — language picker
- [x] `formatter.tsx` — main editor view + Valid/Invalid badge + view toggle

## Phase 4 — Library
- [x] `library.tsx` — entries grouped by project/folder
- [x] Search across title + content
- [x] Per-entry actions: copy / export / re-open / delete
- [x] Projects/folders create + assign
- [x] `App.tsx` shell — tabs, theme toggle, save modal, count badge

## Verification
- [x] Dev server runs clean (Vite)
- [x] Format JSON → valid badge + syntax highlighting
- [x] Tree view + search at side-panel width
- [x] Dark mode across viewer + panel
- [x] Save → IndexedDB persistence → Library shows entry

## Languages supported
- [x] JSON  [x] JavaScript  [x] TypeScript  [x] HTML
- [x] CSS   [x] Markdown    [x] SQL (spacing/indent only)

## Phase 5 — v2 enhancements
- [x] `syntax-themes.ts` — 8-theme registry (VS Code Dark+/Light+, GitHub Dark/Light, Monokai, Dracula, Nord, Solarized Light)
- [x] `use-syntax-theme.ts` + `syntax-theme-select.tsx` — editor/JSON theme picker (persisted)
- [x] CSS `.syntax-surface` drives code view + JSON tree via `--syn-*` vars
- [x] App theme upgraded to light / dark / **system** (`theme-mode-toggle.tsx`)
- [x] `markdown-preview.tsx` — rendered Markdown preview toggle (marked + DOMPurify)
- [x] Save flow: `projectId: null` hidden bucket labeled "No project" (not "Unfiled")
- [x] Project rename (inline) + delete in Library
- [x] `content.ts` — in-page auto JSON viewer (self-contained classic script)
  - detect via `document.contentType` (application/json) + first `<pre>`
  - pretty collapsible tree, search highlight, Tree/Raw toggle, Expand all, Copy
  - registered in manifest (`content_scripts`, `<all_urls>`) + Vite build entry

## Verification (v2)
- [x] Markdown rendered preview (headings, lists, tables) toggles vs source
- [x] Syntax theme switch (Dracula) recolors output independent of app chrome
- [x] App dark mode toggles full panel chrome
- [x] In-page viewer takes over raw JSON page; expand + search (100 matches) work
- [x] Production build emits classic `content.js` (no ESM import)

## Phase 6 — v3 enhancements
- [x] Brand logo: saved `src/assets/logo-source.png`, `scripts/gen-icons.cjs` (sharp) auto-trims + emits icons 16/32/48/128 + header `logo.png` + favicon
- [x] Options `Toggle` bug fix: was a button-in-a-label (double-fire canceled toggle); now a single `role="switch"` button
- [x] In-page viewer: added Editor/JSON theme picker (live, persisted via `chrome.storage`)
  - default view is now **Formatted** (syntax-highlighted pretty JSON), Tree/Raw are opt-in
  - Tree expands 2 levels by default (was fully collapsed)
  - theme switch updates existing `<style>` node text (avoids minified-eval `el()` collision)
- [x] `snapshot-modal.tsx` — CodeSnap-style PNG export (side panel only)
  - windowed card (traffic lights + filename), 5 solid backdrops (navy/blue/cyan/slate/none)
  - padding slider, title-bar + line-number toggles, Copy PNG + Download PNG
  - uses `html-to-image` (toPng/toBlob); copy falls back to download on clipboard failure
  - `--snap-checker` CSS var added for transparent-backdrop indicator

## Verification (v3)
- [x] Header renders real trimmed logo (24x24)
- [x] Options toggle flips cleanly each click (true→false→true), no double-fire
- [x] In-page viewer defaults to Formatted; theme picker (Dracula) recolors bg + tokens live
- [x] In-page Tree opens 2 levels expanded
- [x] Snapshot modal: highlighted card, backdrop swatch change live, `toBlob` yields 48KB PNG
- [x] Clean production build with all entries

## Phase 7 — v4 enhancements (note-taking + monetization)
- [x] Formatter language list reordered for note-first use: **Markdown (default)** → Plain Text → TypeScript → JavaScript → JSON → HTML → CSS → SQL
- [x] App default language changed `json` → `markdown` (`App.tsx`)
- [x] New **Plain Text** (`text`, `.txt`) language — pass-through, never reformats (note-taking surface)
  - `formatter.ts` returns input unchanged for `text`
  - registered `plaintext` in `code-view.tsx` + `snapshot-modal.tsx` (hljs)
  - added `text` → `text/plain` to `io.ts` MIME map
- [x] `support-button.tsx` + `support-links.ts` — header Support popover (GitHub, Buy Me a Coffee, Sponsor/Donate)
  - inline GitHub SVG (lucide dropped the brand icon in this version)
  - links read from editable config; empty-URL links hidden; whole button hides if all empty
  - **ACTION REQUIRED before ship**: replace `your-handle` placeholders in `src/lib/support-links.ts`

## Verification (v4)
- [x] App boots with Markdown selected by default
- [x] Language dropdown order: Markdown → Plain Text → TS → JS → JSON → HTML → CSS → SQL
- [x] Plain Text selects cleanly, no reformatting, no errors
- [x] Support popover opens with GitHub / Buy Me a Coffee / Sponsor links + descriptions
- [x] Clean production build

## Phase 9 — library UI fixes + folder enhancements
- [x] Bug: row "More" menu clipped off-screen for bottom rows — now measures space and flips above the trigger (`bottom-full`) when needed (`useLayoutEffect`)
- [x] Bug: menus stayed stuck open — added `pointerdown`/`Escape` outside-close handlers (entry rows + project groups)
- [x] Bug: long project names in "Move to" wrapped to 3 lines — now `min-w-0 truncate` single line
- [x] Project folders: inline rename/delete buttons replaced with a ⋯ options dropdown (Rename / Add new item / Color swatches / Delete folder)
- [x] Quick `+` (Add new item) button on each folder row + "No project" group
- [x] "Add new item" opens Formatter with empty editor, pre-targets that project so next Save lands in the folder (`pendingProjectId` in `App.tsx`)
- [x] Folder colors: shared `PROJECT_COLORS` palette (8 colors) moved to `types.ts`; random on create, editable via swatch palette in folder menu (`onRecolorProject`)

## Phase 10 — bulk data export
- [x] `fflate` dependency added for client-side zip
- [x] `io.ts` `exportEntriesAsZip(entries, projects)` — foldered by project (`Project/<slug>.<ext>`, ungrouped → `No project/`), de-dupes filename collisions, includes `manifest.json` (full structured export)
- [x] Library header **Archive** button opens export modal (disabled when no entries)
- [x] Export modal: Select all + per-folder checkboxes w/ live entry counts; button reads "Export N entries"; counts computed from full set (search-independent)

## Verification (v9–v10)
- [x] Bottom-row "More" menu flips up, Delete fully visible; outside click + Escape close menus
- [x] Folder ⋯ menu: rename, add item, recolor (persists to IndexedDB), delete
- [x] "Add new item" → empty Formatter → Save dialog pre-set to that project
- [x] Export modal lists folders + counts; partial selection updates button count
- [x] Generated .zip is valid: `API Responses/user-schema.json`, `Notes/sprint-plan.md`, `No project/scratch.txt`, `manifest.json`
- [x] Clean production build

## Backlog / follow-ups (not started)
See `ai-context/future-features.md` for the full ideas backlog.

## Phase 11 — production readiness Phase 4/5
- [x] Entry v3 library metadata: `pinned`, `tags`, `lastOpenedAt`
- [x] Library filters: All / Pinned / Recent
- [x] Entry detail modal: edit title, language, project, tags, raw input, formatted output, pinned state
- [x] Saved-entry reformat action using the stored formatter options
- [x] Duplicate handling: same-folder save titles are uniqued; saved entries can be duplicated as copies
- [x] Import/export manifest validation includes v3 metadata
- [x] Side-panel command added: `Ctrl+Shift+S` default, `MacCtrl+Shift+S` on macOS
- [x] Manifest permission audit: removed separate `host_permissions`; retained `sidePanel`, `storage`, `contextMenus`, and content-script matches
- [x] Added `PRIVACY.md`
- [x] Added `CHANGELOG.md`
- [x] Added `pnpm package:extension` release ZIP script
- [ ] Capture Chrome Web Store screenshots and optional promo image
- [ ] Replace placeholder support/public URLs before launch

## Phase 8 — docs & launch prep
- [x] Refreshed `.project-context.md` (note-taking + monetization angle, full feature list, non-goals)
- [x] Rewrote `architecture-context.md` file map + added subsystem notes (content script, syntax themes, snapshot, support, extension wiring)
- [x] Created `future-features.md` ideas backlog (capture, languages, notes, viewer, snapshot, library, UX, monetization, tech debt)
- [x] Created root `README.md` (install-from-source, dev, asset regen, stack, docs index, support)
- [x] Created `STORE_LISTING.md` (Chrome Web Store name/summary/description/release notes/permissions/assets checklist)
  - permissions justification matched to actual manifest (`sidePanel`, `storage`, `contextMenus`, `<all_urls>` + content script)
