import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import {
  DEFAULT_OPTIONS,
  LANGUAGES,
  PROJECT_COLORS,
  STRUCTFLOW_APP_VERSION,
  STRUCTFLOW_SCHEMA_VERSION,
  entryContent,
  getLanguage,
  projectPath,
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
      // execCommand("copy") is deprecated but is still the only fallback when the
      // async Clipboard API is unavailable (e.g. the document isn't focused). It
      // works in all current browsers; the cast keeps the deprecation hint from
      // leaking out of this intentional fallback.
      ;(document as { execCommand(commandId: string): boolean }).execCommand("copy")
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

export function mimeFor(language: Language): string {
  return getLanguage(language).mime ?? "text/plain"
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
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const files: Record<string, Uint8Array> = {}
  const usedPaths = new Set<string>()

  for (const entry of entries) {
    const folder =
      entry.projectId && projectById.has(entry.projectId)
        ? projectPath(entry.projectId, projects).map(sanitizeFolder).join("/")
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
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, createdAt: p.createdAt, parentId: p.parentId ?? null })),
    entries: entries.map((e) => ({ ...e, projectId: e.projectId && projectById.has(e.projectId) ? e.projectId : null })),
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

// ─── External-file import ────────────────────────────────────────────────────
// "Import" accepts more than StructFlow's own backups: loose code/text files, a
// whole folder, or a zip of files. Each file becomes one library entry, with its
// language guessed from the extension; folders become projects.

const EXT_TO_LANGUAGE: Record<string, Language> = {
  md: "markdown", markdown: "markdown", mdown: "markdown", mkd: "markdown",
  txt: "text", text: "text", log: "text",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", jsonc: "json", json5: "json",
  html: "html", htm: "html", xhtml: "html", xml: "html", svg: "html", vue: "html",
  css: "css", scss: "css", sass: "css", less: "css",
  sql: "sql",
  yaml: "yaml", yml: "yaml",
  py: "python", pyw: "python",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp", cc: "cpp", cxx: "cpp", "c++": "cpp", c: "cpp", h: "cpp", hpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  sh: "shell", bash: "shell", zsh: "shell",
  toml: "toml",
  dockerfile: "dockerfile",
  kt: "kotlin", kts: "kotlin",
  swift: "swift",
}

/** Best-effort language guess from a file name's extension (defaults to plain text). */
export function languageFromFilename(name: string): Language {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  return EXT_TO_LANGUAGE[ext] ?? "text"
}

interface ImportedFile {
  /** Path relative to the import root; may include "/" for files inside folders/zips. */
  path: string
  text: string
}

// Guardrails so importing a real folder/zip (which can contain node_modules,
// build output, images, etc.) can't read gigabytes into memory and crash the tab.
const MAX_IMPORT_FILES = 1000
const MAX_FILE_BYTES = 512 * 1024 // 512 KB per file
const MAX_TOTAL_BYTES = 32 * 1024 * 1024 // 32 MB across the whole import

/** Directory names that are never worth importing; matched against any path segment. */
const IGNORED_DIR_SEGMENTS = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", "out", "target",
  ".next", ".nuxt", ".cache", ".turbo", ".parcel-cache", "coverage", "vendor",
  "__pycache__", ".venv", "venv", ".idea", ".vscode", ".gradle", "bin", "obj",
])

/** File extensions that are binary; skipped before we ever read them. */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "tif", "tiff", "avif",
  "woff", "woff2", "ttf", "otf", "eot",
  "zip", "gz", "tar", "rar", "7z", "bz2", "xz", "tgz",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "mp3", "wav", "ogg", "flac", "m4a", "aac",
  "mp4", "mov", "avi", "mkv", "webm",
  "wasm", "exe", "dll", "so", "dylib", "bin", "dat", "class", "node",
  "db", "sqlite", "sqlite3", "psd", "sketch", "fig",
])

function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_DIR_SEGMENTS.has(segment))
}

function hasBinaryExtension(name: string): boolean {
  return BINARY_EXTENSIONS.has(name.toLowerCase().split(".").pop() ?? "")
}

/** Cheap pre-read filter using path + size only (no file content loaded yet). */
function isImportableCandidate(path: string, name: string, byteLength: number): boolean {
  if (isJunkFile(name)) return false
  if (isIgnoredPath(path)) return false
  if (hasBinaryExtension(name)) return false
  if (byteLength > MAX_FILE_BYTES) return false
  return true
}

