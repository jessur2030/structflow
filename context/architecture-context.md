# Architecture Context — StructFlow

## Stack

- **Vite + React + TypeScript** — bundles to static assets that load as an
  unpacked MV3 extension and run in browser preview.
- **Tailwind v4** (`@tailwindcss/vite`) — tokens/variables in `src/index.css`.
- **Prettier (standalone + plugins)** + **sql-formatter** — formatting engine.
- **CodeMirror 6** (`@codemirror/*` + `@lezer/highlight`) — the in-place editor;
  per-language grammars (`lang-*` / `legacy-modes`) are lazy-loaded in `cm-languages.ts`.
- **lowlight** (highlight.js grammars) — syntax highlighting for read-only views
  (Markdown code blocks, snapshot) as a hast tree → React `<span>`s in
  `highlighted-code.tsx` (no `innerHTML`).
- **html-to-image** — DOM → PNG for the code snapshot exporter (adaptive
  pixelRatio so large snapshots stay under the ~16384px canvas limit).
- **marked** — Markdown lexer for the React-rendered preview (no DOMPurify).
- **fflate** — client-side `.zip` creation for bulk library export and import.
- **idb** — IndexedDB wrapper for the library.
- **sharp** (dev) — `scripts/gen-icons.cjs` trims the logo + emits icon sizes.
- **chrome.sidePanel** + service worker — opens StructFlow in the side panel.
- **content script** — takes over raw JSON pages with the in-page viewer.

## File map

```
index.html                      # Side-panel HTML entry (mounts React)
vite.config.ts                  # React + Tailwind plugins, multi-entry build (panel + content)
scripts/
  gen-icons.cjs                 # sharp: trim logo-source.png -> logo.png + icons + favicon
public/
  manifest.json                 # MV3 manifest: side_panel, background, content script, permissions
  icons/                        # 16/32/48/128 PNG icons
src/
  main.tsx                      # React root render
  App.tsx                       # Shell: tabs (Formatter | Library), theme, syntax theme, support, save modal
  background.ts                 # Service worker: open side panel on icon click
  content.ts                    # In-page JSON viewer (raw-page takeover): Formatted/Tree/Raw + theme picker + search
  index.css                     # Tailwind + design tokens + dark/light theme + syntax-surface + --snap-checker
  assets/
    logo-source.png             # Source brand art (input to gen-icons.cjs)
    logo.png                    # Trimmed header logo
  lib/
    types.ts                    # Shared types: Language (Tier 1: markdown|text|ts|js|json|html|css|sql|yaml; Tier 2 highlight-only: python|go|rust|java|cpp|csharp|php|ruby|shell|toml|dockerfile|kotlin|swift), LanguageMeta (formattable/mime), FormatOptions, Entry, Project, LANGUAGES
    formatter.ts                # format(code, lang, options) -> Prettier / sql-formatter; `text` + Tier 2 pass through
    detect.ts                   # detectLanguage(text) -> Language|null (conservative auto-detect on paste)
    cm-languages.ts             # loadLanguageSupport(lang): lazy-imported CodeMirror grammars (lang-* + legacy-modes)
    cm-theme.ts                 # synHighlightStyle (Lezer tags -> --syn-* vars) + synEditorTheme (editor chrome)
    storage.ts                  # IndexedDB CRUD: entries + projects (via idb)
    syntax-themes.ts            # Syntax theme defs (incl. Aura Noir family) + getSyntaxTheme + syntaxThemeVars (CSS var map)
    use-theme.ts                # App theme hook (dark|light)
    use-syntax-theme.ts         # Syntax theme hook; first-run default is mode-aware (aura-day/aura-noir-modern)
    support-links.ts            # EDITABLE config: GitHub / Buy Me a Coffee / Sponsor links
    io.ts                       # Clipboard copy + file download + slugify + exportEntriesAsZip (fflate) + mimeFor (from meta)
    utils.ts                    # cn() class merge + misc helpers
  components/
    formatter.tsx               # Main panel: toolbar, language picker, format-in-place, detect chip, snapshot/save; hosts EditorSurface
    code-editor.tsx             # CodeMirror 6 in-place editor (controlled; highlight + line numbers; paste auto-detect)
    editor-surface.tsx          # Shared mode switcher + dispatch (Edit/Preview/Tree/Diff); used by formatter + focus-view
    diff-view.tsx               # Diff mode: current buffer vs formatCode(buffer), computed on demand
    highlighted-code.tsx        # lowlight hast -> React spans (read-only highlighting; no innerHTML)
    markdown-preview.tsx        # Rendered Markdown preview (toggles vs source)
    json-tree.tsx               # Interactive collapsible JSON tree + search
    options-panel.tsx           # Formatter options (tab width, quotes, semicolons, sort keys switch, ...)
    language-select.tsx         # Searchable language picker (search + Recent + icons + keyboard nav)
    syntax-theme-select.tsx     # Editor/JSON syntax theme picker
    snapshot-modal.tsx          # CodeSnap-style PNG exporter (windowed card, backdrops, Copy/Download PNG)
    focus-view.tsx              # Fullscreen "Full view": renders the same EditorSurface, larger/centered
    support-button.tsx          # Header support popover (links from support-links.ts; inline GitHub SVG)
    settings-button.tsx         # Header gear popover: toggle the in-page JSON viewer (chrome.storage.local)
    theme-mode-toggle.tsx       # Dark/light toggle
    library.tsx                 # Saved entries grouped by folder + search + folder ⋯ menu (rename/add/recolor/delete) + bulk export modal
    modal.tsx                   # Reusable modal (save dialog, confirms)
    icon-button.tsx             # Small icon button primitive
```

