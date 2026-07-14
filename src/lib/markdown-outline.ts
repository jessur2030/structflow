import type { Tokens } from "marked"

export type MarkdownToken = Tokens.Generic & Record<string, any>

export function stripMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, "")
}

function slugify(text: string): string {
  return (
    stripMarkup(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  )
}

/**
 * Assign de-duplicated anchor ids to the top-level heading tokens of a lex
 * pass. Ids must be computed once per token list, not during render: the
 * Contents outline and the rendered headings both derive from this map, and
 * deriving ids inside render passes drifts apart as soon as React re-renders
 * without re-lexing.
 */
export function computeHeadingIds(tokens: MarkdownToken[]): Map<MarkdownToken, string> {
  const counts = new Map<string, number>()
  const ids = new Map<MarkdownToken, string>()
  for (const token of tokens) {
    if (token.type !== "heading") continue
    const base = slugify(token.text ?? "")
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    ids.set(token, count === 0 ? base : `${base}-${count + 1}`)
  }
  return ids
}
