import { describe, it, expect } from "vitest"
import type { RootContent } from "hast"
import { highlightCode } from "@/lib/highlight"

/** Collect every `hljs-*` class name in a hast node list. */
function classesOf(nodes: RootContent[], acc = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.type === "element") {
      const className = node.properties?.className
      if (Array.isArray(className)) className.forEach((c) => acc.add(String(c)))
      classesOf(node.children, acc)
    }
  }
  return acc
}

/** Flatten a hast node list back to its plain text. */
function textOf(nodes: RootContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value
      if (node.type === "element") return textOf(node.children)
      return ""
    })
    .join("")
}

describe("highlightCode", () => {
  it("returns an empty tree for empty input", () => {
    expect(highlightCode("", "typescript").children).toEqual([])
  })

  it("tokenizes TypeScript into keyword/string/comment classes", () => {
    const code = 'import { x } from "y";\n// note\nfunction greet(name: string) { return name; }'
    const classes = classesOf(highlightCode(code, "typescript").children)
    expect(classes).toContain("hljs-keyword")
    expect(classes).toContain("hljs-string")
    expect(classes).toContain("hljs-comment")
    expect(classes).toContain("hljs-title")
  })

  it("tokenizes JSON keys and values", () => {
    const classes = classesOf(highlightCode('{"a": 1, "b": true}', "json").children)
    expect(classes).toContain("hljs-attr")
    expect(classes).toContain("hljs-number")
  })

  it("tokenizes CSS selectors and properties", () => {
    const classes = classesOf(highlightCode(".card { color: #fff; }", "css").children)
    expect(classes).toContain("hljs-selector-class")
    expect(classes).toContain("hljs-attribute")
  })

  it("resolves language aliases (ts -> typescript)", () => {
    const classes = classesOf(highlightCode("const x = 1", "ts").children)
    expect(classes).toContain("hljs-keyword")
  })

  it("falls back to a single plain-text node for unknown languages", () => {
    const tree = highlightCode("hello world", "brainfuck")
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toEqual({ type: "text", value: "hello world" })
  })

  it("preserves the original source text exactly", () => {
    const code = 'const s = "a < b && c > d";\nconst t = `x`;'
    expect(textOf(highlightCode(code, "typescript").children)).toBe(code)
  })
})
