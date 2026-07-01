import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  Copy,
  Check,
  Download,
  Trash2,
  Pencil,
  Plus,
  FileCode2,
  Inbox,
  MoreVertical,
  Archive,
  Upload,
  FolderUp,
  Star,
  Tags,
  History,
  CopyPlus,
  Info,
  RefreshCw,
  FolderInput,
} from "lucide-react"
import { Modal } from "./modal"
import { IconButton } from "./icon-button"
import { TagsInput } from "./tags-input"
import { MoveToDialog } from "./move-to-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { formatCode } from "@/lib/formatter"
import {
  copyToClipboard,
  downloadFile,
  exportEntriesAsZip,
  importDataTransfer,
  importFiles,
  mimeFor,
  slugify,
} from "@/lib/io"
import {
  DEFAULT_OPTIONS,
  LANGUAGES,
  STRUCTFLOW_FORMATTER_VERSION,
  entryContent,
  getLanguage,
  PROJECT_COLORS,
  projectChildren,
  projectDescendantIds,
  projectPath,
  type Entry,
  type FormatOptions,
  type Language,
  type Project,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
type LibraryMode = "all" | "pinned" | "recent"

// Folder collapse state is persisted (like a file explorer) so it survives the
// Library unmounting on every tab switch, plus full reloads. Stored as the list of
// collapsed folder ids ("__none__" = the No-folder group); everything else is open.
const COLLAPSED_KEY = "structflow_library_collapsed"

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    const ids = raw ? JSON.parse(raw) : null
    if (Array.isArray(ids)) return Object.fromEntries(ids.map((id: string) => [id, true]))
  } catch {
    // ignore malformed/unavailable storage; fall back to all-expanded
  }
  return {}
}

function saveCollapsed(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Object.keys(state).filter((k) => state[k])))
  } catch {
    // best-effort; collapse just won't persist if storage is full/blocked
  }
}
type EntryPatch = Partial<
  Pick<
    Entry,
    | "title"
    | "language"
    | "rawInput"
    | "formattedOutput"
    | "formatterVersion"
    | "formatOptions"
    | "projectId"
    | "pinned"
    | "tags"
  >
>

interface LibraryProps {
  entries: Entry[]
  projects: Project[]
  onOpenEntry: (entry: Entry) => void
  onDeleteEntry: (id: string) => void
  onRenameEntry: (id: string, title: string) => void
  onMoveEntry: (id: string, projectId: string | null) => void
  onMoveProject: (id: string, parentId: string | null) => void
  onCreateProject: (name: string, parentId?: string | null) => void
  onRenameProject: (id: string, name: string) => void
  onRecolorProject: (id: string, color: string) => void
  onAddToProject: (projectId: string | null) => void
  onImportData: (entries: Entry[], projects: Project[]) => Promise<void>
  onUpdateEntry: (id: string, patch: EntryPatch) => void
  onDuplicateEntry: (id: string) => void
  onDeleteProject: (id: string) => void
}

