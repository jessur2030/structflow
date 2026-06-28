import { describe, it, expect } from "vitest"
import { detectLanguage } from "@/lib/detect"

describe("detectLanguage", () => {
  it("detects JSON objects and arrays", () => {
    expect(detectLanguage('{"name":"struct","nested":{"a":1}}')).toBe("json")
    expect(detectLanguage("[1, 2, 3, 4, 5]")).toBe("json")
  })

  it("does not call a bare scalar JSON (ambiguous)", () => {
    expect(detectLanguage("42424242")).not.toBe("json")
    expect(detectLanguage('"just a quoted string"')).not.toBe("json")
  })

  it("detects HTML", () => {
    expect(detectLanguage("<!doctype html><html><body><p>hi</p></body></html>")).toBe("html")
    expect(detectLanguage('<div class="x"><span>a</span></div>')).toBe("html")
  })

  it("detects CSS", () => {
    expect(detectLanguage(".btn { color: red; padding: 4px; }")).toBe("css")
    expect(detectLanguage("@media (min-width: 600px) { .x { color: red; } }")).toBe("css")
  })

  it("detects SQL", () => {
    expect(detectLanguage("SELECT id, name FROM users WHERE id = 1;")).toBe("sql")
    expect(detectLanguage("INSERT INTO users (id, name) VALUES (1, 'a');")).toBe("sql")
    expect(detectLanguage("CREATE TABLE t (id INT) ; SELECT * FROM t;")).toBe("sql")
  })

  it("detects TypeScript via type signals", () => {
    expect(detectLanguage("interface User { id: number; name: string }")).toBe("typescript")
    expect(detectLanguage("const x: number = 5\nexport const y = 1")).toBe("typescript")
    expect(detectLanguage("enum Color { Red, Green }\nexport default Color")).toBe("typescript")
  })

  it("detects JavaScript when no type signals are present", () => {
    expect(detectLanguage("function add(a, b) {\n  return a + b\n}")).toBe("javascript")
    expect(detectLanguage("export const f = () => {\n  return 1\n}")).toBe("javascript")
  })

  it("detects a few high-signal Tier 2 languages", () => {
    expect(detectLanguage("def add(a, b):\n    return a + b\n")).toBe("python")
    expect(detectLanguage("#!/usr/bin/env bash\necho hello\n")).toBe("shell")
  })

  it("detects Markdown only on real markers", () => {
    expect(detectLanguage("# Title\n\n- one\n- two\n")).toBe("markdown")
    expect(detectLanguage("See [the docs](https://example.com) for details.")).toBe("markdown")
    expect(detectLanguage("```js\nconst a = 1\n```")).toBe("markdown")
  })

  it("returns null for plain prose and ambiguous/short input (the safety cases)", () => {
    expect(detectLanguage("Just a quick note about the meeting tomorrow.")).toBeNull()
    expect(detectLanguage("Update the config and select a theme you like.")).toBeNull()
    expect(detectLanguage("red")).toBeNull()
    expect(detectLanguage("   \n  ")).toBeNull()
    expect(detectLanguage("color: red")).toBeNull()
    expect(detectLanguage("hello\x00world binary")).toBeNull()
  })

  it("does not call YAML-style sequences Markdown (no list-marker false positive)", () => {
    expect(detectLanguage("foo: 1\nbar:\n  - a\n  - b\n")).toBeNull()
    expect(detectLanguage("- apples\n- bananas\n- cherries\n")).toBeNull()
  })

  it("does not mistake prose with the word 'public'/'private' for TypeScript", () => {
    expect(
      detectLanguage("They publish those assets to a public storefront for free sharing."),
    ).not.toBe("typescript")
    expect(detectLanguage("Keep your private notes private until you decide to share.")).not.toBe(
      "typescript",
    )
  })

  it("still detects TypeScript access modifiers in real member syntax", () => {
    expect(detectLanguage("class A {\n  private readonly id: number = 1\n}")).toBe("typescript")
    expect(detectLanguage("class S {\n  public static getInstance() {}\n}")).toBe("typescript")
  })

  it("detects Markdown from rich prose (bold spans, mixed list markers)", () => {
    expect(detectLanguage("**The Concept:** a brief.\n\n**The Plan:** ship it soon.")).toBe(
      "markdown",
    )
    expect(detectLanguage("1. **Blueprint**\n\n- _Vibe:_ professional\n- _Why:_ universal")).toBe(
      "markdown",
    )
  })

  it("handles large valid JSON without hanging", () => {
    const big = JSON.stringify({ items: Array.from({ length: 5000 }, (_, i) => ({ i, v: `x${i}` })) })
    expect(detectLanguage(big)).toBe("json")
  })
})
