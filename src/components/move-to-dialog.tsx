import { useMemo } from "react"
import { Folder, Inbox, Check } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command"
import { projectChildren, projectPath, type Project } from "@/lib/types"

/**
 * Searchable "Move to folder" picker (Notion-style): a tree of folders you can type
 * to filter, showing each folder's full ancestor path so deep destinations are never
 * ambiguous. Replaces the old inline menu list whose paths truncated to "develop…".
 */
export function MoveToDialog({
  open,
  onOpenChange,
  projects,
  currentProjectId,
  onMove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  /** The entry/item's current folder, marked with a check (null = No folder). */
  currentProjectId: string | null
  onMove: (projectId: string | null) => void
}) {
  // Pre-order the folder tree so children sit under their parent, each with a depth
  // for indentation. Siblings sorted by name for a stable, scannable order.
  const rows = useMemo(() => {
    const out: { project: Project; depth: number }[] = []
    const walk = (parentId: string | null, depth: number) => {
      const children = [...projectChildren(parentId, projects)].sort((a, b) => a.name.localeCompare(b.name))
      for (const project of children) {
        out.push({ project, depth })
        walk(project.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [projects])

  const choose = (id: string | null) => {
    onMove(id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[380px]">
        <DialogTitle className="sr-only">Move to folder</DialogTitle>
        <Command>
          <CommandInput placeholder="Move to folder…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No folders found.</CommandEmpty>
            <CommandItem value="No folder" onSelect={() => choose(null)}>
              <Inbox className="size-4" />
              <span className="flex-1">No folder</span>
              {currentProjectId == null && <Check className="size-3.5 shrink-0 text-primary" />}
            </CommandItem>
            {rows.map(({ project, depth }) => {
              const parent = projectPath(project.id, projects).slice(0, -1).join(" / ")
              return (
                <CommandItem
                  key={project.id}
                  // Search matches on the full path, so typing an ancestor or the leaf both work.
                  value={projectPath(project.id, projects).join(" / ")}
                  onSelect={() => choose(project.id)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: depth * 14 }}>
                    <Folder className="size-4 shrink-0" style={{ color: project.color }} />
                    <span className="truncate">{project.name}</span>
                  </span>
                  {parent && (
                    <span className="max-w-[46%] shrink-0 truncate pl-2 text-micro text-muted-foreground">{parent}</span>
                  )}
                  {currentProjectId === project.id && <Check className="ml-1 size-3.5 shrink-0 text-primary" />}
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
