# Architecture Context — StructFlow

## Stack

- **Vite + React + TypeScript** — bundles to static assets that load as an
  unpacked MV3 extension and run in browser preview.
- **Tailwind v4** (`@tailwindcss/vite`) — tokens/variables in `src/index.css`.
- **Prettier (standalone + plugins)** + **sql-formatter** — formatting engine.
- **lowlight** (highlight.js grammars) — syntax highlighting as a hast tree,
  rendered to React `<span>`s in `highlighted-code.tsx` (no `innerHTML`).
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
    types.ts                    # Shared types: Language (markdown|text|ts|js|json|html|css|sql), FormatOptions, Entry, Project, LANGUAGES, PROJECT_COLORS
    formatter.ts                # format(code, lang, options) -> Prettier / sql-formatter; `text` is pass-through
    storage.ts                  # IndexedDB CRUD: entries + projects (via idb)
    syntax-themes.ts            # Syntax theme defs + getSyntaxTheme + syntaxThemeVars (CSS var map)
    use-theme.ts                # App theme hook (dark|light)
    use-syntax-theme.ts         # Syntax/editor theme hook (read/persist/apply)
    support-links.ts            # EDITABLE config: GitHub / Buy Me a Coffee / Sponsor links
    io.ts                       # Clipboard copy + file download + slugify + exportEntriesAsZip (fflate) + MIME map
    utils.ts                    # cn() class merge + misc helpers
  components/
    formatter.tsx               # Main editor: input, format, view toggle, toolbar, snapshot trigger
    code-view.tsx               # Highlighted text view w/ line numbers + wrap (hljs)
    markdown-preview.tsx        # Rendered Markdown preview (toggles vs source)
    json-tree.tsx               # Interactive collapsible JSON tree + search
    options-panel.tsx           # Formatter options (tab width, quotes, semicolons, sort keys switch, ...)
    language-select.tsx         # Language picker dropdown (Markdown default, Plain Text 2nd)
    syntax-theme-select.tsx     # Editor/JSON syntax theme picker
    snapshot-modal.tsx          # CodeSnap-style PNG exporter (windowed card, backdrops, Copy/Download PNG)
    support-button.tsx          # Header support popover (links from support-links.ts; inline GitHub SVG)
    theme-mode-toggle.tsx       # Dark/light toggle
    library.tsx                 # Saved entries grouped by folder + search + folder ⋯ menu (rename/add/recolor/delete) + bulk export modal
    modal.tsx                   # Reusable modal (save dialog, confirms)
    icon-button.tsx             # Small icon button primitive
```

## Data flow

1. **Format**: `formatter.tsx` reads input + selected `Language` + `FormatOptions`
   → calls `lib/formatter.ts` → returns formatted string (or parse error).
2. **View**: formatted JSON can render as `code-view` (text) or `json-tree`
   (interactive). Other languages render in `code-view`.
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

## v1.2.0 subsystem notes

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
