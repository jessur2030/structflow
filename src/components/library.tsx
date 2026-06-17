import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
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
} from "lucide-react"
import { Modal } from "./modal"
import { copyToClipboard, downloadFile, exportEntriesAsZip, importEntriesFromFile, mimeFor, slugify } from "@/lib/io"
import { entryContent, getLanguage, PROJECT_COLORS, type Entry, type Project } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LibraryProps {
  entries: Entry[]
  projects: Project[]
  onOpenEntry: (entry: Entry) => void
  onDeleteEntry: (id: string) => void
  onRenameEntry: (id: string, title: string) => void
  onMoveEntry: (id: string, projectId: string | null) => void
  onCreateProject: (name: string) => void
  onRenameProject: (id: string, name: string) => void
  onRecolorProject: (id: string, color: string) => void
  onAddToProject: (projectId: string | null) => void
  onImportData: (entries: Entry[], projects: Project[]) => Promise<void>
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
  onDeleteProject,
}: LibraryProps) {
  const [query, setQuery] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string
    entries: Entry[]
    projects: Project[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        entryContent(e).toLowerCase().includes(q) ||
        e.rawInput.toLowerCase().includes(q) ||
        e.language.toLowerCase().includes(q),
    )
  }, [entries, query])

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
      onCreateProject(name)
      setProjectName("")
      setNewProjectOpen(false)
    }
  }

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
        ? [{ key: "__none__", name: "No project", color: null as string | null, count: countsByKey.__none__ }]
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

  const runImport = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    try {
      const imported = await importEntriesFromFile(file)
      setPendingImport({ fileName: file.name, entries: imported.entries, projects: imported.projects })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not import StructFlow data.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    await onImportData(pendingImport.entries, pendingImport.projects)
    setPendingImport(null)
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
        <button
          type="button"
          onClick={openExport}
          disabled={entries.length === 0}
          aria-label="Export data"
          title="Export data"
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Archive className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import data"
          title="Import data"
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] font-medium hover:bg-secondary"
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          className="hidden"
          onChange={(e) => void runImport(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          aria-label="New project"
          title="New project"
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] font-medium hover:bg-secondary"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      {importError && (
        <div className="border-b border-border px-3 py-2 text-[12.5px] text-destructive">
          {importError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <EmptyLibrary />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            No entries match “{query}”.
          </div>
        ) : (
          <div className="py-1">
            {projects.map((project) => {
              const items = groups.get(project.id) ?? []
              const isCollapsed = collapsed[project.id]
              return (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  count={items.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggle(project.id)}
                  onRename={(name) => onRenameProject(project.id, name)}
                  onRecolor={(color) => onRecolorProject(project.id, color)}
                  onAddItem={() => onAddToProject(project.id)}
                  onDelete={() => onDeleteProject(project.id)}
                >
                  {items.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      projects={projects}
                      menuOpen={menuFor === entry.id}
                      onMenuToggle={() => setMenuFor((m) => (m === entry.id ? null : entry.id))}
                      onOpen={() => onOpenEntry(entry)}
                      onDelete={() => onDeleteEntry(entry.id)}
                      onRename={(t) => onRenameEntry(entry.id, t)}
                      onMove={(pid) => onMoveEntry(entry.id, pid)}
                    />
                  ))}
                </ProjectGroup>
              )
            })}

            <ProjectGroup
              project={null}
              count={ungrouped.length}
              collapsed={collapsed["__none__"]}
              onToggle={() => toggle("__none__")}
              onAddItem={() => onAddToProject(null)}
            >
              {ungrouped.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  projects={projects}
                  menuOpen={menuFor === entry.id}
                  onMenuToggle={() => setMenuFor((m) => (m === entry.id ? null : entry.id))}
                  onOpen={() => onOpenEntry(entry)}
                  onDelete={() => onDeleteEntry(entry.id)}
                  onRename={(t) => onRenameEntry(entry.id, t)}
                  onMove={(pid) => onMoveEntry(entry.id, pid)}
                />
              ))}
            </ProjectGroup>
          </div>
        )}
      </div>

      <Modal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        title="New project"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </ModalButton>
            <ModalButton onClick={submitProject}>Create</ModalButton>
          </>
        }
      >
        <input
          autoFocus
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitProject()}
          placeholder="Project name"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
            className="h-4 w-4 accent-[var(--primary)]"
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
                className="h-4 w-4 accent-[var(--primary)]"
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
                <span>Projects</span>
                <span className="font-mono text-muted-foreground">{pendingImport.projects.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Entries</span>
                <span className="font-mono text-muted-foreground">{pendingImport.entries.length}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
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
  onDelete?: () => void
  children: React.ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project?.name ?? "")
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuUp, setMenuUp] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

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

  useLayoutEffect(() => {
    if (!menuOpen) return
    const btn = menuBtnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const spaceBelow = window.innerHeight - btn.getBoundingClientRect().bottom
    setMenuUp(spaceBelow < menu.offsetHeight + 12)
  }, [menuOpen])

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
            <span className="truncate text-[13px] font-medium">{project ? project.name : "No project"}</span>
            <span className="text-[11px] text-muted-foreground">{count}</span>
          </button>
        )}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {onAddItem && (
            <button
              type="button"
              onClick={onAddItem}
              aria-label="Add new item"
              title="Add new item"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {project && (onRename || onRecolor || onDelete) && (
            <button
              ref={menuBtnRef}
              type="button"
              aria-label="Project options"
              title="Project options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {menuOpen && project && (
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              "absolute right-2 z-30 w-48 overflow-hidden rounded-lg border border-border bg-popover py-1 text-[13px] shadow-xl",
              menuUp ? "bottom-full mb-1" : "top-full mt-1",
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

function EntryRow({
  entry,
  projects,
  menuOpen,
  onMenuToggle,
  onOpen,
  onDelete,
  onRename,
  onMove,
}: {
  entry: Entry
  projects: Project[]
  menuOpen: boolean
  onMenuToggle: () => void
  onOpen: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onMove: (projectId: string | null) => void
}) {
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [menuUp, setMenuUp] = useState(false)
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

  useLayoutEffect(() => {
    if (!menuOpen) return
    const btn = menuBtnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const spaceBelow = window.innerHeight - btn.getBoundingClientRect().bottom
    setMenuUp(spaceBelow < menu.offsetHeight + 12)
  }, [menuOpen])

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
      <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      </button>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
        <RowAction label="Copy" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
        </RowAction>
        <RowAction label="Export" onClick={exportEntry}>
          <Download className="h-3.5 w-3.5" />
        </RowAction>
        <button
          ref={menuBtnRef}
          type="button"
          aria-label="More"
          title="More"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute right-2 z-30 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 text-[13px] shadow-xl",
            menuUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <MenuItem
            onClick={() => {
              setRenaming(true)
              onMenuToggle()
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </MenuItem>
          <div className="my-1 border-t border-border" />
          <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Move to</div>
          <MenuItem
            onClick={() => {
              onMove(null)
              onMenuToggle()
            }}
          >
            <Inbox className="h-3.5 w-3.5" /> No project
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
              <span className="min-w-0 truncate">{p.name}</span>
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
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
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
  variant?: "primary" | "ghost"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border bg-background hover:bg-secondary",
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
          Format something in the Formatter tab, then hit Save to keep it here. Organize entries into projects.
        </p>
      </div>
    </div>
  )
}
