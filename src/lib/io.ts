import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import {
  DEFAULT_OPTIONS,
  LANGUAGES,
  STRUCTFLOW_APP_VERSION,
  STRUCTFLOW_SCHEMA_VERSION,
  entryContent,
  getLanguage,
  type Entry,
  type EntrySource,
  type FormatOptions,
  type Language,
  type Project,
  type StructFlowExportManifest,
} from "./types"

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const MIME: Record<Language, string> = {
  markdown: "text/markdown",
  text: "text/plain",
  typescript: "text/typescript",
  javascript: "text/javascript",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  sql: "application/sql",
}

export function mimeFor(language: Language): string {
  return MIME[language] ?? "text/plain"
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled"
  )
}

export function exportEntriesAsZip(
  entries: Entry[],
  projects: Project[],
  filename = `structflow-export-${new Date().toISOString().slice(0, 10)}.zip`,
) {
  const projectName = new Map(projects.map((p) => [p.id, p.name]))
  const files: Record<string, Uint8Array> = {}
  const usedPaths = new Set<string>()

  for (const entry of entries) {
    const folder =
      entry.projectId && projectName.has(entry.projectId)
        ? sanitizeFolder(projectName.get(entry.projectId)!)
        : "No project"
    const ext = getLanguage(entry.language).ext
    const base = `${folder}/${slugify(entry.title)}`

    let path = `${base}.${ext}`
    let n = 2
    while (usedPaths.has(path)) {
      path = `${base}-${n}.${ext}`
      n++
    }
    usedPaths.add(path)
    files[path] = strToU8(entryContent(entry))
  }

  const manifest: StructFlowExportManifest = {
    app: "StructFlow",
    schemaVersion: STRUCTFLOW_SCHEMA_VERSION,
    appVersion: STRUCTFLOW_APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { projects: projects.length, entries: entries.length },
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, createdAt: p.createdAt })),
    entries: entries.map((e) => ({ ...e, projectId: e.projectId && projectName.has(e.projectId) ? e.projectId : null })),
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files, { level: 6 })
  const buffer = zipped.slice().buffer
  const blob = new Blob([buffer], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function sanitizeFolder(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled project"
}

export async function importEntriesFromFile(file: File): Promise<{ entries: Entry[]; projects: Project[] }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const manifestText =
    file.name.toLowerCase().endsWith(".json")
      ? new TextDecoder().decode(bytes)
      : readManifestFromZip(bytes)
  const manifest = validateManifest(JSON.parse(manifestText))
  return remapImportedData(manifest)
}

function readManifestFromZip(bytes: Uint8Array): string {
  const files = unzipSync(bytes)
  const manifest = files["manifest.json"]
  if (!manifest) throw new Error("Import ZIP is missing manifest.json.")
  return strFromU8(manifest)
}

function remapImportedData(manifest: StructFlowExportManifest): { entries: Entry[]; projects: Project[] } {
  const projectIds = new Map<string, string>()
  const projects = manifest.projects.map((project) => {
    const id = crypto.randomUUID()
    projectIds.set(project.id, id)
    return { ...project, id }
  })

  const entries = manifest.entries.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    projectId: entry.projectId ? (projectIds.get(entry.projectId) ?? null) : null,
    source: "import" as EntrySource,
  }))

  return { entries, projects }
}

function validateManifest(value: unknown): StructFlowExportManifest {
  if (!isRecord(value)) throw new Error("Import manifest must be an object.")
  if (value.app !== "StructFlow") throw new Error("Import manifest is not a StructFlow export.")
  if (value.schemaVersion !== STRUCTFLOW_SCHEMA_VERSION) {
    throw new Error(`Unsupported StructFlow schema version: ${String(value.schemaVersion)}.`)
  }
  if (!Array.isArray(value.projects)) throw new Error("Import manifest is missing projects.")
  if (!Array.isArray(value.entries)) throw new Error("Import manifest is missing entries.")

  const projects = value.projects.map(validateProject)
  const projectIds = new Set(projects.map((project) => project.id))
  const entries = value.entries.map((entry) => validateEntry(entry, projectIds))

  return {
    app: "StructFlow",
    schemaVersion: STRUCTFLOW_SCHEMA_VERSION,
    appVersion: typeof value.appVersion === "string" ? value.appVersion : "unknown",
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
    counts: { projects: projects.length, entries: entries.length },
    projects,
    entries,
  }
}

function validateProject(value: unknown): Project {
  if (!isRecord(value)) throw new Error("Imported project must be an object.")
  return {
    id: requireString(value.id, "project.id"),
    name: requireString(value.name, "project.name"),
    color: requireString(value.color, "project.color"),
    createdAt: requireNumber(value.createdAt, "project.createdAt"),
  }
}

function validateEntry(value: unknown, projectIds: Set<string>): Entry {
  if (!isRecord(value)) throw new Error("Imported entry must be an object.")
  const language = validateLanguage(value.language)
  const projectId = value.projectId == null ? null : requireString(value.projectId, "entry.projectId")
  return {
    id: requireString(value.id, "entry.id"),
    title: requireString(value.title, "entry.title"),
    language,
    rawInput: requireString(value.rawInput, "entry.rawInput"),
    formattedOutput: requireString(value.formattedOutput, "entry.formattedOutput"),
    formatterVersion: requireString(value.formatterVersion, "entry.formatterVersion"),
    formatOptions: validateFormatOptions(value.formatOptions),
    source: validateSource(value.source),
    projectId: projectId && projectIds.has(projectId) ? projectId : null,
    createdAt: requireNumber(value.createdAt, "entry.createdAt"),
    updatedAt: requireNumber(value.updatedAt, "entry.updatedAt"),
  }
}

function validateFormatOptions(value: unknown): FormatOptions {
  if (!isRecord(value)) return DEFAULT_OPTIONS
  return {
    indent: value.indent === "2" || value.indent === "4" || value.indent === "tab" || value.indent === "minify" ? value.indent : DEFAULT_OPTIONS.indent,
    printWidth: typeof value.printWidth === "number" ? value.printWidth : DEFAULT_OPTIONS.printWidth,
    singleQuote: typeof value.singleQuote === "boolean" ? value.singleQuote : DEFAULT_OPTIONS.singleQuote,
    semi: typeof value.semi === "boolean" ? value.semi : DEFAULT_OPTIONS.semi,
    trailingComma: value.trailingComma === "none" || value.trailingComma === "es5" || value.trailingComma === "all" ? value.trailingComma : DEFAULT_OPTIONS.trailingComma,
    sortKeys: typeof value.sortKeys === "boolean" ? value.sortKeys : DEFAULT_OPTIONS.sortKeys,
    sqlUppercase: typeof value.sqlUppercase === "boolean" ? value.sqlUppercase : DEFAULT_OPTIONS.sqlUppercase,
  }
}

function validateLanguage(value: unknown): Language {
  if (typeof value === "string" && LANGUAGES.some((language) => language.id === value)) {
    return value as Language
  }
  throw new Error(`Unsupported entry language: ${String(value)}.`)
}

function validateSource(value: unknown): EntrySource {
  if (value === "manual" || value === "context-menu" || value === "library" || value === "import") return value
  return "import"
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}; expected string.`)
  return value
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${label}; expected number.`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}
