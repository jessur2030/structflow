# Progress Tracker — StructFlow

Legend: [x] done · [~] partial · [ ] not started

## Phase 18 — shadcn/Radix UI migration + header cleanup (post-1.4.1)
- [x] `shadcn init` (new-york; oklch token theme in `index.css`). Primitives in
  `src/components/ui/`: button, dialog, dropdown-menu, popover, tooltip, command (cmdk),
  input, textarea, select, label, badge.
- [x] **Tooltips:** all `FloatingTooltip` usages (icon-button, editor-surface, json-tree,
  library ×5) → shadcn `Tooltip`; custom `tooltip.tsx` deleted.
- [x] **Menus/popovers:** Modal→Dialog + library menus→DropdownMenu (earlier); this pass:
  support-button → Popover, syntax-theme-select + formatter "More actions" → DropdownMenu.
- [x] **Language picker → cmdk Combobox** (Popover + Command): search, Recent, icons, "formats" badge.
- [x] **Forms standardized** on `Input`/`Textarea`/`Select` (library Entry dialog, App Save
  dialog, settings) — fixes inconsistent input spacing. Radix Select uses `"__none__"` sentinel
  for "No folder" (no empty-string values).
- [x] **Removed the app light/dark toggle from the header** (deleted `theme-mode-toggle.tsx`);
  appearance lives only in Settings.
- [x] tsc + build clean; ~69 tests pass; verified in real Chrome (combobox, menus, popover,
  save-dialog form), no console errors. NOTE: not yet reflected in CHANGELOG/version bump.

## Phase 17 — detect scope + markdown preview fixes (v1.4.1)
- [x] Scoped auto-detect to JSON + Markdown only (`detect.ts`). Removed the fuzzy
  code heuristics (HTML/CSS/SQL/TS/JS/Python/Shell) that mis-detected prose as
  TypeScript. Everything except JSON/Markdown returns null and keeps the current
  language. Linear-time bold-span regex (fixes ReDoS on a large unterminated `**`).
- [x] Markdown preview: bullet/numbered list markers restored (`index.css`; Tailwind
  preflight had reset `list-style`); GFM task lists render real checkboxes
  (`markdown-preview.tsx`, checkbox + label inline).
- [x] Detect test suite rewritten for the new scope (JSON + Markdown only, code -> null,
  ReDoS guard). Verified in real Chrome with actual paste events.
- [x] Version bumped to 1.4.1 (3 spots).

## Phase 16 — two-tier languages, auto-detect, picker, themes, settings (v1.4.0)

### Two-tier language model
- [x] `LANGUAGES` (`types.ts`) is the single source of truth, with `formattable` +
  `mime` fields. **Tier 1 (format + highlight)** added **YAML** (Prettier). **Tier 2
  (highlight + store only, ~13)**: Python, Go, Rust, Java, C/C++, C#, PHP, Ruby,
  Shell, TOML, Dockerfile, Kotlin, Swift. The "Format & Beautify" button now hides
  whenever `!getLanguage(lang).formattable` (generalizes the old Plain Text case).
- [x] Editor grammars lazy-load per language (`cm-languages.ts`: official
  `@codemirror/lang-*` where available, else `@codemirror/legacy-modes`). Read-only
  views register the matching highlight.js grammars (`highlight.ts`). `io.ts`
  `mimeFor` derives from meta; `EXT_TO_LANGUAGE` extended for smart import.

### Auto-detect on paste
- [x] `detect.ts` `detectLanguage` (scoped to JSON + Markdown in v1.4.1). Returns
  null unless confident; detects only JSON (reuses `validate("json")`) and Markdown
  (structural markers). Everything else returns null and keeps the current language.
  Fires from the CodeMirror paste handler only when the paste starts a fresh buffer
  (empty OR a full-selection replace). `formatter.tsx` shows a self-dismissing
  "Detected X · Undo" chip; never switches if unchanged.

### Searchable language picker
- [x] `language-select.tsx` rebuilt as a searchable combobox: search box, **Recent**
  section (persisted), per-language icons, keyboard nav (↑↓/Enter/Esc/Home/End),
  listbox/option a11y roles, and a "formats" badge on Tier 1.

