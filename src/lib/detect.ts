import { validate } from "./formatter"
import type { Language } from "./types"

/**
 * Best-effort language detection from a chunk of pasted text. CONSERVATIVE by
 * design: returns `null` unless reasonably confident, so a plain prose note is
 * never reclassified. Used by the editor's paste handler to auto-set the language
 * (only into an empty buffer, and always reversible via the Undo chip).
 *
 * Precedence runs most-reliable first: JSON (parsed) -> HTML -> CSS -> SQL ->
 * TS/JS -> a few high-signal Tier 2 langs -> Markdown (only on real markers).
 */
export function detectLanguage(text: string): Language | null {
  const trimmed = text.trim()
  if (trimmed.length < 8) return null // too short to be confident
  if (/\x00/.test(text)) return null // binary

  // Bound regex cost on huge pastes; structural signal lives near the top anyway.
  const sample = text.length > 65536 ? text.slice(0, 65536) : text

  // 1. JSON — most reliable: real parse + object/array shape.
  if ((trimmed[0] === "{" || trimmed[0] === "[") && validate("json", text).ok) {
    return "json"
  }

  // 1.5. Markdown. Strong markers that don't appear in source code classify
  // immediately (a fenced block, a table, a link, or two-plus bold spans);
  // checked before the code heuristics so a markdown doc wrapping a JS/TS snippet
  // — or rich prose like a project brief — is recognized as markdown.
  const boldSpans = sample.match(/\*\*(?=\S)[^\n*]*[A-Za-z][^\n*]*\*\*/g)?.length ?? 0
  if (
    /(?:^|\n)\s*(?:```|~~~)/.test(sample) ||
    /\[[^\]]+\]\([^)]+\)/.test(sample) ||
    /(?:^|\n)\|.+\|.*\n\|[\s:|-]+\|/.test(sample) ||
    boldSpans >= 2
  ) {
    return "markdown"
  }

  // 1.6. Weaker, ambiguous markers — a bullet list, an ordered list, a single
  // bold span, or `_emphasis_`. Each is a false-positive risk alone (a bullet
  // clashes with a YAML sequence `- a`; `**kwargs` looks like a bold span), so
  // require at least TWO distinct kinds together before calling it markdown.
  let mdSignals = 0
  if (/(?:^|\n)[ \t]*[-*+][ \t]+\S/.test(sample)) mdSignals++ // bullet list
  if (/(?:^|\n)[ \t]*\d+[.)][ \t]+\S/.test(sample)) mdSignals++ // ordered list
  if (boldSpans >= 1) mdSignals++ // a bold span
  if (/(?:^|\s)_(?=\S)[^_\n]+?_(?=\s|[.,:;!?)]|$)/.test(sample)) mdSignals++ // emphasis
  if (mdSignals >= 2) return "markdown"

  // 2. HTML — a recognized tag, closing tag, or doctype.
  if (
    /<!doctype html|<html[\s>]|<\/(?:div|span|p|body|head|ul|li|table|section|a)>|<(?:div|span|p|body|head|section|article|main|header|footer|nav|button|img|input|form)[\s/>]/i.test(
      sample,
    )
  ) {
    return "html"
  }

  // 3. CSS — at-rule, or a selector followed by a `{ prop: value }` block.
  if (
    /@(?:media|import|keyframes|font-face|supports|tailwind|apply|charset)\b/.test(sample) ||
    /(?:^|\n)\s*[.#]?[\w-]+(?:\s*[>+~,]\s*[\w.#:-]+)*\s*\{[^}]*[\w-]+\s*:\s*[^;}]+;/.test(sample)
  ) {
    return "css"
  }

  // 4. SQL — a statement-leading keyword AND a secondary clause.
  if (
    /^\s*(?:--.*\n\s*)*(?:WITH|SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(?:TABLE|VIEW|INDEX|DATABASE)|ALTER\s+TABLE|DROP\s+(?:TABLE|VIEW)|TRUNCATE)\b/i.test(
      sample,
    ) &&
    /\b(?:FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|VALUES|SET|INTO)\b/i.test(sample)
  ) {
    return "sql"
  }

  // 5. TypeScript vs JavaScript. Strong TS keywords stand on their own (they have
  // no JS-base statement); otherwise require a JS base, then look for annotations.
  // NB: access modifiers (`public`/`private`/...) are common English words, so
  // they only count in real member-declaration syntax: optional further
  // modifiers, an identifier, then a member token (`(`, `:`, `=`, `?`, `<`).
  // A bare `public storefront` in prose must NOT register as TypeScript.
  const strongTs =
    /\binterface\s+[A-Za-z_]\w*/.test(sample) ||
    /\btype\s+[A-Za-z_]\w*\s*[=<]/.test(sample) ||
    /\benum\s+\w+/.test(sample) ||
    /\b(?:public|private|protected|readonly)\s+(?:static\s+|readonly\s+|abstract\s+|async\s+)*[\w$]+\s*[(:=?<]/.test(
      sample,
    ) ||
    /\bimplements\s+[A-Z]/.test(sample)
  if (strongTs) return "typescript"

  const jsBase =
    /(?:^|\n)\s*(?:import\s.+\sfrom\s|export\s|const\s|let\s|var\s|function\*?\s|class\s+\w|async\s+function)/.test(
      sample,
    ) || /=>\s*[{(]/.test(sample)
  if (jsBase) {
    const annotationTs =
      /:\s*(?:string|number|boolean|void|any|unknown|never|null|undefined|[A-Z]\w*)(?:\[\]|<[^>]+>)?\s*[=;,)\n]/.test(
        sample,
      ) || /\bas\s+(?:const|[A-Z]\w*)\b/.test(sample)
    return annotationTs ? "typescript" : "javascript"
  }

  // 6. A few high-signal Tier 2 languages (kept narrow to avoid false positives).
  if (/(?:^|\n)\s*(?:def\s+\w+\s*\(|class\s+\w+.*:|from\s+\w+\s+import\s|import\s+\w+)/.test(sample) && /:\s*(?:\n|$)/.test(sample)) {
    return "python"
  }
  if (/^#!.*\b(?:sh|bash|zsh)\b/.test(sample) || /(?:^|\n)\s*(?:echo|fi|then|elif|esac)\b/.test(sample)) {
    return "shell"
  }

  // 7. Markdown headings/blockquotes. Last, and intentionally NOT bullet/ordered
  // lists — those clash with YAML sequences (`- item`) and produce false
  // positives. Markdown is the default language anyway, so leaving an ambiguous
  // list-only paste as `null` keeps it on markdown without hijacking YAML/other.
  if (/(?:^|\n)#{1,6}\s+\S/.test(sample) || /(?:^|\n)>\s+\S/.test(sample)) {
    return "markdown"
  }

  return null
}
