import { describe, it, expect } from "vitest"
import { marked } from "marked"
import { computeHeadingIds, stripMarkup, type MarkdownToken } from "@/lib/markdown-outline"

function lex(source: string): MarkdownToken[] {
  return marked.lexer(source, { gfm: true }) as MarkdownToken[]
}

describe("computeHeadingIds", () => {
  it("slugs headings and skips non-heading tokens", () => {
    const tokens = lex("# Release Notes\n\nsome text\n\n## Best Practices & FAQ\n")
    const ids = [...computeHeadingIds(tokens).values()]
    expect(ids).toEqual(["release-notes", "best-practices-faq"])
  })

  it("de-duplicates repeated heading slugs in document order", () => {
    const tokens = lex("## Setup\n\n## Setup\n\n## Setup\n")
    const ids = [...computeHeadingIds(tokens).values()]
    expect(ids).toEqual(["setup", "setup-2", "setup-3"])
  })

  it("is pure: repeated calls over the same tokens yield identical ids", () => {
    // Regression: ids used to be derived from a map mutated during React
    // render passes, so every re-render without a re-lex shifted the ids
    // (summary -> summary-2 -> ...) and broke the Contents links.
    const tokens = lex("# Doc\n\n## Summary\n\n## Summary\n")
    const first = [...computeHeadingIds(tokens).values()]
    const second = [...computeHeadingIds(tokens).values()]
    expect(second).toEqual(first)
  })

  it("keys ids by token so duplicate slugs across depths stay aligned", () => {
    const tokens = lex("#### Setup\n\n## Setup\n")
    const ids = computeHeadingIds(tokens)
    const headings = tokens.filter((t) => t.type === "heading")
    expect(ids.get(headings[0])).toBe("setup")
    expect(ids.get(headings[1])).toBe("setup-2")
  })

  it("falls back to 'section' for headings that slug to nothing", () => {
    const tokens = lex("## ---\n")
    expect([...computeHeadingIds(tokens).values()]).toEqual(["section"])
  })
})

describe("stripMarkup", () => {
  it("removes inline HTML tags", () => {
    expect(stripMarkup("Hello <em>world</em>")).toBe("Hello world")
  })
})