### Syntax themes
- [x] Added the author's **Aura Noir family** (9: 7 dark + 2 light) to
  `syntax-themes.ts` AND the in-page viewer's inlined list in `content.ts`
  (additive — existing 8 kept). Added a dedicated **`type` slot** (`--syn-type`,
  falls back to `func`) wired in `cm-theme.ts` + `index.css` for accurate type/class
  coloring. **First-run default is mode-aware**: `aura-day` (light) / `aura-noir-modern`
  (dark), persisted once; user choice wins thereafter.

### Settings screen
- [x] In-panel **Settings view** (`settings-view.tsx`) opened from the header gear
  (`settings-button.tsx` is now just a gear `IconButton`). Single grouped column —
  **General** (Appearance, Syntax theme, **Default language** for new notes →
  `structflow_default_language`), **In-page JSON viewer** (the Auto-format toggle moved
  here; same `chrome.storage.local["structflow_inpage_enabled"]` key), **Data**
  (Export/Import reuse `io.ts`; **Clear all** via new `storage.ts` `clearAll()` behind a
  Modal confirm — clears records only, never drops stores), **About** (version, shortcut
  link to `chrome://extensions/shortcuts`, support links). Theme + syntax-theme stay in
  the header too and auto-sync (shared App state). Aura themes also in the in-page viewer.

