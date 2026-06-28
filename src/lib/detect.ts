import { validate } from "./formatter"
import type { Language } from "./types"

/**
 * Detect a pasted buffer's language. Scoped to JSON + Markdown (the high-
 * confidence cases that unlock the tree/preview); everything else returns `null`
 * and is left to the language picker. `null` keeps the current language.
 */
export function detectLanguage(text: string): Language | null {
  const trimmed = text.trim()
  if (trimmed.length < 8) return null // too short to be confident
  if (/\x00/.test(text)) return null // binary

  // Bound regex cost on huge pastes; structural signal lives near the top anyway.
  const sample = text.length > 65536 ? text.slice(0, 65536) : text

  // JSON — most reliable: real parse + object/array shape.
  if ((trimmed[0] === "{" || trimmed[0] === "[") && validate("json", text).ok) {
    return "json"
  }

  // Strong, code-rare Markdown: fenced block, link, GFM table, or 2+ bold spans.
  // The bold regex is linear-time (single consuming run + letter lookahead) so a
  // huge unterminated `**` can't backtrack catastrophically, and `**3**` / `a**b`
  // don't count.
  const boldSpans = sample.match(/\*\*(?=[^*\n]*[A-Za-z])(?=\S)[^*\n]+\*\*/g)?.length ?? 0
  if (
    /(?:^|\n)\s*(?:```|~~~)/.test(sample) ||
    /\[[^\]]+\]\([^)]+\)/.test(sample) ||
    /(?:^|\n)\|.+\|.*\n\|[\s:|-]+\|/.test(sample) ||
    boldSpans >= 2
  ) {
    return "markdown"
  }

  // Weaker, ambiguous markers, each a false positive alone (`#`/`>` start code
  // comments; `- a` is a YAML sequence). Require 2+ distinct kinds together.
  let mdSignals = 0
  if (/(?:^|\n)#{1,6}\s+\S/.test(sample)) mdSignals++ // heading
  if (/(?:^|\n)\s*>\s+\S/.test(sample)) mdSignals++ // blockquote
  if (/(?:^|\n)[ \t]*[-*+][ \t]+\S/.test(sample)) mdSignals++ // bullet list
  if (/(?:^|\n)[ \t]*\d+[.)][ \t]+\S/.test(sample)) mdSignals++ // ordered list
  if (boldSpans >= 1) mdSignals++ // a bold span
  if (/(?:^|\s)_(?=\S)[^_\n]+?_(?=\s|[.,:;!?)]|$)/.test(sample)) mdSignals++ // emphasis
  if (mdSignals >= 2) return "markdown"

  return null
}
