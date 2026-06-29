# Changelog

## 1.5.0

- The **Editor** (formerly the "Formatter" tab) now treats the document you are working on as a first-class entry. Open a saved entry and an identity bar appears right above the editor: rename it, pin it, move it to a folder, and add tags inline. Your edits save back to that entry automatically, so opening something, tweaking it, and moving on no longer leaves a duplicate behind.
- **Tags are now a proper multi-select** with chips and autocomplete. Tags you have already used on other entries are suggested as you type, so it is easy to reuse `api` or `auth` instead of retyping them. The old comma-separated field is gone.
- **Right-click menus everywhere.** Entries, folders, and the empty Library area all have context menus now. Right-click the Library background for New folder, Import, and Export; right-click any folder or entry for its actions.
- **Drag-and-drop for folders.** Folders can be dragged to nest them inside another folder or back out to the top level, in addition to dragging entries, with a guard so a folder can never be dropped inside itself.
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