/**
 * Import one or more files into the library.
 *  - A single StructFlow backup (.zip or manifest .json) restores entries + projects.
 *  - Anything else is ingested as external content: one entry per file, language
 *    guessed from the extension, with folders (from a picked directory or inside a
 *    zip) turned into projects. Unknown/binary files are skipped.
 */
export async function importFiles(
  files: File[],
): Promise<{ entries: Entry[]; projects: Project[]; skipped: number }> {
  if (files.length === 0) return { entries: [], projects: [], skipped: 0 }

  // 1) A single file might be a StructFlow backup → restore it.
  if (files.length === 1) {
    const backup = await tryReadBackup(files[0])
    if (backup) return { ...remapImportedData(backup), skipped: 0 }

    // A non-backup .zip is treated as a zip-of-files (grouped under the zip name).
    if (files[0].name.toLowerCase().endsWith(".zip")) {
      const { imported, skipped } = await readZipFiles(files[0])
      if (imported.length === 0) throw new Error("No importable files found in that zip.")
      return { ...buildLibraryFromFiles(imported, stripExtension(files[0].name)), skipped }
    }
  }

  // 2) Loose files or a picked folder (webkitRelativePath carries the folder path).
  const imported: ImportedFile[] = []
  let skipped = 0
  let totalBytes = 0
  for (const file of files) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    if (
      imported.length >= MAX_IMPORT_FILES ||
      totalBytes >= MAX_TOTAL_BYTES ||
      !isImportableCandidate(path, file.name, file.size)
    ) {
      skipped++
      continue
    }
    const text = await readFileText(file)
    if (looksBinary(text)) {
      skipped++
      continue
    }
    imported.push({ path, text })
    totalBytes += file.size
  }
  if (imported.length === 0) throw new Error("No importable text files were found.")
  return { ...buildLibraryFromFiles(imported), skipped }
}

/**
 * Import a directory chosen via the File System Access API (`showDirectoryPicker`).
 * Walks lazily and skips ignored directories (node_modules, .git, …) *before*
 * descending, so a huge folder never balloons into one giant FileList the way the
 * `webkitdirectory` <input> does. Same filters/limits as `importFiles`.
 */
export async function importDirectoryHandle(
  dir: FileSystemDirectoryHandle,
): Promise<{ entries: Entry[]; projects: Project[]; skipped: number }> {
  const imported: ImportedFile[] = []
  let skipped = 0
  let totalBytes = 0

  // `entries()` (async iterator) isn't in this TS lib's DOM types yet; type it locally.
  type DirEntries = {
    entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
  }

  const walk = async (handle: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const [name, child] of (handle as unknown as DirEntries).entries()) {
      if (imported.length >= MAX_IMPORT_FILES || totalBytes >= MAX_TOTAL_BYTES) break
      const path = prefix ? `${prefix}/${name}` : name
      if (child.kind === "directory") {
        if (!IGNORED_DIR_SEGMENTS.has(name)) await walk(child, path)
        continue
      }
      const file = await child.getFile()
      if (!isImportableCandidate(path, name, file.size)) {
        skipped++
        continue
      }
      const text = await readFileText(file)
      if (looksBinary(text)) {
        skipped++
        continue
      }
      imported.push({ path, text })
      totalBytes += file.size
    }
  }

  // Prefix with the picked folder's name so it becomes the root project, matching
  // the webkitdirectory path shape (e.g. "migration-jlarc/01_compliance.sql").
  await walk(dir, dir.name)
  if (imported.length === 0) throw new Error("No importable text files were found.")
  return { ...buildLibraryFromFiles(imported), skipped }
}

/** Parse a file as a StructFlow backup, or return null if it isn't one. */
async function tryReadBackup(file: File): Promise<StructFlowExportManifest | null> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith(".zip")) {
    let zipFiles: Record<string, Uint8Array>
    try {
      zipFiles = unzipSync(new Uint8Array(await file.arrayBuffer()))
    } catch {
      return null
    }
    const manifest = zipFiles["manifest.json"]
    if (!manifest) return null
    const parsed = safeJsonParse(strFromU8(manifest))
    if (!looksLikeBackup(parsed)) return null
    return validateManifest(parsed) // committed: surfaces schema/shape errors
  }

  if (lower.endsWith(".json")) {
    const parsed = safeJsonParse(await readFileText(file))
    if (!looksLikeBackup(parsed)) return null
    return validateManifest(parsed)
  }

  return null
}