## Data flow

1. **Edit/format**: `code-editor.tsx` is the single in-place editor bound to the
   formatter `input`. "Format & Beautify" (or Cmd/Ctrl+Enter) calls
   `lib/formatter.ts` and rewrites the buffer in place. Tier 2 languages + `text`
   pass through (no formatter); the button hides when `!meta.formattable`.
2. **Modes**: `editor-surface.tsx` toggles the one surface between **Edit**
   (`code-editor`), **Preview** (`markdown-preview`, Markdown), **Tree**
   (`json-tree`, JSON), and **Diff** (`diff-view`). No permanent output panel.
3. **Persist**: save action opens `modal` → writes an `Entry` (with optional
   `projectId`) to IndexedDB via `lib/storage.ts`.
4. **Library**: `library.tsx` reads entries + projects from storage, groups by
   folder, supports search and per-entry copy/export/re-open/delete.
5. **Theme**: `use-theme.ts` toggles a class on the root element; tokens in
   `index.css` resolve colors for both viewer and panel.

## Storage model (IndexedDB)

- **projects** (folders) — `{ id, name, color, createdAt, parentId? }`. `parentId`
  nests folders (null/absent = top-level). `color` is one of the shared
  `PROJECT_COLORS` (assigned randomly on create, user-editable via the folder menu).
  Note: the `Project` type name is kept internally, but the UI calls these "folders".
- **entries** — `{ id, title, language, content, projectId?, createdAt, updatedAt }`.
  `projectId` is `null`/absent for ungrouped ("No folder") entries.
- Indexes on `projectId` and `updatedAt` for grouping + recent ordering.

## Library: folders, add-to-project, and bulk export

- Folder rows have a ⋯ options menu (`ProjectGroup`): rename (inline), add new
  item, a color-swatch palette (`onRecolorProject`), and delete. Menus share the
  outside-click/Escape close + flip-up logic used by entry rows.
- **Add new item**: `onAddToProject(projectId)` switches to the Formatter with an
  empty editor and stores `pendingProjectId` in `App.tsx`; the next save defaults
  its project to that folder. Opening an existing entry clears `pendingProjectId`.
- **Bulk export**: `io.ts` `exportEntriesAsZip(entries, projects)` writes each
  entry as `<Project>/<slug(title)>.<ext>` (ungrouped → `No project/`),
  de-duplicates colliding filenames, and adds a `manifest.json` (projects +
  entries with metadata + content). Zipped with `fflate` `zipSync` and downloaded
  via an object URL. The Library's export modal picks which folders to include and
  shows live entry counts computed from the full (search-independent) set.

## Formatting engine notes

- JSON: parsed for validity (drives the Valid/Invalid badge), then pretty-printed.
- JS/TS/HTML/CSS/Markdown: Prettier standalone with the matching parser plugin.
- **Plain Text (`text`)**: pass-through — `formatter.ts` returns input unchanged
  (note-taking surface). Highlighted via hljs `plaintext`.
- SQL: `sql-formatter` — indentation/spacing only, not dialect-aware rewriting.
- Options are mapped from `FormatOptions` to each tool's config; defaults mirror VS Code.
- Default language on mount is **markdown** (`App.tsx`).

## Syntax theme system

- `lib/syntax-themes.ts` defines themes (VS Code, GitHub, Monokai, Dracula, Nord,
  Solarized…) as token→color maps. `syntaxThemeVars(theme)` produces CSS variables
  consumed by `.syntax-surface` rules in `index.css` (mapping hljs token classes).
- `use-syntax-theme.ts` persists the selected theme; applied independently of the
  app's dark/light chrome so output colors don't depend on panel mode.
- The in-page viewer mirrors the same theme list with its own picker.

## In-page JSON viewer (content script)

- `content.ts` runs on pages whose body is raw JSON (or a `.json` resource).
- Replaces the page with a StructFlow viewer: top bar (badge, search, theme
  picker, view buttons) + body.
- Three modes: **Formatted** (default; syntax-highlighted pretty JSON), **Tree**
  (collapsible, opens 2 levels deep, key/value search), **Raw**.
- Theme switch updates the existing `<style id="sf-styles">` node's text in place
  (avoids a minified-eval `el()` collision seen when re-injecting), and re-runs
  `highlightJson` for the Formatted view. Selection persisted via `chrome.storage`.
