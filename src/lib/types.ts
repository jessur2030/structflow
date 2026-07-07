export type Language =
  // Tier 1 — format + highlight
  | "markdown"
  | "text"
  | "typescript"
  | "javascript"
  | "json"
  | "html"
  | "css"
  | "sql"
  | "yaml"
  // Tier 2 — highlight + store only (no formatter)
  | "python"
  | "go"
  | "rust"
  | "java"
  | "cpp"
  | "csharp"
  | "php"
  | "ruby"
  | "shell"
  | "toml"
  | "dockerfile"
  | "kotlin"
  | "swift"

export interface LanguageMeta {
  id: Language
  label: string
  /** highlight.js grammar name used for read-only views (preview, snapshot). */
  hljs: string
  description: string
  ext: string
  mime: string
  /** True when StructFlow can beautify it (Prettier/sql-formatter). Drives the Format button. */
  formattable: boolean
  /** Seeds the "Common" section of the language picker before any recents exist. */
  common?: boolean
}

export const LANGUAGES: LanguageMeta[] = [
  // ---- Tier 1: format + highlight ----
  {
    id: "markdown",
    label: "Markdown",
    hljs: "markdown",
    description: "Write notes and docs; normalize headings, lists, and fences.",
    ext: "md",
    mime: "text/markdown",
    formattable: true,
    common: true,
  },
  {
    id: "text",
    label: "Plain Text",
    hljs: "plaintext",
    description: "Freeform notes and scratch text - no formatting applied.",
    ext: "txt",
    mime: "text/plain",
    formattable: false,
    common: true,
  },
  {
    id: "typescript",
    label: "TypeScript",
    hljs: "typescript",
    description: "Keep TS types and generics readable.",
    ext: "ts",
    mime: "text/typescript",
    formattable: true,
    common: true,
  },
  {
    id: "javascript",
    label: "JavaScript",
    hljs: "javascript",
    description: "Format modern JS with consistent spacing and quotes.",
    ext: "js",
    mime: "text/javascript",
    formattable: true,
    common: true,
  },
  {
    id: "json",
    label: "JSON",
    hljs: "json",
    description: "Pretty-print JSON objects and arrays.",
    ext: "json",
    mime: "application/json",
    formattable: true,
    common: true,
  },
  {
    id: "html",
    label: "HTML",
    hljs: "xml",
    description: "Beautify markup for templates and code blocks.",
    ext: "html",
    mime: "text/html",
    formattable: true,
  },
  {
    id: "css",
    label: "CSS",
    hljs: "css",
    description: "Format CSS and utility stacks.",
    ext: "css",
    mime: "text/css",
    formattable: true,
  },
  {
    id: "sql",
    label: "SQL",
    hljs: "sql",
    description: "Clean up SQL indentation and spacing.",
    ext: "sql",
    mime: "application/sql",
    formattable: true,
  },
  {
    id: "yaml",
    label: "YAML",
    hljs: "yaml",
    description: "Format config and manifests with consistent indentation.",
    ext: "yaml",
    mime: "application/yaml",
    formattable: true,
  },
  // ---- Tier 2: highlight + store only ----
  {
    id: "python",
    label: "Python",
    hljs: "python",
    description: "Highlight and keep Python snippets.",
    ext: "py",
    mime: "text/x-python",
    formattable: false,
  },
  {
    id: "go",
    label: "Go",
    hljs: "go",
    description: "Highlight and keep Go snippets.",
    ext: "go",
    mime: "text/x-go",
    formattable: false,
  },
  {
    id: "rust",
    label: "Rust",
    hljs: "rust",
    description: "Highlight and keep Rust snippets.",
    ext: "rs",
    mime: "text/x-rust",
    formattable: false,
  },
  {
    id: "java",
    label: "Java",
    hljs: "java",
    description: "Highlight and keep Java snippets.",
    ext: "java",
    mime: "text/x-java",
    formattable: false,
  },
  {
    id: "cpp",
    label: "C / C++",
    hljs: "cpp",
    description: "Highlight and keep C and C++ snippets.",
    ext: "cpp",
    mime: "text/x-c++src",
    formattable: false,
  },
  {
    id: "csharp",
    label: "C#",
    hljs: "csharp",
    description: "Highlight and keep C# snippets.",
    ext: "cs",
    mime: "text/x-csharp",
    formattable: false,
  },
  {
    id: "php",
    label: "PHP",
    hljs: "php",
    description: "Highlight and keep PHP snippets.",
    ext: "php",
    mime: "application/x-php",
    formattable: false,
  },
  {
    id: "ruby",
    label: "Ruby",
    hljs: "ruby",
    description: "Highlight and keep Ruby snippets.",
    ext: "rb",
    mime: "text/x-ruby",
    formattable: false,
  },
  {
    id: "shell",
    label: "Shell",
    hljs: "bash",
    description: "Highlight and keep shell scripts.",
    ext: "sh",
    mime: "application/x-sh",
    formattable: false,
  },
  {
    id: "toml",
    label: "TOML",
    hljs: "ini",
    description: "Highlight and keep TOML config.",
    ext: "toml",
    mime: "application/toml",
    formattable: false,
  },
  {
    id: "dockerfile",
    label: "Dockerfile",
    hljs: "dockerfile",
    description: "Highlight and keep Dockerfiles.",
    ext: "dockerfile",
    mime: "text/x-dockerfile",
    formattable: false,
  },
  {
    id: "kotlin",
    label: "Kotlin",
    hljs: "kotlin",
    description: "Highlight and keep Kotlin snippets.",
    ext: "kt",
    mime: "text/x-kotlin",
    formattable: false,
  },
  {
    id: "swift",
    label: "Swift",
    hljs: "swift",
    description: "Highlight and keep Swift snippets.",
    ext: "swift",
    mime: "text/x-swift",
    formattable: false,
  },
]

