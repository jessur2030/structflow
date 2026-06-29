import { useCallback, useEffect, useState } from "react"
import { Wand2, Library as LibraryIcon, FolderInput } from "lucide-react"
import logo from "./assets/logo.png"
import { Formatter, type SaveEntryPayload } from "./components/formatter"
import { Library, ModalButton } from "./components/library"
import { Modal } from "./components/modal"
import { SupportButton } from "./components/support-button"
import { SettingsButton } from "./components/settings-button"
import { SettingsView } from "./components/settings-view"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select"
import { useTheme } from "./lib/use-theme"
import { useSyntaxTheme } from "./lib/use-syntax-theme"
import {
  clearAll,
  deleteEntry,
  deleteProject,
  getAllEntries,
  getAllProjects,
  moveEntry,
  saveEntry,
  saveEntries,
  saveProject,
  saveProjects,
  uid,
} from "./lib/storage"
import {
  DEFAULT_OPTIONS,
  LANGUAGES,
  PROJECT_COLORS,
  STRUCTFLOW_FORMATTER_VERSION,
  projectPath,
  type Entry,
  type EntrySource,
  type Language,
  type Project,
} from "./lib/types"
import { cn } from "./lib/utils"

type Tab = "format" | "library"
const DRAFT_KEY = "structflow_formatter_draft"
const DEFAULT_LANG_KEY = "structflow_default_language"

interface FormatterDraft {
  language: Language
  input: string
}

function loadDefaultLanguage(): Language {
  try {
    const v = localStorage.getItem(DEFAULT_LANG_KEY)
    if (isLanguage(v)) return v
  } catch {
  }
  return "markdown"
}

function loadDraft(): FormatterDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.input === "string" &&
      isLanguage(parsed.language)
    ) {
      return { language: parsed.language, input: parsed.input }
    }
  } catch {
  }
  return { language: loadDefaultLanguage(), input: "" }
}

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.some((language) => language.id === value)
}