export function Library({
  entries,
  projects,
  onOpenEntry,
  onDeleteEntry,
  onRenameEntry,
  onMoveEntry,
  onMoveProject,
  onCreateProject,
  onRenameProject,
  onRecolorProject,
  onAddToProject,
  onImportData,
  onUpdateEntry,
  onDuplicateEntry,
  onDeleteProject,
}: LibraryProps) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<LibraryMode>("all")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [draggingEntry, setDraggingEntry] = useState<Entry | null>(null)
  const [draggingProject, setDraggingProject] = useState<Project | null>(null)
  // Require a small move before a drag starts so row clicks and the action
  // buttons keep working.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string
    entries: Entry[]
    projects: Project[]
    skipped: number
  } | null>(null)
  // Destination folder for an import (null = top level / No folder).
  const [importTarget, setImportTarget] = useState<string | null>(null)
  const [newProjectParent, setNewProjectParent] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Whether an OS file/folder drag is hovering the panel (drives the drop overlay).
  const [fileDragActive, setFileDragActive] = useState(false)
  // `dragover` fires continuously while a drag hovers a valid target; we treat it as a
  // heartbeat and clear the overlay shortly after it stops. This self-heals on drop,
  // Esc-cancel, or leaving the window — none of which reliably fire a final dragleave.
  const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Folders whose name matches the query — searching a folder name should surface
  // the folder and everything inside it.
  const nameMatchedFolders = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return new Set<string>()
    return new Set(projects.filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.id))
  }, [projects, query])

  // True when `projectId` or any of its ancestor folders matched the query by name.
  const inMatchedFolderSubtree = useCallback(
    (projectId: string | null): boolean => {
      if (!projectId || nameMatchedFolders.size === 0) return false
      const byId = new Map(projects.map((p) => [p.id, p]))
      let cur = byId.get(projectId)
      const seen = new Set<string>()
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        if (nameMatchedFolders.has(cur.id)) return true
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return false
    },
    [projects, nameMatchedFolders],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((entry) => {
        if (mode === "pinned" && !entry.pinned) return false
        if (mode === "recent" && !entry.lastOpenedAt) return false
        if (!q) return true
        return (
          entry.title.toLowerCase().includes(q) ||
          entryContent(entry).toLowerCase().includes(q) ||
          entry.rawInput.toLowerCase().includes(q) ||
          entry.language.toLowerCase().includes(q) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          inMatchedFolderSubtree(entry.projectId)
        )
      })
      .sort((a, b) => {
        if (mode === "recent") return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
  }, [entries, mode, query, inMatchedFolderSubtree])

  const groups = useMemo(() => {
    const map = new Map<string | null, Entry[]>()
    map.set(null, [])
    for (const p of projects) map.set(p.id, [])
    for (const e of filtered) {
      const key = e.projectId && map.has(e.projectId) ? e.projectId : null
      map.get(key)!.push(e)
    }
    return map
  }, [filtered, projects])

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] }
      saveCollapsed(next)
      return next
    })

  const submitProject = () => {
    const name = projectName.trim()
    if (name) {
      onCreateProject(name, newProjectParent)
      setProjectName("")
      setNewProjectParent(null)
      setNewProjectOpen(false)
    }
  }

  const openNewProject = (parentId: string | null) => {
    setNewProjectParent(parentId)
    setProjectName("")
    setNewProjectOpen(true)
  }

  /** "Work / SQL" style label for folder dropdowns. */
  const projectLabel = (id: string) => projectPath(id, projects).join(" / ")

  const ungrouped = groups.get(null) ?? []

  // Union of every tag in the library, for autocomplete in the Details editor.
  const allTags = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of entries)
      for (const t of e.tags) {
        const key = t.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          out.push(t)
        }
      }
    return out.sort((a, b) => a.localeCompare(b))
  }, [entries])

  const countsByKey = useMemo(() => {
    const counts: Record<string, number> = { __none__: 0 }
    for (const p of projects) counts[p.id] = 0
    for (const e of entries) {
      const key = e.projectId && counts[e.projectId] !== undefined ? e.projectId : "__none__"
      counts[key]++
    }
    return counts
  }, [entries, projects])

  const exportableGroups = useMemo(
    () => [
      ...projects.map((p) => ({ key: p.id, name: p.name, color: p.color, count: countsByKey[p.id] ?? 0 })),
      ...(countsByKey.__none__ > 0
        ? [{ key: "__none__", name: "No folder", color: null as string | null, count: countsByKey.__none__ }]
        : []),
    ],
    [projects, countsByKey],
  )

  const openExport = () => {
    const initial: Record<string, boolean> = {}
    for (const g of exportableGroups) initial[g.key] = g.count > 0
    setSelected(initial)
    setExportOpen(true)
  }

  const selectedCount = exportableGroups.reduce(
    (sum, g) => sum + (selected[g.key] ? g.count : 0),
    0,
  )
  const allSelected = exportableGroups.length > 0 && exportableGroups.every((g) => selected[g.key])

  const runExport = () => {
    const chosen = new Set(exportableGroups.filter((g) => selected[g.key]).map((g) => g.key))
    const toExport = entries.filter((e) => {
      const key = e.projectId && countsByKey[e.projectId] !== undefined ? e.projectId : "__none__"
      return chosen.has(key)
    })
    if (toExport.length === 0) return
    const usedProjects = projects.filter((p) => chosen.has(p.id))
    exportEntriesAsZip(toExport, usedProjects)
    setExportOpen(false)
  }

  const presentImport = (
    imported: { entries: Entry[]; projects: Project[]; skipped: number },
    fileName: string,
  ) => {
    if (imported.entries.length === 0) {
      setImportError("No importable files were found.")
      return
    }
    setImportTarget(null)
    setPendingImport({
      fileName,
      entries: imported.entries,
      projects: imported.projects,
      skipped: imported.skipped,
    })
  }

  const runImport = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return
    setImportError(null)
    try {
      const imported = await importFiles(files)
      const label =
        files.length === 1
          ? files[0].name
          : `${imported.entries.length} files${imported.projects.length ? ` · ${imported.projects.length} folder(s)` : ""}`
      presentImport(imported, label)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not import these files.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Folder import is drag-and-drop only: the native directory picker (both
  // webkitdirectory and showDirectoryPicker) crashes the side-panel renderer, but a
  // drop carries the folder in without any native chooser. Dropped directory handles
  // reuse the lazy walk; dropped files route through the same importFiles path.
  const isFileDrag = (dt: DataTransfer | null) =>
    !!dt && Array.from(dt.types).includes("Files")

  const clearDragEndTimer = () => {
    if (dragEndTimer.current) clearTimeout(dragEndTimer.current)
    dragEndTimer.current = null
  }
  const onPanelDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setFileDragActive(true)
    // Re-arm the heartbeat: if dragover stops (drop / Esc / left the panel or window),
    // the overlay clears itself shortly after instead of sticking around.
    clearDragEndTimer()
    dragEndTimer.current = setTimeout(() => setFileDragActive(false), 120)
  }
  const onPanelDrop = (e: React.DragEvent) => {
    clearDragEndTimer()
    setFileDragActive(false)
    if (!isFileDrag(e.dataTransfer)) return
    e.preventDefault()
    // Grab the items synchronously; importDataTransfer reads their handles before the
    // first await so the DataTransferItems aren't neutered out from under us.
    const items = Array.from(e.dataTransfer.items)
    setImportError(null)
    importDataTransfer(items)
      .then((imported) => {
        const label = imported.projects.length
          ? `${imported.entries.length} file${imported.entries.length === 1 ? "" : "s"} · ${imported.projects.length} folder(s)`
          : `${imported.entries.length} file${imported.entries.length === 1 ? "" : "s"}`
        presentImport(imported, label)
      })
      .catch((err) => {
        setImportError(err instanceof Error ? err.message : "Could not import what was dropped.")
      })
  }

  // Don't leak the heartbeat timeout if the Library unmounts mid-drag.
  useEffect(() => () => clearDragEndTimer(), [])

  const confirmImport = async () => {
    if (!pendingImport) return
    // Nest the import under the chosen destination folder: its root folders and any
    // loose (folderless) entries get re-parented to importTarget.
    const target = importTarget
    const entries = target
      ? pendingImport.entries.map((e) => (e.projectId == null ? { ...e, projectId: target } : e))
      : pendingImport.entries
    const projects = target
      ? pendingImport.projects.map((p) => (p.parentId == null ? { ...p, parentId: target } : p))
      : pendingImport.projects
    await onImportData(entries, projects)
    setPendingImport(null)
    setImportTarget(null)
  }

  // While searching, a folder is shown if it (or any descendant) has a matching
  // entry, OR the folder's name matches (then its whole subtree is revealed).
  const visibleDuringSearch = useMemo(() => {
    if (!query.trim()) return null
    const set = new Set<string>()
    const byId = new Map(projects.map((p) => [p.id, p]))
    const addWithAncestors = (id: string) => {
      let cur: Project | undefined = byId.get(id)
      const seen = new Set<string>()
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        set.add(cur.id)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
    }
    // Folders containing a matching entry (and their ancestors, so the path shows).
    for (const p of projects) {
      if ((groups.get(p.id)?.length ?? 0) > 0) addWithAncestors(p.id)
    }
    // Name-matched folders: reveal the folder, its ancestors, and all descendants.
    for (const id of nameMatchedFolders) {
      addWithAncestors(id)
      for (const descendant of projectDescendantIds(id, projects)) set.add(descendant)
    }
    return set
  }, [query, projects, groups, nameMatchedFolders])

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith("folder:")) setDraggingProject(projects.find((p) => p.id === id.slice(7)) ?? null)
    else if (id.startsWith("entry:")) setDraggingEntry(entries.find((x) => x.id === id.slice(6)) ?? null)
  }
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingEntry(null)
    setDraggingProject(null)
    const overId = e.over?.id
    if (overId == null) return
    const activeId = String(e.active.id)
    const target = overId === "__root__" ? null : String(overId)

    if (activeId.startsWith("folder:")) {
      const projectId = activeId.slice(7)
      // A folder can't be dropped onto itself or any of its own descendants.
      if (target === projectId) return
      if (target && projectDescendantIds(projectId, projects).includes(target)) return
      const proj = projects.find((p) => p.id === projectId)
      if (proj && (proj.parentId ?? null) !== target) onMoveProject(projectId, target)
      return
    }

    const entryId = activeId.startsWith("entry:") ? activeId.slice(6) : activeId
    const ent = entries.find((x) => x.id === entryId)
    if (ent && ent.projectId !== target) onMoveEntry(entryId, target)
  }

  const renderEntryRow = (entry: Entry) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      projects={projects}
      projectLabel={projectLabel}
      menuOpen={menuFor === entry.id}
      onMenuToggle={() => setMenuFor((m) => (m === entry.id ? null : entry.id))}
      onOpen={() => onOpenEntry(entry)}
      onDelete={() => onDeleteEntry(entry.id)}
      onRename={(t) => onRenameEntry(entry.id, t)}
      onMove={(pid) => onMoveEntry(entry.id, pid)}
      onTogglePinned={() => onUpdateEntry(entry.id, { pinned: !entry.pinned })}
      onDuplicate={() => onDuplicateEntry(entry.id)}
      onEdit={() => setEditingEntry(entry)}
    />
  )

  const renderFolder = (project: Project, ancestors: Set<string> = new Set()): React.ReactNode => {
    if (visibleDuringSearch && !visibleDuringSearch.has(project.id)) return null
    // Guard against a corrupt parentId cycle infinitely recursing the render.
    if (ancestors.has(project.id)) return null
    const nextAncestors = new Set(ancestors).add(project.id)
    const items = groups.get(project.id) ?? []
    return (
      <ProjectGroup
        key={project.id}
        project={project}
        count={items.length}
        collapsed={collapsed[project.id]}
        onToggle={() => toggle(project.id)}
        onRename={(name) => onRenameProject(project.id, name)}
        onRecolor={(color) => onRecolorProject(project.id, color)}
        onAddItem={() => onAddToProject(project.id)}
        onAddSubfolder={() => openNewProject(project.id)}
        onMove={(parentId) => onMoveProject(project.id, parentId)}
        onDelete={() => setDeleteTarget(project)}
        projects={projects}
      >
        {projectChildren(project.id, projects).map((child) => renderFolder(child, nextAncestors))}
        {items.map(renderEntryRow)}
      </ProjectGroup>
    )
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={onPanelDragOver}
      onDrop={onPanelDrop}
    >
      {fileDragActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/60 px-6 py-5 text-center">
            <FolderUp className="h-6 w-6 text-primary" />
            <p className="text-body font-medium text-foreground">Drop to import</p>
            <p className="text-compact text-muted-foreground">A folder (with its structure) or files</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved entries…"
            className="w-full bg-transparent text-body focus:outline-none"
          />
        </div>
        <IconButton
          label="Export data"
          onClick={openExport}
          disabled={entries.length === 0}
          className="border border-border bg-background"
        >
          <Archive className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Import files or drag a folder onto the panel"
          onClick={() => fileInputRef.current?.click()}
          className="border border-border bg-background"
        >
          <Upload className="h-4 w-4" />
        </IconButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.json,.md,.markdown,.txt,.log,.ts,.tsx,.mts,.cts,.js,.jsx,.mjs,.cjs,.json5,.jsonc,.html,.htm,.xml,.svg,.vue,.css,.scss,.sass,.less,.sql"
          className="hidden"
          onChange={(e) => void runImport(e.target.files)}
        />
        <IconButton
          label="New folder"
          onClick={() => openNewProject(null)}
          className="border border-border bg-background"
        >
          <FolderPlus className="h-4 w-4" />
        </IconButton>
      </div>
      {importError && (
        <div className="border-b border-border px-3 py-2 text-compact text-destructive">
          {importError}
        </div>
      )}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
          All
        </ModeButton>
        <ModeButton active={mode === "pinned"} onClick={() => setMode("pinned")}>
          <Star className="h-3.5 w-3.5" /> Pinned
        </ModeButton>
        <ModeButton active={mode === "recent"} onClick={() => setMode("recent")}>
          <History className="h-3.5 w-3.5" /> Recent
        </ModeButton>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 && projects.length === 0 ? (
          <EmptyLibrary />
        ) : query.trim() && filtered.length === 0 && (visibleDuringSearch?.size ?? 0) === 0 ? (
          <div className="px-4 py-10 text-center text-body text-muted-foreground">
            Nothing matches “{query}”.
          </div>
        ) : (
          <DndContext sensors={dndSensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="py-1">
              {projectChildren(null, projects).map((p) => renderFolder(p))}

              {ungrouped.length > 0 && (
                <ProjectGroup
                  project={null}
                  count={ungrouped.length}
                  collapsed={collapsed["__none__"]}
                  onToggle={() => toggle("__none__")}
                  onAddItem={() => onAddToProject(null)}
                >
                  {ungrouped.map(renderEntryRow)}
                </ProjectGroup>
              )}
            </div>
            <DragOverlay dropAnimation={null}>
              {draggingEntry ? (
                <div className="pointer-events-none flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1 text-body font-medium shadow-lg">
                  <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-50 truncate">{draggingEntry.title}</span>
                </div>
              ) : draggingProject ? (
                <div className="pointer-events-none flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1 text-body font-medium shadow-lg">
                  <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: draggingProject.color }} />
                  <span className="max-w-50 truncate">{draggingProject.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => openNewProject(null)}>
            <FolderPlus className="h-3.5 w-3.5" /> New folder
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import files…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={entries.length === 0} onSelect={() => openExport()}>
            <Archive className="h-3.5 w-3.5" /> Export data…
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Modal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        title="New folder"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </ModalButton>
            <ModalButton onClick={submitProject}>Create</ModalButton>
          </>
        }
      >
        <div className="space-y-2">
          {newProjectParent && (
            <p className="text-compact text-muted-foreground">
              Inside <span className="font-medium text-foreground">{projectLabel(newProjectParent)}</span>
            </p>
          )}
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitProject()}
            placeholder="Folder name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-body focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete folder"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </ModalButton>
            <ModalButton
              variant="danger"
              onClick={() => {
                if (deleteTarget) onDeleteProject(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </ModalButton>
          </>
        }
      >
        {deleteTarget && (() => {
          const subIds = projectDescendantIds(deleteTarget.id, projects)
          const idSet = new Set([deleteTarget.id, ...subIds])
          const entryCount = entries.filter((e) => e.projectId && idSet.has(e.projectId)).length
          return (
            <p className="text-body text-muted-foreground">
              Delete <span className="font-medium text-foreground">{projectLabel(deleteTarget.id)}</span>?
              {(subIds.length > 0 || entryCount > 0) && (
                <>
                  {" "}This permanently removes{" "}
                  {subIds.length > 0 && (
                    <span className="text-foreground">
                      {subIds.length} nested folder{subIds.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {subIds.length > 0 && entryCount > 0 && " and "}
                  {entryCount > 0 && (
                    <span className="text-foreground">
                      {entryCount} entr{entryCount === 1 ? "y" : "ies"}
                    </span>
                  )}
                  . This can't be undone.
                </>
              )}
            </p>
          )
        })()}
      </Modal>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export data"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </ModalButton>
            <ModalButton onClick={runExport}>
              Export {selectedCount} {selectedCount === 1 ? "entry" : "entries"}
            </ModalButton>
          </>
        }
      >
        <p className="mb-3 text-compact text-muted-foreground">
          Choose which folders to include. Entries are exported as files, organized into
          folders, inside a single .zip (with a <span className="font-mono">manifest.json</span>).
        </p>
        <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-body font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              const next: Record<string, boolean> = {}
              for (const g of exportableGroups) next[g.key] = e.target.checked
              setSelected(next)
            }}
            className="h-4 w-4 accent-primary"
          />
          Select all
        </label>
        <div className="mt-1 max-h-64 overflow-auto">
          {exportableGroups.map((g) => (
            <label
              key={g.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-body hover:bg-secondary/60"
            >
              <input
                type="checkbox"
                checked={!!selected[g.key]}
                onChange={(e) => setSelected((s) => ({ ...s, [g.key]: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              {g.color ? (
                <Folder className="h-4 w-4 shrink-0" style={{ color: g.color }} />
              ) : (
                <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <span className="shrink-0 text-label text-muted-foreground">
                {g.count} {g.count === 1 ? "entry" : "entries"}
              </span>
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="Import data"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </ModalButton>
            <ModalButton onClick={confirmImport}>
              Import {pendingImport?.entries.length ?? 0}{" "}
              {(pendingImport?.entries.length ?? 0) === 1 ? "entry" : "entries"}
            </ModalButton>
          </>
        }
      >
        {pendingImport && (
          <div className="space-y-2 text-body">
            <p className="text-muted-foreground">
              Ready to import <span className="font-medium text-foreground">{pendingImport.fileName}</span>.
              Imported IDs will be regenerated so existing library items are not overwritten.
            </p>
            <div className="space-y-1.5">
              <Label className="text-label uppercase tracking-wide text-muted-foreground">Import into</Label>
              <Select
                value={importTarget ?? "__none__"}
                onValueChange={(v) => setImportTarget(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No folder (top level)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {projectPath(p.id, projects).join(" / ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-border bg-background px-3 py-2">
              <div className="flex items-center justify-between">
                <span>Folders</span>
                <span className="font-mono text-muted-foreground">{pendingImport.projects.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Entries</span>
                <span className="font-mono text-muted-foreground">{pendingImport.entries.length}</span>
              </div>
            </div>
            {pendingImport.skipped > 0 && (
              <p className="text-compact text-muted-foreground">
                {pendingImport.skipped} file{pendingImport.skipped === 1 ? "" : "s"} skipped -
                binary, larger than 512&nbsp;KB, or inside ignored folders (e.g. node_modules,
                .git, dist).
              </p>
            )}
          </div>
        )}
      </Modal>

      <EntryEditorModal
        entry={editingEntry}
        projects={projects}
        tagSuggestions={allTags}
        onClose={() => setEditingEntry(null)}
        onSave={(id, patch) => {
          onUpdateEntry(id, patch)
          setEditingEntry(null)
        }}
      />
    </div>
  )
}

function ProjectGroup({
  project,
  count,
  collapsed,
  onToggle,
  onRename,
  onRecolor,
  onAddItem,
  onAddSubfolder,
  onMove,
  onDelete,
  projects = [],
  children,
}: {
  project: Project | null
  count: number
  collapsed?: boolean
  onToggle: () => void
  onRename?: (name: string) => void
  onRecolor?: (color: string) => void
  onAddItem?: () => void
  onAddSubfolder?: () => void
  onMove?: (parentId: string | null) => void
  onDelete?: () => void
  /** All folders — needed by the "Move to…" picker (defaults to none). */
  projects?: Project[]
  children: React.ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project?.name ?? "")
  const [menuOpen, setMenuOpen] = useState(false)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  // A folder can't be moved into itself or any descendant, so omit that subtree.
  const moveExclude = useMemo(
    () => (project ? [project.id, ...projectDescendantIds(project.id, projects)] : []),
    [project, projects],
  )
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: project ? project.id : "__root__" })
  const {
    setNodeRef: setDragRef,
    attributes: dragAttributes,
    listeners: dragListeners,
    isDragging,
  } = useDraggable({ id: `folder:${project?.id ?? "root"}`, disabled: !project })
  // The header is both a drop target (entries/folders dropped into it) and a drag
  // handle (the folder itself); merge both dnd refs onto the one node.
  const setHeaderRef = (node: HTMLElement | null) => {
    setDropRef(node)
    setDragRef(node)
  }

  if (project === null && count === 0) return null

  const submitRename = () => {
    const n = name.trim()
    if (n && onRename) onRename(n)
    setRenaming(false)
  }

  // Shared between the folder's "⋮" dropdown and its right-click context menu so
  // they can't drift. Item/Separator/MenuLabel are the matching primitives;
  // onClose closes whichever menu the color swatches live in (they're plain
  // buttons, not menu items, so they don't auto-close).
  const folderMenuItems = (
    Item: React.ElementType,
    Separator: React.ElementType,
    MenuLabel: React.ElementType,
    onClose: () => void,
  ) => (
    <>
      {onRename && (
        <Item
          onSelect={() => {
            setName(project!.name)
            setRenaming(true)
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Rename
        </Item>
      )}
      {onAddItem && (
        <Item onSelect={() => onAddItem()}>
          <Plus className="h-3.5 w-3.5" /> Add new item
        </Item>
      )}
      {onAddSubfolder && (
        <Item onSelect={() => onAddSubfolder()}>
          <FolderPlus className="h-3.5 w-3.5" /> New folder
        </Item>
      )}
      {onMove && (
        <Item onSelect={() => setMoveOpen(true)}>
          <FolderInput className="h-3.5 w-3.5" /> Move to…
        </Item>
      )}
      {onRecolor && (
        <>
          <Separator />
          <MenuLabel className="text-label uppercase tracking-wide text-muted-foreground">Color</MenuLabel>
          <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
            {PROJECT_COLORS.map((c) => {
              const active = c === project!.color
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Set color ${c}`}
                  onClick={() => {
                    onRecolor(c)
                    onClose()
                  }}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full ring-offset-1 ring-offset-popover transition-transform hover:scale-110",
                    active && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {active && <Check className="h-3 w-3 text-background" />}
                </button>
              )
            })}
          </div>
        </>
      )}
      {onDelete && (
        <>
          <Separator />
          <Item variant="destructive" onSelect={() => onDelete()}>
            <Trash2 className="h-3.5 w-3.5" /> Delete folder
          </Item>
        </>
      )}
    </>
  )

  const header = (
      <div
        ref={setHeaderRef}
        {...dragAttributes}
        {...dragListeners}
        // Real folders own their right-click menu; stop it bubbling to the
        // library background menu. The root "No folder" header has no menu, so it
        // falls through to the library menu instead.
        onContextMenu={project ? (e) => e.stopPropagation() : undefined}
        className={cn(
          "group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-secondary/40",
          isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
          isDragging && "opacity-40",
        )}
      >
        <button type="button" onClick={onToggle} className="flex shrink-0 items-center" aria-label={collapsed ? "Expand" : "Collapse"}>
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !collapsed && "rotate-90")} />
        </button>
        {project ? (
          collapsed ? (
            <Folder className="h-4 w-4 shrink-0" style={{ color: project.color }} />
          ) : (
            <FolderOpen className="h-4 w-4 shrink-0" style={{ color: project.color }} />
          )
        ) : (
          <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {renaming && project ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename()
              if (e.key === "Escape") setRenaming(false)
            }}
            className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 text-body focus:outline-none"
          />
        ) : (
          <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <span className="truncate text-body font-medium">{project ? project.name : "No folder"}</span>
            <span className="text-label text-muted-foreground">{count}</span>
          </button>
        )}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {onAddItem && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onAddItem}
                  aria-label="Add new item"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add new item</TooltipContent>
            </Tooltip>
          )}
          {project && (onRename || onRecolor || onDelete) && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Folder options"
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Folder options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-48"
                // A selected item may open a dialog (delete confirm); don't refocus
                // the trigger on close or its Tooltip re-fires over that dialog.
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {folderMenuItems(DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, () => setMenuOpen(false))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
  )

  return (
    <div className="mb-0.5">
      {project ? (
        <ContextMenu open={ctxOpen} onOpenChange={setCtxOpen}>
          <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {folderMenuItems(ContextMenuItem, ContextMenuSeparator, ContextMenuLabel, () => setCtxOpen(false))}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        header
      )}
      {!collapsed && <div className="pl-3">{children}</div>}
      {project && onMove && (
        <MoveToDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          projects={projects}
          currentProjectId={project.parentId ?? null}
          excludeIds={moveExclude}
          onMove={onMove}
        />
      )}
    </div>
  )
}

function EntryEditorModal({
  entry,
  projects,
  tagSuggestions,
  onClose,
  onSave,
}: {
  entry: Entry | null
  projects: Project[]
  tagSuggestions: string[]
  onClose: () => void
  onSave: (id: string, patch: EntryPatch) => void
}) {
  const [title, setTitle] = useState("")
  const [language, setLanguage] = useState<Language>("markdown")
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [rawInput, setRawInput] = useState("")
  const [formattedOutput, setFormattedOutput] = useState("")
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(DEFAULT_OPTIONS)
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formatting, setFormatting] = useState(false)

  useEffect(() => {
    if (!entry) return
    setTitle(entry.title)
    setLanguage(entry.language)
    setProjectId(entry.projectId)
    setTags(entry.tags)
    setRawInput(entry.rawInput)
    setFormattedOutput(entry.formattedOutput)
    setFormatOptions(entry.formatOptions ?? DEFAULT_OPTIONS)
    setPinned(entry.pinned)
    setError(null)
  }, [entry])

  const reformat = async () => {
    setFormatting(true)
    setError(null)
    const result = await formatCode(language, rawInput, formatOptions)
    setFormatting(false)
    setFormattedOutput(result.output)
    if (!result.ok) setError(result.error ?? "Could not format this entry.")
  }

  const save = () => {
    if (!entry) return
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError("Title is required.")
      return
    }
    onSave(entry.id, {
      title: nextTitle,
      language,
      rawInput,
      formattedOutput,
      formatterVersion: STRUCTFLOW_FORMATTER_VERSION,
      formatOptions,
      projectId,
      pinned,
      tags,
    })
  }

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Entry details"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Cancel
          </ModalButton>
          <ModalButton onClick={save}>Save changes</ModalButton>
        </>
      }
    >
      <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-compact text-destructive">{error}</div>}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-label uppercase tracking-wide text-muted-foreground">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-pin" className="text-label uppercase tracking-wide text-muted-foreground">Pin</Label>
            <button
              id="edit-pin"
              type="button"
              onClick={() => setPinned((value) => !value)}
              aria-label={pinned ? "Unpin entry" : "Pin entry"}
              className={cn(
                "flex h-9 w-10 items-center justify-center rounded-md border border-border bg-background hover:bg-secondary",
                pinned && "border-primary text-primary",
              )}
            >
              <Star className={cn("h-4 w-4", pinned && "fill-current")} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-language" className="text-label uppercase tracking-wide text-muted-foreground">Language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger id="edit-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-folder" className="text-label uppercase tracking-wide text-muted-foreground">Folder</Label>
            <Select
              value={projectId ?? "__none__"}
              onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="edit-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No folder</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {projectPath(project.id, projects).join(" / ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="gap-1.5 text-label uppercase tracking-wide text-muted-foreground">
            <Tags className="h-3 w-3" /> Tags
          </Label>
          <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="Add tags…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-raw" className="text-label uppercase tracking-wide text-muted-foreground">Raw input</Label>
          <Textarea
            id="edit-raw"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            spellCheck={false}
            className="min-h-35 resize-y font-mono text-compact leading-relaxed"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label font-medium uppercase tracking-wide text-muted-foreground">Formatted output</span>
            <button
              type="button"
              onClick={() => void reformat()}
              disabled={formatting}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-compact font-medium hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", formatting && "animate-spin")} /> Reformat
            </button>
          </div>
          <Textarea
            value={formattedOutput}
            onChange={(e) => setFormattedOutput(e.target.value)}
            spellCheck={false}
            className="min-h-35 resize-y font-mono text-compact leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  )
}


function ModeButton({
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
        "flex items-center gap-1 rounded-md px-2 py-1 text-compact font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function EntryRow({
  entry,
  projects,
  projectLabel,
  menuOpen,
  onMenuToggle,
  onOpen,
  onDelete,
  onRename,
  onMove,
  onTogglePinned,
  onDuplicate,
  onEdit,
}: {
  entry: Entry
  projects: Project[]
  projectLabel: (id: string) => string
  menuOpen: boolean
  onMenuToggle: () => void
  onOpen: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onMove: (projectId: string | null) => void
  onTogglePinned: () => void
  onDuplicate: () => void
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const meta = getLanguage(entry.language)
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `entry:${entry.id}` })

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(entryContent(entry))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  const exportEntry = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadFile(`${slugify(entry.title)}.${meta.ext}`, entryContent(entry), mimeFor(entry.language))
  }

  const submitRename = () => {
    const t = title.trim()
    if (t) onRename(t)
    setRenaming(false)
  }

  // Shared between the row's "⋮" dropdown and its right-click context menu so the
  // two can never drift. Item/Separator/Label are passed in as the matching
  // primitives (DropdownMenu* or ContextMenu*); both share the same item API.
  const menuItems = (Item: React.ElementType, Separator: React.ElementType) => (
    <>
      <Item onSelect={() => onEdit()}>
        <Info className="h-3.5 w-3.5" /> Details
      </Item>
      <Item onSelect={() => setRenaming(true)}>
        <Pencil className="h-3.5 w-3.5" /> Rename
      </Item>
      <Item onSelect={() => onTogglePinned()}>
        <Star className={cn("h-3.5 w-3.5", entry.pinned && "fill-current text-primary")} />
        {entry.pinned ? "Unpin" : "Pin"}
      </Item>
      <Item onSelect={() => onDuplicate()}>
        <CopyPlus className="h-3.5 w-3.5" /> Duplicate
      </Item>
      <Item onSelect={() => setMoveOpen(true)}>
        <FolderInput className="h-3.5 w-3.5" /> Move to…
      </Item>
      <Separator />
      <Item variant="destructive" onSelect={() => onDelete()}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Item>
    </>
  )

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          // The entry owns its right-click menu; stop it bubbling to the library
          // background menu so only the entry menu opens.
          onContextMenu={(e) => e.stopPropagation()}
          className={cn(
            "group relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60",
            isDragging && "opacity-40",
          )}
        >
      {entry.pinned ? (
        <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
      ) : (
        <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start text-left">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename()
              if (e.key === "Escape") setRenaming(false)
            }}
            className="w-full rounded border border-border bg-background px-1 py-0.5 text-body focus:outline-none"
          />
        ) : (
          <span className="w-full truncate text-body font-medium">{entry.title}</span>
        )}
        <span className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span className="rounded bg-secondary px-1 py-px font-mono uppercase">{meta.label}</span>
          {new Date(entry.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        {entry.tags.length > 0 && (
          <span className="mt-1 flex max-w-full gap-1 overflow-hidden">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="max-w-[92px] truncate rounded bg-secondary px-1.5 py-0.5 text-micro text-muted-foreground">
                #{tag}
              </span>
            ))}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
        <RowAction label={entry.pinned ? "Unpin" : "Pin"} onClick={(e) => {
          e.stopPropagation()
          onTogglePinned()
        }}>
          <Star className={cn("h-3.5 w-3.5", entry.pinned && "fill-current text-primary")} />
        </RowAction>
        <RowAction label="Copy" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </RowAction>
        <RowAction label="Export" onClick={exportEntry}>
          <Download className="h-3.5 w-3.5" />
        </RowAction>
        <DropdownMenu open={menuOpen} onOpenChange={(o) => o !== menuOpen && onMenuToggle()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="w-44"
            // A selected item opens a dialog (Edit entry); don't refocus the
            // trigger on close or its Tooltip re-fires over that dialog.
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {menuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
    <MoveToDialog
      open={moveOpen}
      onOpenChange={setMoveOpen}
      projects={projects}
      currentProjectId={entry.projectId ?? null}
      onMove={onMove}
    />
    </>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ModalButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: "primary" | "ghost" | "danger"
}) {
  const mapped = variant === "primary" ? "default" : variant === "ghost" ? "outline" : "destructive"
  return (
    <Button type="button" size="sm" variant={mapped} onClick={onClick}>
      {children}
    </Button>
  )
}

function EmptyLibrary() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-body font-medium">No saved entries yet</p>
        <p className="mt-1 text-compact text-muted-foreground">
          Edit or paste something in the Editor tab, then hit Save to keep it here. Organize entries into folders.
        </p>
        <p className="mt-1 text-compact text-muted-foreground">
          Or drag a folder onto this panel to import it.
        </p>
      </div>
    </div>
  )
}