- Built as a separate Vite entry to a classic (non-ESM) `content.js`.

## Code snapshot exporter

- `snapshot-modal.tsx` renders the formatted output inside a windowed "card"
  (macOS traffic lights + optional filename), over a chosen solid backdrop.
- Controls: backdrop swatches, padding slider, title-bar + line-number toggles.
- Export via `html-to-image`: `toPng` for download, `toBlob` + `ClipboardItem`
  for Copy PNG; copy falls back to download if the clipboard write is blocked.
- `--snap-checker` CSS var provides the transparent-backdrop checkerboard.

## Extension wiring

- `manifest.json` declares `side_panel.default_path` = the built HTML entry,
  a background service worker (`background.ts`), a content script (`content.js`)
  for the in-page viewer, and minimal permissions (incl. `storage`).
- `background.ts` calls `chrome.sidePanel.open` (or sets panel behavior) on
  action click.

## v1.3.0–1.4.0 subsystem notes

- **Unified editor (v1.3.0)**: the split INPUT(textarea)/OUTPUT(read-only) model was
  replaced by one in-place **CodeMirror 6** editor (`code-editor.tsx`) + a shared
  `editor-surface.tsx` mode switcher (Edit/Preview/Tree/Diff). Themed via the existing
  `--syn-*` vars (`cm-theme.ts`: `synHighlightStyle` maps Lezer tags → vars;
  `synEditorTheme` for chrome). The controlled value-sync uses a `value !== doc` guard
  to avoid cursor jump. Format rewrites the buffer in place (no separate `output`).
  `code-view.tsx` + `compare-view.tsx` were removed; `diff-view.tsx` replaces compare.
- **Two-tier languages (v1.4.0)**: `LANGUAGES` carries `formattable` + `mime`. Tier 1
  formats (Prettier/sql-formatter, incl. YAML); Tier 2 (~13) is highlight-only and the
  formatter `switch` passes it through. Editor grammars lazy-load (`cm-languages.ts`);
  read-only views register highlight.js grammars (`highlight.ts`). Adding a `Language`
  means updating both `syntax-themes.ts`-adjacent maps and `content.ts` only where noted.
- **Auto-detect on paste (v1.4.0)**: `detect.ts` `detectLanguage` (conservative) runs
  from the CodeMirror paste handler when the paste starts a fresh buffer; the
  "Detected X · Undo" chip lives in `formatter.tsx`.
- **Syntax themes**: added the Aura Noir family (9) to `syntax-themes.ts` AND
  `content.ts` (keep both in sync). New `type` slot (`--syn-type`). First-run default
  is mode-aware (`use-syntax-theme.ts` + `content.ts`).
- **In-page viewer toggle**: `settings-button.tsx` writes
  `chrome.storage.local["structflow_inpage_enabled"]`; `content.ts` `main()` bails when off.

## v1.2.0 subsystem notes

- **Full view / focus mode** (`focus-view.tsx`): fullscreen overlay opened from the
  formatter's `Maximize2` button (or `Cmd/Ctrl+Shift+F`). Renders the same
  `EditorSurface` as the main panel (just larger/centered), so editing + the
  Edit/Preview/Tree/Diff modes are identical inline and fullscreen.
- **Formatter toolbar is hybrid**: primary icons visible (Format options, Copy, Full
  view, Save) + a `MoreVertical` overflow menu for Export / Snapshot / Clear. The
  "Format & Beautify" button rewrites in place and is hidden when the language is not
  `formattable`. An empty buffer opens in Edit; Markdown with content opens in Preview.
- **Terminology**: the UI says "folder" everywhere; the `Project` type name is kept
  internally (see Phase 14 in `progress-tracker.md`).
- **Library folders are nested.** `Project` has an optional `parentId`
  (top-level when null). Tree helpers in `types.ts`: `projectChildren`,
  `projectDescendantIds`, `projectPath`. `library.tsx` renders folders
  recursively (indent via the existing `pl-3` child wrapper) with a "New folder"
  action and a cascade delete-with-confirm. `storage.ts` `deleteProject`
  cascades to all descendant folders + their entries. Adding `parentId` needed
  no DB migration (IndexedDB stores arbitrary objects).
- **Import is a router** (`io.ts` `importFiles`): a single StructFlow backup
  restores; anything else is ingested as content — loose files, a folder
  (`webkitdirectory`), or a zip — rebuilding the full nested folder tree from
  path segments. Guardrails skip `node_modules`/`.git`/`dist`/binaries with
  file-count and byte caps; the preview shows a `skipped` count.
- **Export** writes nested directory paths and stores each folder's `parentId`
  in `manifest.json`; restore re-points `parentId` across id regeneration.
- **Search** (`library.tsx`) matches folder/project names in addition to entry
  fields; a folder-name match reveals its whole subtree.
- **IndexedDB `upgrade()` is additive** (create-if-missing) — never drop a store
  on a version bump; gate future changes on `oldVersion`.
- **Tests**: Vitest in `test/` mirroring `src/` (`pnpm test`).
