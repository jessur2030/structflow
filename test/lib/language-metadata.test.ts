import { describe, it, expect } from "vitest"
import { LANGUAGES, type Language } from "@/lib/types"
import { loadLanguageSupport } from "@/lib/cm-languages"
import { highlightCode } from "@/lib/highlight"
import { mimeFor } from "@/lib/io"

// Guards the exhaustive per-language maps so adding a Language without wiring up
// its grammar / mime / highlight surfaces here instead of silently shipping broken.
describe("language metadata integrity", () => {
  it("every language has complete metadata", () => {
    for (const l of LANGUAGES) {
      expect(l.label, `${l.id} label`).toBeTruthy()
      expect(l.ext, `${l.id} ext`).toBeTruthy()
      expect(l.hljs, `${l.id} hljs`).toBeTruthy()
      expect(l.mime, `${l.id} mime`).toBeTruthy()
      expect(typeof l.formattable, `${l.id} formattable`).toBe("boolean")
    }
  })

  it("mimeFor resolves for every language", () => {
    for (const l of LANGUAGES) {
      expect(mimeFor(l.id), `${l.id} mime`).toBe(l.mime)
    }
  })

  it("loadLanguageSupport resolves for every language", async () => {
    for (const l of LANGUAGES) {
      await expect(loadLanguageSupport(l.id), `${l.id} grammar`).resolves.toBeDefined()
    }
  })

  it("read-only highlighting produces tokens for every non-text language", () => {
    const samples: Partial<Record<Language, string>> = {
      markdown: "# Hi",
      json: '{"a":1}',
      typescript: "const x: number = 1",
      javascript: "const x = 1",
      html: "<div>x</div>",
      css: ".a{color:red}",
      sql: "SELECT 1",
      yaml: "a: 1",
      python: "def f():\n  return 1",
      go: "package main",
      rust: "fn main() {}",
      java: "class A {}",
      cpp: "int main(){}",
      csharp: "class A {}",
      php: "<?php echo 1;",
      ruby: "def f; end",
      shell: "echo hi",
      toml: "a = 1",
      dockerfile: "FROM node",
      kotlin: "fun main() {}",
      swift: "let x = 1",
    }
    for (const l of LANGUAGES) {
      if (l.id === "text") continue
      const code = samples[l.id] ?? "sample"
      const root = highlightCode(code, l.hljs)
      // A registered grammar yields element nodes (spans); an unregistered one
      // would fall back to a single text node.
      const hasElements = JSON.stringify(root).includes('"element"')
      expect(hasElements, `${l.id} (hljs=${l.hljs}) should highlight`).toBe(true)
    }
  })
})
