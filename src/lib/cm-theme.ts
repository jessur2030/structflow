import { HighlightStyle } from "@codemirror/language"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

/**
 * Bridges CodeMirror's Lezer highlight tags to StructFlow's existing `--syn-*`
 * CSS variables (see `syntax-themes.ts` / `syntaxThemeVars`). The values are
 * `var(--syn-*)` references, not literal colors, so this single HighlightStyle
 * works for ALL 8 syntax themes — switching themes only swaps the inline vars on
 * the editor host; this style never changes. Mirrors the `.hljs-*` -> `var(--syn-*)`
 * mapping in `index.css` so the editable surface matches the read-only views.
 */
export const synHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--syn-string)" },
  { tag: [t.number, t.integer, t.float], color: "var(--syn-number)" },
  { tag: [t.bool], color: "var(--syn-boolean)" },
  { tag: [t.null], color: "var(--syn-null)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--syn-func)" },
  { tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)], color: "var(--syn-type)" },
  { tag: [t.tagName], color: "var(--syn-func)" },
  // JSON / object property names map to the "key" slot; HTML/JSX attributes to "attr".
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "var(--syn-key)" },
  { tag: [t.attributeName], color: "var(--syn-attr)" },
  { tag: [t.variableName, t.special(t.variableName)], color: "var(--syn-attr)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.squareBracket, t.paren, t.angleBracket], color: "var(--syn-punctuation)" },
  { tag: [t.meta, t.attributeValue], color: "var(--syn-string)" },
  { tag: [t.link, t.url], color: "var(--syn-string)" },
  { tag: [t.heading, t.strong], fontWeight: "700" },
  { tag: [t.emphasis], fontStyle: "italic" },
])

/**
 * Container/chrome theme (background, gutter, selection, active line, caret).
 * Every value references a `--syn-*` var, so only the `{ dark }` flag — which
 * drives CodeMirror's built-in surfaces — actually varies between themes. Pass
 * the active theme's `base` and reconfigure only when it flips dark<->light.
 */
export function synEditorTheme(base: "dark" | "light") {
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--syn-bg)",
        color: "var(--syn-fg)",
        height: "100%",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.6",
        overflow: "auto",
      },
      ".cm-content": {
        caretColor: "var(--syn-fg)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--syn-bg)",
        color: "var(--syn-gutter)",
        border: "none",
      },
      ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--syn-gutter) 12%, transparent)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--syn-fg)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--syn-match)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--syn-fg)",
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "color-mix(in srgb, var(--syn-match) 60%, transparent)",
        outline: "1px solid color-mix(in srgb, var(--syn-gutter) 50%, transparent)",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-placeholder": {
        color: "color-mix(in srgb, var(--syn-fg) 45%, transparent)",
      },
    },
    { dark: base === "dark" },
  )
}