async function readZipFiles(file: File): Promise<{ imported: ImportedFile[]; skipped: number }> {
  const zipFiles = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const imported: ImportedFile[] = []
  let skipped = 0
  let totalBytes = 0
  for (const [path, bytes] of Object.entries(zipFiles)) {
    if (path.endsWith("/")) continue // directory entry
    const name = path.split("/").pop() ?? path
    if (
      imported.length >= MAX_IMPORT_FILES ||
      totalBytes >= MAX_TOTAL_BYTES ||
      !isImportableCandidate(path, name, bytes.length)
    ) {
      skipped++
      continue
    }
    const text = strFromU8(bytes)
    if (looksBinary(text)) {
      skipped++
      continue
    }
    imported.push({ path, text })
    totalBytes += bytes.length
  }
  return { imported, skipped }
}

/**
 * Turn imported files into entries + projects. A file's top-level folder segment
 * becomes its project; bare files use `defaultProjectName` (e.g. the zip name) if
 * given, otherwise they land with no project.
 */
function buildLibraryFromFiles(
  files: ImportedFile[],
  defaultProjectName?: string,
): { entries: Entry[]; projects: Project[] } {
  // Each directory level becomes a nested project (parentId chain), keyed by its
  // full path so "Work/SQL" and "Work/JS" share the same "Work" parent.
  const projectsByPath = new Map<string, Project>()
  const ensureFolderPath = (segments: string[]): string | null => {
    let parentId: string | null = null
    let pathKey = ""
    for (const name of segments) {
      pathKey = pathKey ? `${pathKey}/${name}` : name
      let project = projectsByPath.get(pathKey)
      if (!project) {
        project = {
          id: crypto.randomUUID(),
          name,
          color: PROJECT_COLORS[projectsByPath.size % PROJECT_COLORS.length],
          createdAt: Date.now(),
          parentId,
        }
        projectsByPath.set(pathKey, project)
      }
      parentId = project.id
    }
    return parentId
  }

  const entries = files.map((file) => {
    const segments = file.path.split("/").filter(Boolean)
    const filename = segments.pop() ?? file.path
    // A zip import nests everything under the zip name; a folder import already
    // carries its root folder in the path; loose files have no folder at all.
    const folderSegments = defaultProjectName ? [defaultProjectName, ...segments] : segments
    const projectId = folderSegments.length ? ensureFolderPath(folderSegments) : null
    return entryFromImportedFile(filename, file.text, projectId)
  })

  return { entries, projects: [...projectsByPath.values()] }
}

function entryFromImportedFile(filename: string, text: string, projectId: string | null): Entry {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: stripExtension(filename),
    language: languageFromFilename(filename),
    rawInput: text,
    formattedOutput: text,
    formatterVersion: STRUCTFLOW_APP_VERSION,
    formatOptions: DEFAULT_OPTIONS,
    source: "import",
    projectId,
    pinned: false,
    tags: [],
    lastOpenedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function looksLikeBackup(value: unknown): boolean {
  return isRecord(value) && value.app === "StructFlow"
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readFileText(file: File): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()))
}

function stripExtension(name: string): string {
  const base = name.split("/").pop() ?? name
  return base.replace(/\.[^.]+$/, "").trim() || base
}

function isJunkFile(name: string): boolean {
  return name === ".DS_Store" || name === "Thumbs.db" || name.startsWith("._") || name.startsWith(".git")
}

/** Heuristic: text with a NUL byte is almost certainly binary. */
function looksBinary(text: string): boolean {
  return /\x00/.test(text)
}

function remapImportedData(manifest: StructFlowExportManifest): { entries: Entry[]; projects: Project[] } {
  const projectIds = new Map<string, string>()
  const projects = manifest.projects.map((project) => {
    const id = crypto.randomUUID()
    projectIds.set(project.id, id)
    return { ...project, id }
  })
  // Second pass: re-point each folder's parentId to the regenerated parent id so
  // the nested structure survives the re-id.
  for (const project of projects) {
    if (project.parentId) project.parentId = projectIds.get(project.parentId) ?? null
  }

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
    parentId: typeof value.parentId === "string" ? value.parentId : null,
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
    pinned: typeof value.pinned === "boolean" ? value.pinned : false,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
    lastOpenedAt: typeof value.lastOpenedAt === "number" && Number.isFinite(value.lastOpenedAt) ? value.lastOpenedAt : null,
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
