# Changelog

## 1.2.0

- Library: nested folders with unlimited depth. Create a folder inside any folder from its menu, see the tree with indentation, and delete a folder with a confirmation that cascades to the folders and entries inside it.
- Import: smarter import. A StructFlow backup restores your library; anything else is brought in as content. Import loose files, a whole folder (Obsidian-style, including nested folders), or a zip of files. Language is detected from the file extension, folders are recreated, and binaries plus heavy directories (node_modules, .git, dist) are skipped with size limits.
- Search: now matches folder names in addition to entry title, content, language, and tags. Matching a folder name reveals everything inside it.
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
