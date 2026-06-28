# StructFlow — Build Plan / Overview

> A high-level overview of what StructFlow is and the decisions behind it. For the
> detailed file map see `architecture-context.md`; for shipped-per-phase history see
> `progress-tracker.md`; for the ideas backlog see `future-features.md`. Current
> version: 1.4.1.

StructFlow is a Chrome/Firefox **MV3 side-panel extension**: an in-place code editor,
a JSON viewer (in the panel **and** on raw JSON pages), a code-snapshot PNG exporter,
and an IndexedDB-backed snippet/notes library. Markdown and Plain Text are first-class,
so it doubles as a lightweight note-taker. Everything runs locally — no accounts, no
servers, no network calls.

## Goals

1. **In-place code editor** (CodeMirror 6) with live syntax highlighting + line numbers;
   one surface that toggles Edit / Preview (Markdown) / Tree (JSON) / Diff. Format
   rewrites the buffer in place.
2. **20+ languages**, two tiers: *formatted* (Markdown, JSON, JS, TS, HTML, CSS, SQL,
   YAML) and *highlight-only* (Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, Shell,
   TOML, Dockerfile, Kotlin, Swift).
3. **JSON viewer**: collapsible tree with search + highlighted text view, plus a
   content-script viewer that takes over raw `.json` pages.
4. **Notes**: Markdown-first with live preview; Plain Text is a no-format scratchpad.
5. **Library**: nested folders, search, import/export (.zip), pinned/tags/recent.
6. **Snapshots**: render formatted code to a shareable PNG.
7. **Personalization**: light/dark app + 19 syntax themes (incl. the author's Aura Noir
   family); an in-panel Settings screen. Local-first throughout.

## Decisions (confirmed with user)

| Question | Decision |
| --- | --- |
| Build target | Previewable web app **and** real MV3 extension (Vite) |
| Editor | **CodeMirror 6** — not Monaco (MV3 CSP + bundle size); grammars lazy-loaded |
| Highlighting | Editor = CodeMirror/Lezer; read-only views = **lowlight** (no `innerHTML`); both themed by one `--syn-*` CSS-var set |
| Languages | Two-tier: format what has a real formatter, highlight the rest |
| Auto-detect | JSON + Markdown only, on paste into a fresh buffer, with one-click Undo |
| Storage | **IndexedDB** (via `idb`) for the library; `localStorage` for prefs/draft |
| Settings | **In-panel** screen (not a separate options page) |
| Themes | Aura Noir family added; first-run default is mode-aware (light/dark) |
| Data safety | IndexedDB `upgrade()` stays additive — never drop a store (live users) |

## Tech stack

- **Vite + React 19 + TypeScript**, **Tailwind v4** (tokens in `src/index.css`).
- **CodeMirror 6** — the in-place editor (per-language grammars lazy-loaded).
- **Prettier (standalone + plugins)** + **sql-formatter** — formatting engine (incl. YAML).
- **lowlight / highlight.js** — read-only highlighting (Markdown code blocks, snapshot).
- **marked** — Markdown lexer rendered to React elements (no `innerHTML`).
- **html-to-image** (PNG snapshots), **fflate** (library .zip), **idb** (IndexedDB).
- **chrome.sidePanel / Firefox `sidebar_action`** + service worker + content script.

## Verification

- `pnpm test` (Vitest, node env), `pnpm exec tsc --noEmit`, `pnpm build` stay clean.
- UI changes verified in **real Chrome** with playwright-core against `pnpm dev`
  (system Chrome, ~400px side-panel width) — not just unit tests.
- Per-store packages: `pnpm package:chrome | firefox | edge`; AMO source via `git archive`.

## How to load in Chrome

`pnpm build` → `chrome://extensions` → enable Developer mode → "Load unpacked" →
select `dist/`. Click the toolbar icon (or the shortcut) to open the side panel.
