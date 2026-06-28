import { describe, it, expect } from "vitest"
import { detectLanguage } from "@/lib/detect"

// Auto-detect is scoped to JSON + Markdown only; every other format returns
// `null` and is left to the language picker.
describe("detectLanguage", () => {
  it("detects JSON objects and arrays", () => {
    expect(detectLanguage('{"name":"struct","nested":{"a":1}}')).toBe("json")
    expect(detectLanguage("[1, 2, 3, 4, 5]")).toBe("json")
  })

  it("does not call a bare scalar JSON (ambiguous)", () => {
    expect(detectLanguage("42424242")).not.toBe("json")
    expect(detectLanguage('"just a quoted string"')).not.toBe("json")
  })

  it("detects Markdown from strong, code-rare markers", () => {
    expect(detectLanguage("See [the docs](https://example.com) for details.")).toBe("markdown")
    expect(detectLanguage("```js\nconst a = 1\n```")).toBe("markdown")
    expect(detectLanguage("| a | b |\n|---|---|\n| 1 | 2 |")).toBe("markdown")
    expect(detectLanguage("**The Concept:** a brief.\n\n**The Plan:** ship it soon.")).toBe(
      "markdown",
    )
  })

  it("detects Markdown from two or more weaker signals combined", () => {
    expect(detectLanguage("# Title\n\n- one\n- two\n")).toBe("markdown")
    expect(detectLanguage("1. **Blueprint**\n\n- _Vibe:_ professional\n- _Why:_ universal")).toBe(
      "markdown",
    )
  })

  it("does NOT auto-detect non-JSON/Markdown formats — the picker handles them", () => {
    expect(detectLanguage("<!doctype html><html><body><p>hi</p></body></html>")).toBeNull()
    expect(detectLanguage(".btn { color: red; padding: 4px; }")).toBeNull()
    expect(detectLanguage("SELECT id, name FROM users WHERE id = 1;")).toBeNull()
    expect(detectLanguage("interface User { id: number; name: string }")).toBeNull()
    expect(detectLanguage("function add(a, b) {\n  return a + b\n}")).toBeNull()
    expect(detectLanguage("def add(a, b):\n    return a + b\n")).toBeNull()
    expect(detectLanguage("#!/usr/bin/env bash\necho hello\n")).toBeNull()
  })

  it("does not mistake prose with code-ish words for a language", () => {
    expect(detectLanguage("Just a quick note about the meeting tomorrow.")).toBeNull()
    expect(
      detectLanguage("They publish those assets to a public storefront for free sharing."),
    ).toBeNull()
    expect(detectLanguage("Keep your private notes private until you decide to share.")).toBeNull()
  })

  it("returns null for short/ambiguous/binary input (the safety cases)", () => {
    expect(detectLanguage("red")).toBeNull()
    expect(detectLanguage("   \n  ")).toBeNull()
    expect(detectLanguage("color: red")).toBeNull()
    expect(detectLanguage("hello\x00world binary")).toBeNull()
  })

  it("does not call a lone bullet list or YAML sequence Markdown (single weak signal)", () => {
    expect(detectLanguage("foo: 1\nbar:\n  - a\n  - b\n")).toBeNull()
    expect(detectLanguage("- apples\n- bananas\n- cherries\n")).toBeNull()
  })

  it("does not call a lone code comment Markdown (heading look-alike)", () => {
    expect(detectLanguage("# parse the config\nimport os\nx = 1\ny = 2\n")).toBeNull()
  })

  it("does not hang on a huge unterminated bold opener (ReDoS guard)", () => {
    const evil = "**" + "a".repeat(65534)
    const start = performance.now()
    detectLanguage(evil)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it("handles large valid JSON without hanging", () => {
    const big = JSON.stringify({ items: Array.from({ length: 5000 }, (_, i) => ({ i, v: `x${i}` })) })
    expect(detectLanguage(big)).toBe("json")
  })
})