export default function App() {
  const { mode, setMode } = useTheme()
  const { syntaxThemeId, setSyntaxTheme } = useSyntaxTheme()
  const [initialDraft] = useState(loadDraft)
  const [tab, setTab] = useState<Tab>("format")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(loadDefaultLanguage)

  const [language, setLanguage] = useState<Language>(initialDraft.language)
  const [input, setInput] = useState(initialDraft.input)
  const [inputSource, setInputSource] = useState<EntrySource>("manual")

  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState("")
  const [savePayload, setSavePayload] = useState<SaveEntryPayload | null>(null)
  const [saveProjectId, setSaveProjectId] = useState<string | null>(null)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [e, p] = await Promise.all([getAllEntries(), getAllProjects()])
    setEntries(e)
    setProjects(p)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ language, input }))
    } catch {
    }
  }, [language, input])

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return
    chrome.storage.local.get("structflow_incoming", (res) => {
      const incoming = res?.structflow_incoming
      if (typeof incoming === "string" && incoming) {
        setInput(incoming)
        setInputSource("context-menu")
        setTab("format")
        chrome.storage.local.remove("structflow_incoming")
      }
    })
  }, [])

  const requestSave = (payload: SaveEntryPayload) => {
    setSavePayload(payload)
    setSaveTitle(suggestTitle(payload.formattedOutput || payload.rawInput, payload.language))
    setSaveProjectId(pendingProjectId)
    setSaveOpen(true)
  }

  const confirmSave = async () => {
    if (!savePayload) return
    const now = Date.now()
    const entry: Entry = {
      id: uid(),
      title: saveTitle.trim() || "Untitled",
      language: savePayload.language,
      rawInput: savePayload.rawInput,
      formattedOutput: savePayload.formattedOutput,
      formatterVersion: STRUCTFLOW_FORMATTER_VERSION,
      formatOptions: savePayload.formatOptions,
      source: inputSource,
      projectId: saveProjectId,
      pinned: false,
      tags: [],
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    entry.title = makeUniqueTitle(entry.title, saveProjectId, entries)
    await saveEntry(entry)
    await refresh()
    setSaveOpen(false)
    setSavePayload(null)
    setPendingProjectId(null)
  }

  const openEntry = async (entry: Entry) => {
    setLanguage(entry.language)
    setInput(entry.rawInput)
    setInputSource("library")
    setPendingProjectId(null)
    setTab("format")
    await saveEntry({ ...entry, lastOpenedAt: Date.now() })
    await refresh()
  }

  const handleAddToProject = (projectId: string | null) => {
    setInput("")
    setInputSource("manual")
    setPendingProjectId(projectId)
    setTab("format")
  }

  const handleCreateProject = async (name: string, parentId: string | null = null) => {
    const project: Project = {
      id: uid(),
      name,
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      createdAt: Date.now(),
      parentId,
    }
    await saveProject(project)
    await refresh()
  }

  const handleRecolorProject = async (id: string, color: string) => {
    const project = projects.find((p) => p.id === id)
    if (project) {
      await saveProject({ ...project, color })
      await refresh()
    }
  }

  const handleRenameProject = async (id: string, name: string) => {
    const project = projects.find((p) => p.id === id)
    if (project) {
      await saveProject({ ...project, name })
      await refresh()
    }
  }

  const handleRenameEntry = async (id: string, title: string) => {
    const entry = entries.find((e) => e.id === id)
    if (entry) {
      await saveEntry({ ...entry, title, updatedAt: Date.now() })
      await refresh()
    }
  }

  const handleUpdateEntry = async (id: string, patch: Partial<Entry>) => {
    const entry = entries.find((e) => e.id === id)
    if (entry) {
      await saveEntry({
        ...entry,
        ...patch,
        formatOptions: patch.formatOptions ?? entry.formatOptions ?? DEFAULT_OPTIONS,
        updatedAt: Date.now(),
      })
      await refresh()
    }
  }

  const handleDuplicateEntry = async (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    const now = Date.now()
    await saveEntry({
      ...entry,
      id: uid(),
      title: makeUniqueTitle(`${entry.title} copy`, entry.projectId, entries),
      pinned: false,
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    await refresh()
  }

  const handleImportData = async (importedEntries: Entry[], importedProjects: Project[]) => {
    await saveProjects(importedProjects)
    await saveEntries(importedEntries)
    await refresh()
  }

  const handleChangeDefaultLanguage = (lang: Language) => {
    setDefaultLanguage(lang)
    try {
      localStorage.setItem(DEFAULT_LANG_KEY, lang)
    } catch {
    }
    // Apply immediately only when the editor is empty, so a draft is never overridden.
    if (!input.trim()) setLanguage(lang)
  }

  const handleClearAll = async () => {
    await clearAll()
    await refresh()
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <img src={logo || "/placeholder.svg"} alt="StructFlow logo" className="h-6 w-6" />
          <span className="text-title font-semibold tracking-tight">StructFlow</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <SupportButton />
          <SettingsButton onOpen={() => setSettingsOpen(true)} />
        </div>
      </header>

      {settingsOpen ? (
        <div className="min-h-0 flex-1">
          <SettingsView
            onClose={() => setSettingsOpen(false)}
            themeMode={mode}
            onChangeThemeMode={setMode}
            syntaxThemeId={syntaxThemeId}
            onChangeSyntaxTheme={setSyntaxTheme}
            defaultLanguage={defaultLanguage}
            onChangeDefaultLanguage={handleChangeDefaultLanguage}
            entries={entries}
            projects={projects}
            onImportData={handleImportData}
            onClearAll={handleClearAll}
          />
        </div>
      ) : (
        <>
      <div className="flex border-b border-border px-2">
        <TabButton active={tab === "format"} onClick={() => setTab("format")}>
          <Wand2 className="h-3.5 w-3.5" /> Formatter
        </TabButton>
        <TabButton active={tab === "library"} onClick={() => setTab("library")}>
          <LibraryIcon className="h-3.5 w-3.5" /> Library
          {entries.length > 0 && (
            <span className="rounded-full bg-secondary px-1.5 text-micro font-medium text-muted-foreground">
              {entries.length}
            </span>
          )}
        </TabButton>
      </div>

      <main className="min-h-0 flex-1">
        {tab === "format" ? (
          <Formatter
            language={language}
            setLanguage={setLanguage}
            input={input}
            setInput={(value) => {
              setInput(value)
              setInputSource("manual")
            }}
            onRequestSave={requestSave}
            syntaxThemeId={syntaxThemeId}
          />
        ) : (
          <Library
            entries={entries}
            projects={projects}
            onOpenEntry={openEntry}
            onDeleteEntry={async (id) => {
              await deleteEntry(id)
              await refresh()
            }}
            onRenameEntry={handleRenameEntry}
            onMoveEntry={async (id, pid) => {
              await moveEntry(id, pid)
              await refresh()
            }}
            onCreateProject={handleCreateProject}
            onRenameProject={handleRenameProject}
            onRecolorProject={handleRecolorProject}
            onAddToProject={handleAddToProject}
            onImportData={handleImportData}
            onUpdateEntry={handleUpdateEntry}
            onDuplicateEntry={handleDuplicateEntry}
            onDeleteProject={async (id) => {
              await deleteProject(id)
              await refresh()
            }}
          />
        )}
      </main>
        </>
      )}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save to library"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </ModalButton>
            <ModalButton onClick={confirmSave}>Save</ModalButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="save-title" className="text-label uppercase tracking-wide text-muted-foreground">Title</Label>
            <Input
              id="save-title"
              autoFocus
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmSave()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="save-folder" className="gap-1.5 text-label uppercase tracking-wide text-muted-foreground">
              <FolderInput className="h-3 w-3" /> Folder
            </Label>
            <Select
              value={saveProjectId ?? "__none__"}
              onValueChange={(v) => setSaveProjectId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="save-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No folder</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {projectPath(p.id, projects).join(" / ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-body font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function suggestTitle(content: string, language: Language): string {
  if (language === "json") {
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed)
        if (keys.length) return `{ ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""} }`
      }
      if (Array.isArray(parsed)) return `Array (${parsed.length})`
    } catch {
    }
  }
  const firstLine = content.trim().split("\n")[0]?.slice(0, 40)
  return firstLine || "Untitled"
}

function makeUniqueTitle(title: string, projectId: string | null, entries: Entry[]): string {
  const used = new Set(
    entries
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => entry.title.trim().toLowerCase()),
  )
  if (!used.has(title.trim().toLowerCase())) return title

  let n = 2
  let next = `${title} ${n}`
  while (used.has(next.trim().toLowerCase())) {
    n++
    next = `${title} ${n}`
  }
  return next
}
