import { useCallback, useEffect, useState } from "react"
import { Wand2, Library as LibraryIcon, FolderInput } from "lucide-react"
import logo from "./assets/logo.png"
import { Formatter } from "./components/formatter"
import { Library, ModalButton } from "./components/library"
import { Modal } from "./components/modal"
import { ThemeModeToggle } from "./components/theme-mode-toggle"
import { SyntaxThemeSelect } from "./components/syntax-theme-select"
import { SupportButton } from "./components/support-button"
import { useTheme } from "./lib/use-theme"
import { useSyntaxTheme } from "./lib/use-syntax-theme"
import {
  deleteEntry,
  deleteProject,
  getAllEntries,
  getAllProjects,
  moveEntry,
  saveEntry,
  saveProject,
  uid,
} from "./lib/storage"
import { PROJECT_COLORS, type Entry, type Language, type Project } from "./lib/types"
import { cn } from "./lib/utils"

type Tab = "format" | "library"

export default function App() {
  const { mode, resolved, setMode } = useTheme()
  const { syntaxThemeId, setSyntaxTheme } = useSyntaxTheme()
  const [tab, setTab] = useState<Tab>("format")

  const [language, setLanguage] = useState<Language>("markdown")
  const [input, setInput] = useState("")

  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Save modal state
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState("")
  const [savePayload, setSavePayload] = useState<{ content: string; language: Language } | null>(null)
  const [saveProjectId, setSaveProjectId] = useState<string | null>(null)
  // When starting a new entry from a project in the Library, remember the target.
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [e, p] = await Promise.all([getAllEntries(), getAllProjects()])
    setEntries(e)
    setProjects(p)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Pick up text sent from the right-click context menu (extension only).
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return
    chrome.storage.local.get("structflow_incoming", (res) => {
      const incoming = res?.structflow_incoming
      if (incoming) {
        setInput(incoming)
        setTab("format")
        chrome.storage.local.remove("structflow_incoming")
      }
    })
  }, [])

  const requestSave = (content: string, lang: Language) => {
    setSavePayload({ content, language: lang })
    setSaveTitle(suggestTitle(content, lang))
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
      content: savePayload.content,
      projectId: saveProjectId,
      createdAt: now,
      updatedAt: now,
    }
    await saveEntry(entry)
    await refresh()
    setSaveOpen(false)
    setSavePayload(null)
    setPendingProjectId(null)
  }

  const openEntry = (entry: Entry) => {
    setLanguage(entry.language)
    setInput(entry.content)
    setPendingProjectId(null)
    setTab("format")
  }

  // Start a brand-new entry in the Formatter, pre-targeting a project so the
  // next Save drops it straight into that folder.
  const handleAddToProject = (projectId: string | null) => {
    setInput("")
    setPendingProjectId(projectId)
    setTab("format")
  }

  const handleCreateProject = async (name: string) => {
    const project: Project = {
      id: uid(),
      name,
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      createdAt: Date.now(),
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

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <img src={logo || "/placeholder.svg"} alt="StructFlow logo" className="h-6 w-6" />
          <span className="text-[15px] font-semibold tracking-tight">StructFlow</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {tab === "format" && <SyntaxThemeSelect value={syntaxThemeId} onChange={setSyntaxTheme} />}
          <SupportButton />
          <ThemeModeToggle mode={mode} resolved={resolved} onChange={setMode} />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border px-2">
        <TabButton active={tab === "format"} onClick={() => setTab("format")}>
          <Wand2 className="h-3.5 w-3.5" /> Formatter
        </TabButton>
        <TabButton active={tab === "library"} onClick={() => setTab("library")}>
          <LibraryIcon className="h-3.5 w-3.5" /> Library
          {entries.length > 0 && (
            <span className="rounded-full bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground">
              {entries.length}
            </span>
          )}
        </TabButton>
      </div>

      {/* Body */}
      <main className="min-h-0 flex-1">
        {tab === "format" ? (
          <Formatter
            language={language}
            setLanguage={setLanguage}
            input={input}
            setInput={setInput}
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
            onDeleteProject={async (id) => {
              await deleteProject(id)
              await refresh()
            }}
          />
        )}
      </main>

      {/* Save modal */}
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
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Title</label>
            <input
              autoFocus
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmSave()}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <FolderInput className="h-3 w-3" /> Project
            </label>
            <select
              value={saveProjectId ?? ""}
              onChange={(e) => setSaveProjectId(e.target.value || null)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
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
      // ignore
    }
  }
  const firstLine = content.trim().split("\n")[0]?.slice(0, 40)
  return firstLine || "Untitled"
}
