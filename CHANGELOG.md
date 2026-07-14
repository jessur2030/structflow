# Changelog

## 1.5.6

- **Theme changes now reach open JSON pages instantly.** Picking an Editor & JSON theme in the side panel (or on a raw JSON page itself) updates every open JSON tab immediately. Previously the panel's pick never reached JSON pages at all, and a pick made on one page only showed up elsewhere after a refresh.
- **Markdown "Contents" links always land on their section.** Heading anchors could silently drift after the app re-rendered, leaving outline links pointing at nothing; clicking felt like it only worked sometimes. Anchors are now stable. Links inside the note body that point at a heading also scroll in place now, instead of opening a useless new tab.

## 1.5.5

- **One-click fix for loose JSON objects.** Paste several JSON objects without the wrapping brackets (log output, or a chunk copied out of the middle of an array) and StructFlow used to just say "Invalid". It now recognizes the shape and offers to wrap them into an array and format, in one click. It never rewrites your text on its own, and genuinely valid JSON is untouched.

## 1.5.4

- **The Markdown outline is now a collapsible "Contents" toggle.** Long notes used to open with a full table of contents pinned above the document. It is now a small "Contents" line you expand only when you want it, so short notes are not pushed down the page.

## 1.5.3

- Store listing and manifest description wording only (removed keyword-list phrasing so the Chrome Web Store description/summary read as clear prose). No functional changes.

## 1.5.2

- **Searchable "Move to" folder picker.** Moving an entry (or a whole folder) now opens a searchable picker that shows each destination's full path, instead of a cramped menu that truncated deep folders to "develop…". Type to filter, folders are shown as a tree, and you can't move a folder into itself. Drag-and-drop still works.
- **Refreshed app icon.** A cleaner, bolder logo that stays legible down to the 16px toolbar size, where the old mark blurred.
- **Faster in-page JSON viewer on large pages.** The interactive tree is now built only when you open it, so large raw JSON pages show their formatted view without the extra work up front.

## 1.5.1

- **Folder import is now drag-and-drop.** Drag a folder from your file manager straight onto the Library panel to bring in its whole nested structure. This replaces the folder-picker button, which could crash the side panel on some systems. Dropping loose files or a StructFlow backup works the same way, and it works in both Chrome and Firefox.
- **New entry button in the Editor.** Start a fresh note or snippet without switching back to the Library. It opens a clean, writable editor, and asks before discarding an unsaved draft.
- **Folders remember their collapsed state.** Collapse a folder in the Library and it stays collapsed across tab switches and reloads, the way a file explorer does.

## 1.5.0

- The **Editor** (formerly the "Formatter" tab) now treats the document you are working on as a first-class entry. Open a saved entry and an identity bar appears right above the editor: rename it, pin it, move it to a folder, and add tags inline. Your edits save back to that entry automatically, so opening something, tweaking it, and moving on no longer leaves a duplicate behind.
- **Tags are now a proper multi-select** with chips and autocomplete. Tags you have already used on other entries are suggested as you type, so it is easy to reuse `api` or `auth` instead of retyping them. The old comma-separated field is gone.
- **Right-click menus everywhere.** Entries, folders, and the empty Library area all have context menus now. Right-click the Library background for New folder, Import, and Export; right-click any folder or entry for its actions.
- **Drag-and-drop for folders.** Folders can be dragged to nest them inside another folder or back out to the top level, in addition to dragging entries, with a guard so a folder can never be dropped inside itself.
- **Import improvements.** When you import, a new "Import into" picker lets you choose a destination folder, and folder import now uses the File System Access API (a lazy walk that skips `node_modules`/`.git` and oversized files). Move-to menus also show the full nested folder name instead of truncating it.
- **A cleaner look.** The dark theme is now a true neutral (the previous blue cast is gone), surfaces sit on a deliberate light/dark elevation scale, and all text follows one consistent type scale.

## 1.4.1

- Auto-detect on paste now focuses on the two formats it can recognize with high confidence: **JSON** and **Markdown**. A pasted note reliably opens its rendered preview, and pasted JSON opens its tree. Other content (code, HTML, CSS, SQL, and so on) keeps your current language; pick it from the language menu in one click. This removes the occasional wrong guess, such as prose being treated as TypeScript.
- Markdown preview fixes: bullet and numbered lists now show their markers, and GFM task lists (`- [ ]` / `- [x]`) render real checkboxes.

