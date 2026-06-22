import { createLowlight } from "lowlight"
import json from "highlight.js/lib/languages/json"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import css from "highlight.js/lib/languages/css"
import markdown from "highlight.js/lib/languages/markdown"
import sql from "highlight.js/lib/languages/sql"
import plaintext from "highlight.js/lib/languages/plaintext"
import type { Root } from "hast"

// Only the languages StructFlow supports are registered, so the bundle ships
// just these grammars rather than all of highlight.js.
const lowlight = createLowlight({
  json,
  javascript,
  typescript,
  xml,
  css,
  markdown,
  sql,
  plaintext,
})

/**
 * Highlight `code` into a hast (HTML AST) tree of `<span class="hljs-*">`
 * nodes. Rendering the tree as React elements (see HighlightedCode) avoids any
 * innerHTML usage while reusing highlight.js's real grammars and the existing
 * `.hljs-*` theme CSS.
 */
export function highlightCode(code: string, language: string): Root {
  if (!code) return { type: "root", children: [] }

  const normalized = normalizeLanguage(language)
  if (normalized && lowlight.registered(normalized)) {
    try {
      return lowlight.highlight(normalized, code)
    } catch {
      // fall through to plain text
    }
  }

  return { type: "root", children: [{ type: "text", value: code }] }
}

function normalizeLanguage(language: string): string {
  const lang = language.trim().toLowerCase().split(/\s+/)[0] ?? ""

  switch (lang) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript"
    case "ts":
    case "tsx":
      return "typescript"
    case "html":
    case "svg":
      return "xml"
    case "md":
    case "mdown":
      return "markdown"
    case "":
      return ""
    default:
      return lang
  }
}
