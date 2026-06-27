import { LanguageSupport, StreamLanguage } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import type { Language } from "@/lib/types"

/**
 * Lazily loads the CodeMirror grammar for a StructFlow language. Each grammar is
 * a dynamic import so Rollup code-splits it into its own chunk — only the grammar
 * a user actually selects is fetched. Tier 1 + the dedicated Lezer packages give
 * the best highlighting; Tier 2 languages without a Lezer package use
 * `@codemirror/legacy-modes` StreamLanguage modes (still tag-compatible with our
 * `synHighlightStyle`). Plain text has no grammar (returns `[]`).
 *
 * Callers should guard against out-of-order resolution (rapid language switches)
 * by tracking the latest requested language and ignoring stale results.
 */
export async function loadLanguageSupport(lang: Language): Promise<Extension> {
  switch (lang) {
    // ---- Tier 1 + dedicated Lezer packages ----
    case "json":
      return (await import("@codemirror/lang-json")).json()
    case "javascript":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true })
    case "typescript":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true })
    case "html":
      return (await import("@codemirror/lang-html")).html()
    case "css":
      return (await import("@codemirror/lang-css")).css()
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown()
    case "sql":
      return (await import("@codemirror/lang-sql")).sql()
    case "yaml":
      return (await import("@codemirror/lang-yaml")).yaml()
    case "python":
      return (await import("@codemirror/lang-python")).python()
    case "rust":
      return (await import("@codemirror/lang-rust")).rust()
    case "java":
      return (await import("@codemirror/lang-java")).java()
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cpp()
    case "php":
      return (await import("@codemirror/lang-php")).php()

    // ---- Tier 2 via legacy StreamLanguage modes ----
    case "go":
      return legacy((await import("@codemirror/legacy-modes/mode/go")).go)
    case "ruby":
      return legacy((await import("@codemirror/legacy-modes/mode/ruby")).ruby)
    case "shell":
      return legacy((await import("@codemirror/legacy-modes/mode/shell")).shell)
    case "toml":
      return legacy((await import("@codemirror/legacy-modes/mode/toml")).toml)
    case "dockerfile":
      return legacy((await import("@codemirror/legacy-modes/mode/dockerfile")).dockerFile)
    case "swift":
      return legacy((await import("@codemirror/legacy-modes/mode/swift")).swift)
    case "csharp":
      return legacy((await import("@codemirror/legacy-modes/mode/clike")).csharp)
    case "kotlin":
      return legacy((await import("@codemirror/legacy-modes/mode/clike")).kotlin)

    case "text":
      return []
  }
}

function legacy(parser: Parameters<typeof StreamLanguage.define>[0]): Extension {
  return new LanguageSupport(StreamLanguage.define(parser))
}
