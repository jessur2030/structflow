export type Language =
  | "markdown"
  | "text"
  | "typescript"
  | "javascript"
  | "json"
  | "html"
  | "css"
  | "sql"

export interface LanguageMeta {
  id: Language
  label: string
  hljs: string
  description: string
  ext: string
}

export const LANGUAGES: LanguageMeta[] = [
  {
    id: "markdown",
    label: "Markdown",
    hljs: "markdown",
    description: "Write notes and docs; normalize headings, lists, and fences.",
    ext: "md",
  },
  {
    id: "text",
    label: "Plain Text",
    hljs: "plaintext",
    description: "Freeform notes and scratch text — no formatting applied.",
    ext: "txt",
  },
  {
    id: "typescript",
    label: "TypeScript",
    hljs: "typescript",
    description: "Keep TS types and generics readable.",
    ext: "ts",
  },
  {
    id: "javascript",
    label: "JavaScript",
    hljs: "javascript",
    description: "Format modern JS with consistent spacing and quotes.",
    ext: "js",
  },
  { id: "json", label: "JSON", hljs: "json", description: "Pretty-print JSON objects and arrays.", ext: "json" },
  { id: "html", label: "HTML", hljs: "xml", description: "Beautify markup for templates and code blocks.", ext: "html" },
  { id: "css", label: "CSS", hljs: "css", description: "Format CSS and utility stacks.", ext: "css" },
  { id: "sql", label: "SQL", hljs: "sql", description: "Clean up SQL indentation and spacing.", ext: "sql" },
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
export const STRUCTFLOW_APP_VERSION = "1.1.1"
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
