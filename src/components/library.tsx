import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
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
} from "lucide-react"
import { Modal } from "./modal"
import { IconButton } from "./icon-button"
import { FloatingTooltip } from "./tooltip"
import { formatCode } from "@/lib/formatter"
import { copyToClipboard, downloadFile, exportEntriesAsZip, importFiles, mimeFor, slugify } from "@/lib/io"
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

/**
 * Place an absolutely-positioned dropdown so it stays inside the scrollable list
 * (the `[data-menu-boundary]` ancestor) instead of being clipped by its
 * `overflow`. Opens on whichever side has more room and caps the height so a long
 * folder list scrolls inside the menu rather than overflowing the container.
 */
function useMenuPlacement(
  menuOpen: boolean,
  btnRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
): { up: boolean; maxHeight: number | null } {
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number | null }>({
    up: false,
    maxHeight: null,
  })
  useLayoutEffect(() => {
    if (!menuOpen) return
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    // `top-full`/`bottom-full` anchor to the offsetParent (the row), not the
    // button, so measure that to keep the JS math aligned with the CSS.
    const anchor = (menu.offsetParent as HTMLElement | null) ?? btn
    const aRect = anchor.getBoundingClientRect()
    const bounds = menu.closest<HTMLElement>("[data-menu-boundary]")?.getBoundingClientRect()
    const gap = 8
    const top = (bounds?.top ?? 0) + gap
    const bottom = (bounds?.bottom ?? window.innerHeight) - gap
    const spaceBelow = bottom - aRect.bottom
    const spaceAbove = aRect.top - top
    const needed = menu.scrollHeight
    let up: boolean
    if (needed <= spaceBelow) up = false
    else if (needed <= spaceAbove) up = true
    else up = spaceAbove > spaceBelow
    const avail = up ? spaceAbove : spaceBelow
    setPlacement({ up, maxHeight: needed > avail ? Math.max(Math.floor(avail), 140) : null })
  }, [menuOpen, btnRef, menuRef])
  return placement
}

