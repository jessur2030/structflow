import { describe, it, expect } from "vitest"
import { loadLanguageSupport } from "@/lib/cm-languages"
import { LANGUAGES, type Language } from "@/lib/types"

describe("loadLanguageSupport", () => {
  it("returns a grammar extension for every non-text language", async () => {
    const grammarLanguages = LANGUAGES.map((l) => l.id).filter((id) => id !== "text")
    for (const lang of grammarLanguages) {
      const support = await loadLanguageSupport(lang)
      expect(support, `expected a grammar for ${lang}`).toBeDefined()
      // LanguageSupport packs into a non-empty extension (object or array).
      expect(Array.isArray(support) && support.length === 0).toBe(false)
    }
  })

  it("returns an empty extension for plain text (no grammar)", async () => {
    const support = await loadLanguageSupport("text")
    expect(Array.isArray(support)).toBe(true)
    expect(support as unknown[]).toHaveLength(0)
  })

  it("covers every Language in the union (no missing case)", async () => {
    // If a new Language is added without a loader case, this exhaustiveness loop
    // surfaces it (the switch would fall through to undefined).
    const all: Language[] = LANGUAGES.map((l) => l.id)
    for (const lang of all) {
      await expect(loadLanguageSupport(lang)).resolves.toBeDefined()
    }
  })
})
