import hljs from "highlight.js/lib/core"
import json from "highlight.js/lib/languages/json"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import css from "highlight.js/lib/languages/css"
import markdown from "highlight.js/lib/languages/markdown"
import sql from "highlight.js/lib/languages/sql"
import plaintext from "highlight.js/lib/languages/plaintext"

const languages = {
  json,
  javascript,
  typescript,
  xml,
  css,
  markdown,
  sql,
  plaintext,
}

for (const [name, language] of Object.entries(languages)) {
  if (!hljs.getLanguage(name)) {
    hljs.registerLanguage(name, language)
  }
}

export { hljs }

export function highlightCode(code: string, language: string): string {
  if (!code) return ""

  const normalizedLanguage = normalizeLanguage(language)
  try {
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      return hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return escapeHtml(code)
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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
    case "xml":
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
