# Future Features & Ideas — StructFlow

A living backlog of ideas. Nothing here is committed; it's a menu to pull from.
Group ordering is rough priority within each section, not a roadmap.

## Capture & input
- [ ] Auto-capture JSON from the current page's network responses (DevTools-style),
      not just raw-page takeover.
- [ ] Drag-and-drop file import onto the side panel.
- [ ] "Paste from clipboard" button + global shortcut to open panel and paste.
- [ ] URL fetch: paste a URL, fetch + format the JSON response.
- [ ] Detect and pretty-print JSON embedded in `<script type="application/json">`
      and `__NEXT_DATA__` / `__NUXT__` blobs on a page.

## Formatting & languages
- [ ] SQL dialect-aware formatting (Postgres / MySQL / T-SQL presets).
- [ ] More languages: YAML, TOML, XML (standalone), GraphQL, Python (via plugin).
- [ ] Minify / compact mode (one-line JSON, minified JS/CSS).
- [ ] JSON ↔ YAML and JSON ↔ CSV converters.
- [ ] JSON repair (fix trailing commas, single quotes, unquoted keys).
- [ ] Per-language remembered options (e.g. tab width per language).
- [ ] Format-on-paste toggle.

## Notes mode (Markdown / Plain Text)
- [ ] Autosave drafts so notes persist without an explicit save.
- [ ] Markdown checklists / task tracking.
- [ ] Slash commands and snippet insertion.
- [ ] Word/char count + reading time for notes.
- [ ] Pin a "scratchpad" note that's always one click away.

## JSON viewer
- [ ] JSONPath / jq-style query bar to filter large documents.
- [ ] Diff two JSON documents (side-by-side or inline).
- [ ] Collapse-to-depth control (1/2/3/all) in the side panel tree too.
- [ ] Copy as: TypeScript interface, Zod schema, Go struct, etc.
- [ ] Big-document virtualization for very large payloads.

## Snapshot / export
- [ ] Gradient and image backdrops (currently solid only).
- [ ] Aspect-ratio presets (1:1, 16:9, social/OG sizes).
- [ ] Watermark / custom branding toggle.
- [ ] Export as SVG in addition to PNG.
- [ ] Copy a shareable link/embed (would require hosting — see Monetization).

## Library / organization
- [x] Bulk export of the library as a .zip (foldered by project + manifest.json).
- [ ] Re-import from an exported .zip / manifest.json (round-trip restore).
- [ ] Drag to reorder / move entries between folders; nested folder UI.
- [ ] Tags + tag filters in addition to projects.
- [ ] Trash / soft-delete with restore.
- [ ] Favorites / pinned entries.

## UX & platform
- [ ] Keyboard shortcuts + command palette.
- [ ] Per-site setting to enable/disable the in-page viewer.
- [ ] More syntax themes + a custom theme editor.
- [ ] i18n / localization.
- [ ] Firefox / Edge builds (MV3 compatibility pass).
- [ ] Optional sync across devices (would require a backend — see Monetization).

## Monetization (open-core friendly)
> Goal: open-source the core, offer convenience/cloud features as paid.
- [ ] Keep the formatter + viewer + local library free and open source.
- [ ] "Pro" tier candidates: cloud sync, shareable snapshot links, team
      workspaces, larger snapshot exports, premium themes.
- [ ] One-time license vs. subscription decision.
- [ ] Support links already shipped (`src/lib/support-links.ts`): GitHub,
      Buy Me a Coffee, Sponsor/Donate — fill in real URLs before launch.
- [ ] Consider GitHub Sponsors tiers tied to roadmap voting.

## Housekeeping / tech debt
- [ ] Clean up the few pre-existing `tsc --noEmit` warnings (logo.png ambient
      declaration, a couple of `any`s) — they don't block the Vite build.
- [ ] Add unit tests for `lib/formatter.ts` and `lib/storage.ts`.
- [ ] Add an `images.d.ts` so `*.png` imports are typed (removes logo.png warning).
- [ ] CI: typecheck + build on PRs once the repo is public.