export function getLanguage(id: Language): LanguageMeta {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]
}

export type IndentStyle = "2" | "4" | "tab" | "minify"

export interface FormatOptions {
  indent: IndentStyle
  printWidth: number
  singleQuote: boolean
  semi: boolean
  trailingComma: "none" | "es5" | "all"
  sortKeys: boolean
  sqlUppercase: boolean
}

export const DEFAULT_OPTIONS: FormatOptions = {
  indent: "2",
  printWidth: 80,
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  sortKeys: false,
  sqlUppercase: true,
}

export const STRUCTFLOW_SCHEMA_VERSION = 3
export const STRUCTFLOW_APP_VERSION = "1.5.3"
export const STRUCTFLOW_FORMATTER_VERSION = "2"

export type EntrySource = "manual" | "context-menu" | "library" | "import"

export interface Entry {
  id: string
  title: string
  language: Language
  rawInput: string
  formattedOutput: string
  formatterVersion: string
  formatOptions: FormatOptions
  source: EntrySource
  projectId: string | null
  pinned: boolean
  tags: string[]
  lastOpenedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  color: string
  createdAt: number
  /** Parent folder id; null/undefined means a top-level folder. */
  parentId?: string | null
}

/** Direct child folders of `parentId` (top-level folders when `parentId` is null). */
export function projectChildren(parentId: string | null, projects: Project[]): Project[] {
  return projects.filter((p) => (p.parentId ?? null) === parentId)
}

/** All descendant folder ids of `id` (children, grandchildren, …), excluding `id` itself. */
export function projectDescendantIds(id: string, projects: Project[]): string[] {
  const out: string[] = []
  // `seen` guards against a corrupt parentId cycle causing infinite recursion.
  const seen = new Set<string>([id])
  const walk = (parent: string) => {
    for (const p of projects) {
      if ((p.parentId ?? null) === parent && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p.id)
        walk(p.id)
      }
    }
  }
  walk(id)
  return out
}

/** Breadcrumb folder names from root down to `id`, e.g. ["Work", "SQL"]. */
export function projectPath(id: string | null, projects: Project[]): string[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const names: string[] = []
  const seen = new Set<string>()
  let current = id ? byId.get(id) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names
}

export interface StructFlowExportManifest {
  app: "StructFlow"
  schemaVersion: typeof STRUCTFLOW_SCHEMA_VERSION
  appVersion: string
  exportedAt: string
  counts: { projects: number; entries: number }
  projects: Project[]
  entries: Entry[]
}

export function entryContent(entry: Entry): string {
  return entry.formattedOutput || entry.rawInput
}

export const PROJECT_COLORS = [
  "oklch(0.65 0.16 256)", // blue
  "oklch(0.68 0.15 150)", // green
  "oklch(0.7 0.16 60)", // amber
  "oklch(0.65 0.2 25)", // red
  "oklch(0.68 0.13 300)", // magenta
  "oklch(0.7 0.13 190)", // teal
  "oklch(0.72 0.15 100)", // lime
  "oklch(0.66 0.14 330)", // pink
]
