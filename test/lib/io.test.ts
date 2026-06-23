import { describe, it, expect } from "vitest"
import { zipSync, strToU8 } from "fflate"
import { importEntriesFromFile, importFiles, languageFromFilename } from "@/lib/io"
import { DEFAULT_OPTIONS, STRUCTFLOW_SCHEMA_VERSION } from "@/lib/types"

/** Build a File whose webkitRelativePath is set (as the folder picker provides). */
function fileWithPath(relativePath: string, text: string): File {
  const name = relativePath.split("/").pop() ?? relativePath
  const file = new File([text], name, { type: "text/plain" })
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath })
  return file
}

// A minimal, valid StructFlow export manifest (what the "Export data" button writes).
function structflowManifest(overrides: Record<string, unknown> = {}) {
  return {
    app: "StructFlow",
    schemaVersion: STRUCTFLOW_SCHEMA_VERSION,
    appVersion: "1.0.0",
    exportedAt: new Date(0).toISOString(),
    counts: { projects: 1, entries: 1 },
    projects: [{ id: "p1", name: "Demo", color: "#3b82f6", createdAt: 1 }],
    entries: [
      {
        id: "e1",
        title: "snippet",
        language: "json",
        rawInput: '{"a":1}',
        formattedOutput: '{\n  "a": 1\n}',
        formatterVersion: "1",
        formatOptions: DEFAULT_OPTIONS,
        source: "manual",
        projectId: "p1",
        pinned: false,
        tags: ["x"],
        lastOpenedAt: null,
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    ...overrides,
  }
}

function zipFile(name: string, files: Record<string, string>): File {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
  )
  return new File([zipped], name, { type: "application/zip" })
}

function jsonFile(name: string, obj: unknown): File {
  return new File([JSON.stringify(obj)], name, { type: "application/json" })
}

describe("importEntriesFromFile — happy path (StructFlow export)", () => {
  it("imports a StructFlow .zip export and remaps ids", async () => {
    const file = zipFile("structflow-export.zip", {
      "manifest.json": JSON.stringify(structflowManifest()),
    })
    const { entries, projects } = await importEntriesFromFile(file)

    expect(projects).toHaveLength(1)
    expect(entries).toHaveLength(1)
    // ids are regenerated on import, but the project link is preserved
    expect(projects[0].id).not.toBe("p1")
    expect(entries[0].id).not.toBe("e1")
    expect(entries[0].projectId).toBe(projects[0].id)
    // imported entries are tagged with the "import" source
    expect(entries[0].source).toBe("import")
    expect(entries[0].title).toBe("snippet")
  })

  it("imports a bare manifest.json export", async () => {
    const file = jsonFile("manifest.json", structflowManifest())
    const { entries } = await importEntriesFromFile(file)
    expect(entries[0].rawInput).toBe('{"a":1}')
  })
})

describe("importEntriesFromFile — rejects non-StructFlow files", () => {
  it("reproduces the 'not a StructFlow export' error for a foreign manifest", async () => {
    // e.g. importing a browser extension manifest, or any other JSON
    const file = jsonFile("manifest.json", { name: "Some Extension", version: "1.0" })
    await expect(importEntriesFromFile(file)).rejects.toThrow(
      "Import manifest is not a StructFlow export.",
    )
  })

  it("rejects a zip with no manifest.json", async () => {
    const file = zipFile("notes.zip", { "readme.txt": "hello" })
    await expect(importEntriesFromFile(file)).rejects.toThrow(
      "Import ZIP is missing manifest.json.",
    )
  })

  it("rejects an unsupported schema version", async () => {
    const file = jsonFile("manifest.json", structflowManifest({ schemaVersion: 999 }))
    await expect(importEntriesFromFile(file)).rejects.toThrow(/Unsupported StructFlow schema version/)
  })
})

describe("languageFromFilename", () => {
  it("maps known extensions (incl. aliases) to languages", () => {
    expect(languageFromFilename("a.ts")).toBe("typescript")
    expect(languageFromFilename("a.tsx")).toBe("typescript")
    expect(languageFromFilename("a.mjs")).toBe("javascript")
    expect(languageFromFilename("data.json")).toBe("json")
    expect(languageFromFilename("notes.md")).toBe("markdown")
    expect(languageFromFilename("q.SQL")).toBe("sql")
    expect(languageFromFilename("styles.scss")).toBe("css")
  })

  it("defaults unknown or extensionless files to plain text", () => {
    expect(languageFromFilename("LICENSE")).toBe("text")
    expect(languageFromFilename("mystery.xyz")).toBe("text")
  })
})

describe("importFiles — restore path (single backup)", () => {
  it("still restores a StructFlow backup zip", async () => {
    const file = zipFile("backup.zip", { "manifest.json": JSON.stringify(structflowManifest()) })
    const { entries, projects } = await importFiles([file])
    expect(projects).toHaveLength(1)
    expect(entries[0].source).toBe("import")
  })
})

describe("importFiles — external content (the Obsidian/Postman-style import)", () => {
  it("imports loose files as one entry each, language by extension, no project", async () => {
    const files = [
      new File(['{"a":1}'], "config.json", { type: "application/json" }),
      new File(["const x = 1"], "script.ts", { type: "text/plain" }),
    ]
    const { entries, projects } = await importFiles(files)
    expect(projects).toHaveLength(0)
    expect(entries.map((e) => e.language).sort()).toEqual(["json", "typescript"])
    expect(entries.every((e) => e.projectId === null)).toBe(true)
    // title is the filename without extension; content preserved
    expect(entries.find((e) => e.language === "json")?.title).toBe("config")
    expect(entries.find((e) => e.language === "typescript")?.rawInput).toBe("const x = 1")
  })

  it("groups a picked folder into a project named after the top-level folder", async () => {
    const files = [
      fileWithPath("MyNotes/a.md", "# A"),
      fileWithPath("MyNotes/sub/b.sql", "select 1"),
    ]
    const { entries, projects } = await importFiles(files)
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe("MyNotes")
    expect(entries.every((e) => e.projectId === projects[0].id)).toBe(true)
  })

  it("imports a non-backup zip as files grouped under the zip name", async () => {
    const file = zipFile("snippets.zip", {
      "one.css": ".x{color:red}",
      "two.js": "var y = 2",
      ".DS_Store": "junk", // should be skipped
    })
    const { entries, projects } = await importFiles([file])
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe("snippets")
    expect(entries).toHaveLength(2) // .DS_Store skipped
    expect(entries.map((e) => e.language).sort()).toEqual(["css", "javascript"])
  })

  it("throws a clear error when nothing importable is found", async () => {
    const file = zipFile("empty.zip", { ".DS_Store": "junk" })
    await expect(importFiles([file])).rejects.toThrow(/No importable files/)
  })
})

describe("importFiles — guardrails (prevents reading huge folders into memory)", () => {
  it("skips files inside ignored directories (node_modules, .git, dist)", async () => {
    const files = [
      fileWithPath("proj/src/app.ts", "const a = 1"),
      fileWithPath("proj/node_modules/lib/index.js", "module.exports = {}"),
      fileWithPath("proj/.git/config", "[core]"),
      fileWithPath("proj/dist/bundle.js", "/* built */"),
    ]
    const { entries, skipped } = await importFiles(files)
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe("app")
    expect(skipped).toBe(3)
  })

  it("skips binary file types by extension before reading", async () => {
    const files = [
      new File(["readme"], "README.md", { type: "text/plain" }),
      new File(["PNG..."], "logo.png", { type: "image/png" }),
      new File(["..."], "font.woff2", { type: "font/woff2" }),
    ]
    const { entries, skipped } = await importFiles(files)
    expect(entries).toHaveLength(1)
    expect(entries[0].language).toBe("markdown")
    expect(skipped).toBe(2)
  })

  it("skips files larger than the per-file byte cap", async () => {
    const big = "x".repeat(600 * 1024) // > 512 KB
    const files = [
      new File([big], "huge.txt", { type: "text/plain" }),
      new File(["ok"], "small.txt", { type: "text/plain" }),
    ]
    const { entries, skipped } = await importFiles(files)
    expect(entries.map((e) => e.title)).toEqual(["small"])
    expect(skipped).toBe(1)
  })
})
