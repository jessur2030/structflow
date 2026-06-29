import { useEffect, useMemo, useRef, useState } from "react"
import { ListTree, FileCode, Eye, Columns2, Search, Maximize2, Minimize2, AlertCircle } from "lucide-react"
import { CodeEditor } from "./code-editor"
import { MarkdownPreview } from "./markdown-preview"
import { JsonTree } from "./json-tree"
import { DiffView } from "./diff-view"
import { IconButton } from "./icon-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { validate } from "@/lib/formatter"
import type { FormatOptions, Language } from "@/lib/types"
import { cn } from "@/lib/utils"

export type Mode = "edit" | "preview" | "tree" | "diff"

interface EditorSurfaceProps {
  input: string
  onChangeInput: (value: string) => void
  language: Language
  options: FormatOptions
  syntaxThemeId: string
  mode: Mode
  onChangeMode: (mode: Mode) => void
  /** Forwarded to the editor: auto-detect language when pasting into an empty buffer. */
  onDetectLanguage?: (lang: Language) => void
  /** A format error from the parent (e.g. failed Format & Beautify), shown inline in edit mode. */
  error?: string | null
  compact?: boolean
  editorFontSize?: number
  editorAutoFocus?: boolean
}

/**
 * The single content surface shared by the main formatter and the fullscreen
 * Full view. One editable CodeMirror buffer plus derived modes (Preview / Tree /
 * Diff) toggled over the same area — replacing the old INPUT/OUTPUT split.
 */
export function EditorSurface({
  input,
  onChangeInput,
  language,
  options,
  syntaxThemeId,
  mode,
  onChangeMode,
  onDetectLanguage,
  error,
  compact = false,
  editorFontSize,
  editorAutoFocus,
}: EditorSurfaceProps) {
  const [search, setSearch] = useState("")
  const [wrap, setWrap] = useState(language === "markdown" || language === "text")
  const [treeExpansion, setTreeExpansion] = useState<{ expandAll: boolean | null; version: number }>({
    expandAll: null,
    version: 0,
  })

  const parsedJson = useMemo(() => {
    if (language !== "json" || !input.trim()) return null
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }, [language, input])

  const canTree = language === "json" && parsedJson !== null
  const canPreview = language === "markdown"
  const canDiff = language !== "text"

  const jsonMatchCount = useMemo(
    () => (canTree ? countJsonMatches(parsedJson, search.trim().toLowerCase()) : 0),
    [canTree, parsedJson, search],
  )

  // Keep the active mode valid for the current language.
  useEffect(() => {
    if (mode === "tree" && !canTree) onChangeMode("edit")
    else if (mode === "preview" && !canPreview) onChangeMode("edit")
    else if (mode === "diff" && !canDiff) onChangeMode("edit")
  }, [mode, canTree, canPreview, canDiff, onChangeMode])

  const setTreeOpenState = (expandAll: boolean) =>
    setTreeExpansion((c) => ({ expandAll, version: c.version + 1 }))

  const liveError = error ?? (input.trim() ? validate(language, input).error : undefined)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <div className="flex rounded-md border border-border p-0.5">
          <ModeToggle active={mode === "edit"} onClick={() => onChangeMode("edit")} label="Edit">
            <FileCode className="h-3.5 w-3.5" />
          </ModeToggle>
          {canPreview && (
            <ModeToggle active={mode === "preview"} onClick={() => onChangeMode("preview")} label="Preview">
              <Eye className="h-3.5 w-3.5" />
            </ModeToggle>
          )}
          {canTree && (
            <ModeToggle active={mode === "tree"} onClick={() => onChangeMode("tree")} label="Tree view">
              <ListTree className="h-3.5 w-3.5" />
            </ModeToggle>
          )}
          {canDiff && (
            <ModeToggle active={mode === "diff"} onClick={() => onChangeMode("diff")} label="Diff (changes from formatting)">
              <Columns2 className="h-3.5 w-3.5" />
            </ModeToggle>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {mode === "edit" && (
            <IconButton label={wrap ? "Disable wrap" : "Enable wrap"} active={wrap} onClick={() => setWrap((w) => !w)}>
              <span className="text-micro font-bold">↵</span>
            </IconButton>
          )}
        </div>
      </div>

      {mode === "tree" && canTree && (
        <div className="border-b border-border px-3 py-1.5">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys and values…"
              className="w-full bg-transparent text-compact focus:outline-none"
            />
            {search.trim() && (
              <span className="shrink-0 text-label tabular-nums text-muted-foreground">{jsonMatchCount}</span>
            )}
            <IconButton label="Expand all" onClick={() => setTreeOpenState(true)} className="h-6 w-6">
              <Maximize2 className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Collapse all" onClick={() => setTreeOpenState(false)} className="h-6 w-6">
              <Minimize2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      )}

      {mode === "edit" && liveError && (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/5 px-3 py-2 text-compact text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{liveError}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "tree" && canTree ? (
          <div className="h-full overflow-auto">
            <JsonTree
              data={parsedJson}
              search={search}
              syntaxThemeId={syntaxThemeId}
              expandAll={treeExpansion.expandAll}
              expandVersion={treeExpansion.version}
            />
          </div>
        ) : mode === "preview" && canPreview ? (
          <div className="h-full overflow-auto">
            {input.trim() ? (
              <div className={cn(compact ? "px-3 py-3" : "mx-auto max-w-7xl px-6 py-6")}>
                <MarkdownPreview source={input} syntaxThemeId={syntaxThemeId} />
              </div>
            ) : (
              <EmptyHint>Nothing to preview yet. Switch to Edit and start writing.</EmptyHint>
            )}
          </div>
        ) : mode === "diff" && canDiff ? (
          <div className="h-full overflow-auto">
            {input.trim() ? (
              <DiffView input={input} language={language} options={options} syntaxThemeId={syntaxThemeId} />
            ) : (
              <EmptyHint>Nothing to compare yet.</EmptyHint>
            )}
          </div>
        ) : (
          <CodeEditor
            value={input}
            onChange={onChangeInput}
            language={language}
            syntaxThemeId={syntaxThemeId}
            onDetectLanguage={onDetectLanguage}
            wrap={wrap}
            autoFocus={editorAutoFocus}
            fontSize={editorFontSize}
          />
        )}
      </div>
    </div>
  )
}

function ModeToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "flex h-6 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors",
            active && "bg-secondary text-foreground",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-10 text-center text-body text-muted-foreground">{children}</p>
}

export function countJsonMatches(value: unknown, search: string, path = "$", keyName: string | null = null): number {
  if (!search) return 0
  const nodeMatches =
    path.toLowerCase().includes(search) ||
    (keyName != null && keyName.toLowerCase().includes(search)) ||
    (value === null || typeof value !== "object" ? String(value).toLowerCase().includes(search) : false)

  if (value === null || typeof value !== "object") {
    return nodeMatches ? 1 : 0
  }

  let count = nodeMatches ? 1 : 0
  const isArray = Array.isArray(value)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = isArray
      ? `${path}[${key}]`
      : /^[A-Za-z_$][\w$]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`
    count += countJsonMatches(child, search, childPath, key)
  }
  return count
}