## 1.4.0

- Many more languages. The editor now highlights 20+ languages. The ones with a real formatter still beautify on demand: Markdown, JSON, JavaScript, TypeScript, HTML, CSS, SQL, and now **YAML**. The rest are highlight-and-keep only: Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, Shell, TOML, Dockerfile, Kotlin, and Swift. The "Format & Beautify" button hides for languages that have no formatter (like Plain Text).
- Auto-detect on paste. Paste into an empty editor and StructFlow sets the language for you, with a one-click "Undo". It stays conservative, so plain notes are never disturbed. (Refined in 1.4.1 to JSON + Markdown.)
- New language picker. Searchable, with a Recent section, per-language icons, and full keyboard navigation, instead of a plain dropdown.
- New themes. Added the **Aura Noir** family (Aura Noir plus Modern, Aurora, Ember, Rose, Forest, and Crimson) and two light themes (Aura Lumen, Aura Day). A fresh install now starts on a light or dark theme that matches your browser, so the code surface never clashes with the UI. Highlighting also gained a dedicated color for type/class names for more accurate output.
- New Settings screen (gear icon): appearance, syntax theme, default language for new notes, the in-page JSON viewer toggle, data export/import and "clear all", and an About section with version and your keyboard shortcut. The new themes are available in the in-page viewer too.

## 1.3.0

- Rebuilt the formatter around a single in-place code editor. Instead of typing into a plain box and watching a separate output panel, you now edit on one syntax-highlighted surface with line numbers (CodeMirror-class). "Format & Beautify" rewrites your text in place.
- One surface, four modes: Edit, Preview (rendered Markdown), Tree (JSON), and Diff (see exactly what formatting would change). The output is no longer a permanent second panel.
- Full view uses the same editor, so editing feels identical whether inline or fullscreen.

## 1.2.0

- Library: nested folders with unlimited depth. Create a folder inside any folder from its menu, see the tree with indentation, and delete a folder with a confirmation that cascades to the folders and entries inside it.
- Import: smarter import. A StructFlow backup restores your library; anything else is brought in as content. Import loose files, a whole folder (Obsidian-style, including nested folders), or a zip of files. Language is detected from the file extension, folders are recreated, and binaries plus heavy directories (node_modules, .git, dist) are skipped with size limits.
- Search: now matches folder names in addition to entry title, content, language, and tags. Matching a folder name reveals everything inside it.
- Full view: open any document fullscreen with an edit/preview toggle (book/pen). Markdown renders live at a readable width, which is great for presenting. Opens with the expand button or Ctrl/Cmd+Shift+F.
- Cleaner formatter toolbar: the most-used actions stay visible and the rest (export, snapshot, clear) move into a "More actions" menu, with Clear separated so it is harder to hit by accident. Markdown opens in preview by default.
- Consistent terminology: organizational containers are now called "folders" everywhere (previously a mix of "project" and "subfolder").
- Reliability: library data now survives future updates. Database migrations are additive, so a schema change upgrades your saved entries instead of clearing them.
- Save, move, and edit menus show the full nested folder path (for example, "Work / SQL").

## 1.1.0

- Snapshot: Copy PNG and Download PNG are fixed and reliable. Large snapshots scale to fit the browser image-size limit instead of being cut off, the action buttons no longer flicker, and a loading indicator shows while rendering.
- Syntax highlighting is more accurate, with VS Code-style coloring across JSON, JS/TS, CSS, SQL, HTML, and Markdown.
- Fixed empty folders not appearing in the Library until an entry was saved.
- Restored the pointer cursor on buttons and menus.
- Added an automated test suite.

## 1.0.0 - Unreleased

- Added multi-language formatting for Markdown, Plain Text, TypeScript, JavaScript, JSON, HTML, CSS, and SQL.
- Added syntax-highlighted output, JSON tree search, copy path/value actions, compare view, Markdown preview, and PNG snapshots.
- Added local library projects with import/export, tags, pinned entries, recent entries, duplicate copies, and entry detail editing.
- Added Chrome side-panel shortcut command: `Ctrl+Shift+S` by default, `MacCtrl+Shift+S` on macOS.
- Added privacy policy and release packaging script.