### UX fixes
- [x] Empty buffer now opens in **Edit** (was Preview for Markdown → "Nothing to
  preview yet"). Editor placeholder simplified.

### Verification (Phase 16)
- [x] 70 Vitest tests (added `detect` + `language-metadata` integrity). Typecheck +
  build + `package:chrome` clean. Driven in real Chrome: auto-detect across
  languages + Undo, searchable picker + recents, Tier 2 (Python) highlight with
  Format hidden, YAML formatting, theme switching, first-run light/dark defaults,
  settings toggle. Version bumped to 1.4.0 (3 spots).

## Phase 15 — unified in-place editor (v1.3.0, uncommitted)

- [x] Replaced the split INPUT(plain textarea)/OUTPUT(read-only) model with ONE
  in-place **CodeMirror 6** editor (`code-editor.tsx`): live syntax highlighting,
  line numbers, bracket matching, undo history; themed entirely through the existing
  `--syn-*` vars (`cm-theme.ts` — `synHighlightStyle` maps Lezer tags → vars,
  `synEditorTheme` for chrome). Controlled value-sync guard (`value !== doc`) avoids
  cursor jump. CSP-safe, no `innerHTML`.
- [x] Shared **`EditorSurface`** (`editor-surface.tsx`): one surface, four modes —
  **Edit / Preview (Markdown) / Tree (JSON) / Diff** — consumed by both
  `formatter.tsx` and `focus-view.tsx` (Full view now uses the same editor).
- [x] **Diff mode** (`diff-view.tsx`, renamed from compare-view): current buffer vs
  `formatCode(buffer)` computed on demand. Format-in-place via `handleFormatNow`
  (`setInput(res.output)`); removed the separate `output` string + 180ms debounce.
- [x] Deleted dead `code-view.tsx` + `compare-view.tsx`. Verified in real Chrome;
  typecheck + tests + build clean. Version 1.3.0.

## Phase 14 — terminology, Full view, formatter UX polish (v1.2.0, uncommitted)

### Terminology: "folder" everywhere (Obsidian-style)
- [x] Unified UI wording: dropped the "project" / "subfolder" mix. UI now says
  **folder** at every level (`New folder`, `Folder options`, `No folder`, `Folders`,
  "create folders inside folders"). The `Project` TYPE name is kept internally
  (no code churn). Nesting is implied by where you create the folder.
- [x] Updated user-facing docs (README, STORE_LISTING) + internal context docs.

### Full view (focus mode) — `src/components/focus-view.tsx` (new)
- [x] Fullscreen overlay (reuses the snapshot-modal pattern, Escape to close) with
  an Obsidian-style **book/pen toggle**: pen = full-height editable source,
  book = live rendered preview. Markdown renders live (`MarkdownPreview source={input}`);
  other languages show a highlighted read-only `CodeView`. Centered readable width
  for presenting. Defaults to preview for Markdown.
- [x] Wired into `formatter.tsx`: `Maximize2` "Full view" toolbar button + `showFocus`
  state + `Cmd/Ctrl+Shift+F` shortcut. Edits sync back to the formatter input
  (persist via App draft autosave). Plain textarea editing for now (CodeMirror-class
  editor deferred).

### Formatter UX polish (`formatter.tsx`)
- [x] **Hybrid toolbar**: primary icons stay visible (Format options, Copy, Full view,
  Save); secondary actions moved into a `MoreVertical` "More actions" overflow menu
  (Export to file, Code snapshot, Clear). Clear is destructive + below a divider, away
  from Save. Outside-click/Escape close.
- [x] **Format & Beautify** button hidden for Plain Text (pure pass-through no-op);
  small gap added so the input's last line no longer clips against it. Formatting is
  already live (180ms debounce), so the button is an explicit-format affordance.
- [x] OUTPUT now defaults to **Preview** for Markdown (note-first), formatted view for others.

### Store listing (`STORE_LISTING.md`)
- [x] Opening line reframed to "JSON, code snippets, and notes" (was "JSON and code").
  Em-dashes minimized across the pasteable copy. Library bullet + shortcut + v1.2.0
  "What's new" updated. Source of truth in git; paste into the Chrome dashboard manually.

### Verification (Phase 14)
- [x] Driven in real Chrome (playwright-core): Full view open/edit/preview/sync/close;
  hybrid toolbar + overflow menu; Markdown preview default; format button hidden for text.
- [x] Typecheck + 47 tests + production build clean.

### Not done / next
- [ ] Commit + rebuild store packages (chrome/firefox/edge + source zip) for the 1.2.0 release.
- [ ] Optional: jsdom + Testing Library component tests (Library folders, focus view).
- [ ] Optional: true in-editor highlighting (CodeMirror-class) for a real text editor.
- [ ] Optional: "Format options" tooltip looks slightly detached (tooltip-position tweak).

## Phase 13 — highlighting, testing, smart import, subfolders, data safety (v1.1.x → v1.2.0)

### Data safety (critical, shipped while live)
- [x] `storage.ts` IndexedDB `upgrade()` is now **additive** (create-store-if-missing) instead of dropping all stores on a version bump — existing users' libraries survive future schema bumps. Version stays at 3; future changes go in `if (oldVersion < N)` blocks. Never reintroduce a destructive upgrade.

### Syntax highlighting
- [x] Rewrote highlighting on **lowlight** (highlight.js grammars) returning a hast tree, rendered as React `<span>`s in `highlighted-code.tsx` — no `innerHTML`, accurate VS Code-style colors. Replaced an earlier hand-rolled regex tokenizer (sticky-regex bug produced monochrome output).
- [x] Added `hljs-*` theme classes (`selector-pseudo`, `link`, `code`) to `index.css` to cover highlight.js v11 output.

### Testing (new)
- [x] Vitest set up; tests live in `test/` mirroring `src/` (`test/lib/*.test.ts`). `pnpm test` / `pnpm test:watch`. Config in `vite.config.ts` (`environment: node`).
- [x] 47 tests: `formatter`, `highlight`, `io` (import/export, guardrails), `projects` (tree helpers).

### Smart import (Obsidian/Postman-style)
- [x] `io.ts` `importFiles(files)` router: a single StructFlow backup restores; anything else is ingested as external content — loose files, a folder (`webkitdirectory`), or a zip of files. Language detected by extension; unknown → plain text.
- [x] Recreates the **full nested folder tree** from directory/zip paths (parentId chain). Guardrails: skips `node_modules`/`.git`/`dist`/binaries; caps 1000 files / 512 KB-file / 32 MB total; reports a `skipped` count in the preview.
- [x] Library: two toolbar buttons — Import files, Import folder.

### Subfolders (nested projects, unlimited depth)
- [x] `Project.parentId` (optional, additive — no migration). Helpers in `types.ts`: `projectChildren`, `projectDescendantIds`, `projectPath`.
- [x] `library.tsx`: recursive folder rendering (indent via existing `pl-3`), "New folder" in folder menu, cascade **delete with confirm** (shows nested-folder/entry counts). `storage.ts` `deleteProject` cascades descendants + their entries.
- [x] Move/Save/Edit dropdowns show nested paths ("Work / SQL"). Export writes nested directory paths + `parentId`; import re-points `parentId` across id regeneration.
- [x] Search now matches **folder/project names** too (a name match reveals the whole subtree), plus entry title/content/language/tags.
- [x] Empty folders now show in the Library before any entry exists.

### Snapshot fixes
- [x] Copy/Download PNG fixed (canvas tainting) — back on `html-to-image`. Adaptive `pixelRatio` so very large snapshots fit the ~16384px canvas limit instead of truncating. Per-button spinner (no flicker) + loading overlay + surfaced errors + deferred object-URL revoke.

### Polish
- [x] Global base CSS restores `cursor: pointer` on buttons/menus (Tailwind v4 dropped it). `MenuItem` gets `role="menuitem"`; `ModalButton` gains a `danger` variant.
- [x] Em-dashes removed from public/user-facing files (README, store copy, in-app strings); internal `context/` docs keep them.
- [x] README install section + Chrome Web Store badges/link.

### Verification (Phase 13)
- [x] All flows driven in real Chrome (playwright-core vs `pnpm dev`): highlighting colors, snapshot PNG (small/wide/tall/huge), loose-file + deep-folder + zip import, nested-backup export→re-import round-trip, subfolder create/nest/cascade-delete, search by entry + folder name.
- [x] 47 unit tests + typecheck + production build clean. Version bumped to 1.2.0 (package.json, public/manifest.json, `STRUCTFLOW_APP_VERSION`).

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
See `context/future-features.md` for the full ideas backlog.

## Phase 12 — cross-browser packaging + tooltips
- [x] Added browser-specific packaging scripts: `package:chrome`, `package:edge`, `package:firefox`
- [x] Added post-build manifest generator for Chrome, Edge, and Firefox
- [x] Edge package keeps Chromium MV3 side-panel manifest
- [x] Firefox package swaps `side_panel` for `sidebar_action` and removes `sidePanel` permission
- [x] Background worker opens Chrome/Edge side panel or Firefox sidebar where supported
- [x] Added `BROWSER_PUBLISHING.md` with Edge and Firefox test/submission steps
- [x] Added dynamic styled tooltips for shared formatter icon buttons, view toggles, JSON copy actions, library header actions, row actions, and folder controls
  - tooltips render through a floating portal, flip when there is not enough room, and clamp inside the viewport

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
- [x] Added `pnpm assets:store` real screenshot capture generator
- [x] Added `pnpm assets:store:annotated` text-enhanced asset generator
- [x] Generated five 1280x800 plain Chrome Web Store screenshots in `store-assets/plain/`
- [x] Generated five 1280x800 annotated Chrome Web Store screenshots in `store-assets/annotated/`
- [x] Generated 440x280 promo image in `store-assets/`
- [x] Added `SUPPORT.md` support-page source
- [ ] Replace placeholder public privacy/support URLs before launch

## Phase 8 — docs & launch prep
- [x] Refreshed `.project-context.md` (note-taking + monetization angle, full feature list, non-goals)
- [x] Rewrote `architecture-context.md` file map + added subsystem notes (content script, syntax themes, snapshot, support, extension wiring)
- [x] Created `future-features.md` ideas backlog (capture, languages, notes, viewer, snapshot, library, UX, monetization, tech debt)
- [x] Created root `README.md` (install-from-source, dev, asset regen, stack, docs index, support)
- [x] Created `STORE_LISTING.md` (Chrome Web Store name/summary/description/release notes/permissions/assets checklist)
  - permissions justification matched to actual manifest (`sidePanel`, `storage`, `contextMenus`, `<all_urls>` + content script)
