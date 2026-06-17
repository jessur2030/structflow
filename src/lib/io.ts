import { zipSync, strToU8 } from "fflate"
import type { Entry, Language, Project } from "./types"
import { getLanguage } from "./types"

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for restricted contexts.
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

/**
 * Bundle the given entries into a downloadable .zip, foldered by project.
 * Entries are written as `<Project>/<title>.<ext>`; ungrouped ones land in
 * `No project/`. A `manifest.json` records the full structured export.
 */
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

    // De-duplicate identical paths so nothing is silently overwritten.
    let path = `${base}.${ext}`
    let n = 2
    while (usedPaths.has(path)) {
      path = `${base}-${n}.${ext}`
      n++
    }
    usedPaths.add(path)
    files[path] = strToU8(entry.content)
  }

  const manifest = {
    app: "StructFlow",
    exportedAt: new Date().toISOString(),
    counts: { projects: projects.length, entries: entries.length },
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    entries: entries.map((e) => ({
      title: e.title,
      language: e.language,
      projectId: e.projectId ?? null,
      project: e.projectId ? (projectName.get(e.projectId) ?? null) : null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      content: e.content,
    })),
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files, { level: 6 })
  // Copy into a fresh ArrayBuffer so the Blob gets a clean, typed backing store.
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
