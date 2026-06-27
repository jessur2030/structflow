import { createLowlight } from "lowlight"
import json from "highlight.js/lib/languages/json"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import css from "highlight.js/lib/languages/css"
import markdown from "highlight.js/lib/languages/markdown"
import sql from "highlight.js/lib/languages/sql"
import plaintext from "highlight.js/lib/languages/plaintext"
import yaml from "highlight.js/lib/languages/yaml"
import python from "highlight.js/lib/languages/python"
import go from "highlight.js/lib/languages/go"
import rust from "highlight.js/lib/languages/rust"
import java from "highlight.js/lib/languages/java"
import cpp from "highlight.js/lib/languages/cpp"
import csharp from "highlight.js/lib/languages/csharp"
import php from "highlight.js/lib/languages/php"
import ruby from "highlight.js/lib/languages/ruby"
import bash from "highlight.js/lib/languages/bash"
import ini from "highlight.js/lib/languages/ini"
import dockerfile from "highlight.js/lib/languages/dockerfile"
import kotlin from "highlight.js/lib/languages/kotlin"
import swift from "highlight.js/lib/languages/swift"
import type { Root } from "hast"

// Only the languages StructFlow supports are registered, so the bundle ships
// just these grammars rather than all of highlight.js. Names match the `hljs`
// field in LANGUAGES (types.ts) — Tier 2 grammars keep read-only views
// (snapshot, markdown code blocks) highlighting consistently with the editor.
const lowlight = createLowlight({
  json,
  javascript,
  typescript,
  xml,
  css,
  markdown,
  sql,
  plaintext,
  yaml,
  python,
  go,
  rust,
  java,
  cpp,
  csharp,
  php,
  ruby,
  bash,
  ini,
  dockerfile,
  kotlin,
  swift,
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
    case "py":
      return "python"
    case "rb":
      return "ruby"
    case "sh":
    case "zsh":
    case "shell":
      return "bash"
    case "yml":
      return "yaml"
    case "rs":
      return "rust"
    case "kt":
    case "kts":
      return "kotlin"
    case "cs":
      return "csharp"
    case "toml":
      return "ini"
    case "c":
    case "h":
    case "hpp":
    case "c++":
      return "cpp"
    case "golang":
      return "go"
    case "":
      return ""
    default:
      return lang
  }
}