type LibraryMode = "all" | "pinned" | "recent"
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string
    entries: Entry[]
    projects: Project[]
    skipped: number
  } | null>(null)
  const [newProjectParent, setNewProjectParent] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

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

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))

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

  const runImport = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return
    setImportError(null)
    try {
      const imported = await importFiles(files)
      if (imported.entries.length === 0) {
        setImportError("No importable files were found.")
        return
      }
      const label =
        files.length === 1
          ? files[0].name
          : `${imported.entries.length} files${imported.projects.length ? ` · ${imported.projects.length} folder(s)` : ""}`
      setPendingImport({
        fileName: label,
        entries: imported.entries,
        projects: imported.projects,
        skipped: imported.skipped,
      })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not import these files.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (folderInputRef.current) folderInputRef.current.value = ""
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    await onImportData(pendingImport.entries, pendingImport.projects)
    setPendingImport(null)
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

  const renderFolder = (project: Project): React.ReactNode => {
    if (visibleDuringSearch && !visibleDuringSearch.has(project.id)) return null
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
        onDelete={() => setDeleteTarget(project)}
      >
        {projectChildren(project.id, projects).map(renderFolder)}
        {items.map(renderEntryRow)}
      </ProjectGroup>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved entries…"
            className="w-full bg-transparent text-[13px] focus:outline-none"
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
          label="Import files (or a StructFlow backup)"
          onClick={() => fileInputRef.current?.click()}
          className="border border-border bg-background"
        >
          <Upload className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Import a folder"
          onClick={() => folderInputRef.current?.click()}
          className="border border-border bg-background"
        >
          <FolderUp className="h-4 w-4" />
        </IconButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.json,.md,.markdown,.txt,.log,.ts,.tsx,.mts,.cts,.js,.jsx,.mjs,.cjs,.json5,.jsonc,.html,.htm,.xml,.svg,.vue,.css,.scss,.sass,.less,.sql"
          className="hidden"
          onChange={(e) => void runImport(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error non-standard but widely supported directory picker
          webkitdirectory=""
          directory=""
          multiple
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
        <div className="border-b border-border px-3 py-2 text-[12.5px] text-destructive">
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

      <div className="min-h-0 flex-1 overflow-auto" data-menu-boundary>
        {entries.length === 0 && projects.length === 0 ? (
          <EmptyLibrary />
        ) : query.trim() && filtered.length === 0 && (visibleDuringSearch?.size ?? 0) === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            Nothing matches “{query}”.
          </div>
        ) : (
          <div className="py-1">
            {projectChildren(null, projects).map(renderFolder)}

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
        )}
      </div>

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
            <p className="text-[12px] text-muted-foreground">
              Inside <span className="font-medium text-foreground">{projectLabel(newProjectParent)}</span>
            </p>
          )}
          <input
            autoFocus
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitProject()}
            placeholder="Folder name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
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
            <p className="text-[13px] text-muted-foreground">
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
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Choose which folders to include. Entries are exported as files, organized into
          folders, inside a single .zip (with a <span className="font-mono">manifest.json</span>).
        </p>
        <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-[13px] font-medium">
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
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[13px] hover:bg-secondary/60"
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
              <span className="shrink-0 text-[11px] text-muted-foreground">
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
          <div className="space-y-2 text-[13px]">
            <p className="text-muted-foreground">
              Ready to import <span className="font-medium text-foreground">{pendingImport.fileName}</span>.
              Imported IDs will be regenerated so existing library items are not overwritten.
            </p>
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
              <p className="text-[12px] text-muted-foreground">
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
  onDelete,
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
  onDelete?: () => void
  children: React.ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project?.name ?? "")
  const [menuOpen, setMenuOpen] = useState(false)
  const [addTooltipOpen, setAddTooltipOpen] = useState(false)
  const [menuTooltipOpen, setMenuTooltipOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)
  const addBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const menuPlacement = useMenuPlacement(menuOpen, menuBtnRef, menuRef)

  if (project === null && count === 0) return null

  const submitRename = () => {
    const n = name.trim()
    if (n && onRename) onRename(n)
    setRenaming(false)
  }

  return (
    <div className="mb-0.5">
      <div className="group relative flex items-center gap-1.5 px-2 py-1.5 hover:bg-secondary/40">
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
            className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 text-[13px] focus:outline-none"
          />
        ) : (
          <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <span className="truncate text-[13px] font-medium">{project ? project.name : "No folder"}</span>
            <span className="text-[11px] text-muted-foreground">{count}</span>
          </button>
        )}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {onAddItem && (
            <button
              ref={addBtnRef}
              type="button"
              onClick={onAddItem}
              aria-label="Add new item"
              onPointerEnter={() => setAddTooltipOpen(true)}
              onPointerLeave={() => setAddTooltipOpen(false)}
              onFocus={() => setAddTooltipOpen(true)}
              onBlur={() => setAddTooltipOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {onAddItem && (
            <FloatingTooltip anchorRef={addBtnRef} label="Add new item" open={addTooltipOpen} />
          )}
          {project && (onRename || onRecolor || onDelete) && (
            <button
              ref={menuBtnRef}
              type="button"
              aria-label="Folder options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              onPointerEnter={() => setMenuTooltipOpen(true)}
              onPointerLeave={() => setMenuTooltipOpen(false)}
              onFocus={() => setMenuTooltipOpen(true)}
              onBlur={() => setMenuTooltipOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          )}
          {project && (onRename || onRecolor || onDelete) && (
            <FloatingTooltip anchorRef={menuBtnRef} label="Folder options" open={menuTooltipOpen && !menuOpen} />
          )}
        </div>

        {menuOpen && project && (
          <div
            ref={menuRef}
            role="menu"
            style={menuPlacement.maxHeight ? { maxHeight: menuPlacement.maxHeight } : undefined}
            className={cn(
              "absolute right-2 z-30 w-48 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-[13px] shadow-xl",
              menuPlacement.up ? "bottom-full mb-1" : "top-full mt-1",
            )}
          >
            {onRename && (
              <MenuItem
                onClick={() => {
                  setName(project.name)
                  setRenaming(true)
                  setMenuOpen(false)
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </MenuItem>
            )}
            {onAddItem && (
              <MenuItem
                onClick={() => {
                  onAddItem()
                  setMenuOpen(false)
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add new item
              </MenuItem>
            )}
            {onAddSubfolder && (
              <MenuItem
                onClick={() => {
                  onAddSubfolder()
                  setMenuOpen(false)
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </MenuItem>
            )}
            {onRecolor && (
              <>
                <div className="my-1 border-t border-border" />
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Color</div>
                <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
                  {PROJECT_COLORS.map((c) => {
                    const active = c === project.color
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Set color ${c}`}
                        onClick={() => {
                          onRecolor(c)
                          setMenuOpen(false)
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
                <div className="my-1 border-t border-border" />
                <MenuItem
                  destructive
                  onClick={() => {
                    onDelete()
                    setMenuOpen(false)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete folder
                </MenuItem>
              </>
            )}
          </div>
        )}
      </div>
      {!collapsed && <div className="pl-3">{children}</div>}
    </div>
  )
}

function EntryEditorModal({
  entry,
  projects,
  onClose,
  onSave,
}: {
  entry: Entry | null
  projects: Project[]
  onClose: () => void
  onSave: (id: string, patch: EntryPatch) => void
}) {
  const [title, setTitle] = useState("")
  const [language, setLanguage] = useState<Language>("markdown")
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tagsInput, setTagsInput] = useState("")
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
    setTagsInput(entry.tags.join(", "))
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
      tags: parseTags(tagsInput),
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
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</div>}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pin</span>
            <button
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
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {LANGUAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Folder</span>
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No folder</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {projectPath(project.id, projects).join(" / ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Tags className="h-3 w-3" /> Tags
          </span>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="api, auth, notes"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Raw input</span>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Formatted output</span>
            <button
              type="button"
              onClick={() => void reformat()}
              disabled={formatting}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[12px] font-medium hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", formatting && "animate-spin")} /> Reformat
            </button>
          </div>
          <textarea
            value={formattedOutput}
            onChange={(e) => setFormattedOutput(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </Modal>
  )
}

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of value.split(/[,\n]/)) {
    const tag = part.trim().replace(/^#/, "")
    const key = tag.toLowerCase()
    if (tag && !seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
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
        "flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors",
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
  const [title, setTitle] = useState(entry.title)
  const [menuTooltipOpen, setMenuTooltipOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)
  const meta = getLanguage(entry.language)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return
      onMenuToggle()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMenuToggle()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen, onMenuToggle])

  const menuPlacement = useMenuPlacement(menuOpen, menuBtnRef, menuRef)

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

  return (
    <div className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60">
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
            className="w-full rounded border border-border bg-background px-1 py-0.5 text-[13px] focus:outline-none"
          />
        ) : (
          <span className="w-full truncate text-[13px] font-medium">{entry.title}</span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-secondary px-1 py-px font-mono uppercase">{meta.label}</span>
          {new Date(entry.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        {entry.tags.length > 0 && (
          <span className="mt-1 flex max-w-full gap-1 overflow-hidden">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="max-w-[92px] truncate rounded bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
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
        <button
          ref={menuBtnRef}
          type="button"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onPointerEnter={() => setMenuTooltipOpen(true)}
          onPointerLeave={() => setMenuTooltipOpen(false)}
          onFocus={() => setMenuTooltipOpen(true)}
          onBlur={() => setMenuTooltipOpen(false)}
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <FloatingTooltip anchorRef={menuBtnRef} label="More actions" open={menuTooltipOpen && !menuOpen} />

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          style={menuPlacement.maxHeight ? { maxHeight: menuPlacement.maxHeight } : undefined}
          className={cn(
            "absolute right-2 z-30 w-44 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-[13px] shadow-xl",
            menuPlacement.up ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <MenuItem
            onClick={() => {
              onEdit()
              onMenuToggle()
            }}
          >
            <Info className="h-3.5 w-3.5" /> Details
          </MenuItem>
          <MenuItem
            onClick={() => {
              setRenaming(true)
              onMenuToggle()
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </MenuItem>
          <MenuItem
            onClick={() => {
              onTogglePinned()
              onMenuToggle()
            }}
          >
            <Star className={cn("h-3.5 w-3.5", entry.pinned && "fill-current text-primary")} />
            {entry.pinned ? "Unpin" : "Pin"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onDuplicate()
              onMenuToggle()
            }}
          >
            <CopyPlus className="h-3.5 w-3.5" /> Duplicate
          </MenuItem>
          <div className="my-1 border-t border-border" />
          <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Move to</div>
          <MenuItem
            onClick={() => {
              onMove(null)
              onMenuToggle()
            }}
          >
            <Inbox className="h-3.5 w-3.5" /> No folder
          </MenuItem>
          {projects.map((p) => (
            <MenuItem
              key={p.id}
              onClick={() => {
                onMove(p.id)
                onMenuToggle()
              }}
            >
              <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
              <span className="min-w-0 truncate">{projectLabel(p.id)}</span>
            </MenuItem>
          ))}
          <div className="my-1 border-t border-border" />
          <MenuItem
            destructive
            onClick={() => {
              onDelete()
              onMenuToggle()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </MenuItem>
        </div>
      )}
    </div>
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
  const ref = useRef<HTMLButtonElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={onClick}
        onPointerEnter={() => setShowTooltip(true)}
        onPointerLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        {children}
      </button>
      <FloatingTooltip anchorRef={ref} label={label} open={showTooltip} />
    </>
  )
}

function MenuItem({
  onClick,
  children,
  destructive,
}: {
  onClick: () => void
  children: React.ReactNode
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary",
        destructive && "text-destructive",
      )}
    >
      {children}
    </button>
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "ghost" && "border border-border bg-background hover:bg-secondary",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
      )}
    >
      {children}
    </button>
  )
}

function EmptyLibrary() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[14px] font-medium">No saved entries yet</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Format something in the Formatter tab, then hit Save to keep it here. Organize entries into folders.
        </p>
      </div>
    </div>
  )
}
