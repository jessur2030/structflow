import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Wand2,
  Copy,
  Check,
  Download,
  Save,
  Camera,
  Trash2,
  Settings2,
  ListTree,
  FileText,
  Eye,
  Search,
  AlertCircle,
  CheckCircle2,
  Columns2,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { LanguageSelect } from "./language-select"
import { OptionsPanel } from "./options-panel"
import { CodeView } from "./code-view"
import { JsonTree } from "./json-tree"
import { MarkdownPreview } from "./markdown-preview"
import { CompareView } from "./compare-view"
import { SnapshotModal } from "./snapshot-modal"
import { IconButton } from "./icon-button"
import { FloatingTooltip } from "./tooltip"
import { formatCode, validate } from "@/lib/formatter"
import { copyToClipboard, downloadFile, mimeFor, slugify } from "@/lib/io"
import { DEFAULT_OPTIONS, getLanguage, type FormatOptions, type Language } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "tree" | "formatted" | "preview" | "compare"

export interface SaveEntryPayload {
  rawInput: string
  formattedOutput: string
  language: Language
  formatOptions: FormatOptions
}

interface FormatterProps {
  language: Language
  setLanguage: (l: Language) => void
  input: string
  setInput: (v: string) => void
  onRequestSave: (payload: SaveEntryPayload) => void
  syntaxThemeId: string
}

const OPTS_KEY = "structflow_options"

function loadOptions(): FormatOptions {
  try {
    const raw = localStorage.getItem(OPTS_KEY)
    if (raw) return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) }
  } catch {
  }
  return DEFAULT_OPTIONS
}

export function Formatter({ language, setLanguage, input, setInput, onRequestSave, syntaxThemeId }: FormatterProps) {
  const [options, setOptions] = useState<FormatOptions>(loadOptions)
  const [showOptions, setShowOptions] = useState(false)
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("formatted")
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState(false)
  const [wrap, setWrap] = useState(false)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [treeExpansion, setTreeExpansion] = useState<{ expandAll: boolean | null; version: number }>({
    expandAll: null,
    version: 0,
  })

  const meta = getLanguage(language)
  const liveStatus = useMemo(() => validate(language, input), [language, input])

  useEffect(() => {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(options))
    } catch {
    }
  }, [options])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await formatCode(language, input, options)
      if (cancelled) return
      if (res.ok) {
        setOutput(res.output)
        setError(null)
      } else {
        setOutput(input)
        setError(res.error ?? "Could not format input.")
      }
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [language, input, options])

  const parsedJson = useMemo(() => {
    if (language !== "json" || !output) return null
    try {
      return JSON.parse(output)
    } catch {
      return null
    }
  }, [language, output])

  const canTree = language === "json" && parsedJson !== null
  const canPreview = language === "markdown"
  const jsonMatchCount = useMemo(
    () => (canTree ? countJsonMatches(parsedJson, search.trim().toLowerCase()) : 0),
    [canTree, parsedJson, search],
  )

  useEffect(() => {
    if (view === "tree" && !canTree) setView("formatted")
    if (view === "preview" && !canPreview) setView("formatted")
  }, [canTree, canPreview, view])

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(output || input)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1300)
    }
  }, [input, output])

  const handleExport = () => {
    const name = `${slugify(input.slice(0, 30) || meta.label)}.${meta.ext}`
    downloadFile(name, output || input, mimeFor(language))
  }

  const handleFormatNow = useCallback(async () => {
    const res = await formatCode(language, input, options)
    if (res.ok) {
      setOutput(res.output)
      setInput(res.output)
      setError(null)
    } else {
      setError(res.error ?? "Could not format input.")
    }
  }, [input, language, options, setInput])

  const handleSave = useCallback(() => {
    if (!input.trim()) return
    onRequestSave({
      rawInput: input,
      formattedOutput: output || input,
      language,
      formatOptions: options,
    })
  }, [input, language, onRequestSave, options, output])

  const handleClear = useCallback(() => {
    setInput("")
    setOutput("")
    setError(null)
  }, [setInput])

  const setTreeOpenState = (expandAll: boolean) => {
    setTreeExpansion((current) => ({ expandAll, version: current.version + 1 }))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod || event.isComposing) return

      if (event.key === "Enter") {
        event.preventDefault()
        void handleFormatNow()
        return
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault()
        handleSave()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault()
        void handleCopy()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === "p" && canPreview) {
        event.preventDefault()
        setView((current) => (current === "preview" ? "formatted" : "preview"))
        return
      }

      if (event.shiftKey && event.key === "Backspace") {
        event.preventDefault()
        handleClear()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canPreview, handleClear, handleCopy, handleFormatNow, handleSave])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <LanguageSelect value={language} onChange={setLanguage} />
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Format options" active={showOptions} onClick={() => setShowOptions((s) => !s)}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Copy result" onClick={handleCopy} disabled={!input}>
            {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Export to file" onClick={handleExport} disabled={!input}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton label="Code snapshot" onClick={() => setShowSnapshot(true)} disabled={!input}>
            <Camera className="h-4 w-4" />
          </IconButton>
          <IconButton label="Save to library" onClick={handleSave} disabled={!input}>
            <Save className="h-4 w-4" />
          </IconButton>
          <IconButton label="Clear" onClick={handleClear} disabled={!input}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {showOptions && <OptionsPanel language={language} options={options} onChange={setOptions} />}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Input</span>
          <StatusPill status={liveStatus} empty={!input.trim()} />
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder={`Paste or type ${meta.label} here…`}
          className={cn(
            "min-h-[120px] flex-1 resize-none bg-background px-3 py-3 font-mono text-[12.5px] leading-[1.6]",
            "placeholder:text-muted-foreground/60 focus:outline-none",
          )}
        />
        <button
          type="button"
          onClick={handleFormatNow}
          disabled={!input.trim()}
          className={cn(
            "mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-[13px] font-medium text-primary-foreground transition-opacity",
            "hover:opacity-90 disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Format &amp; Beautify
        </button>
      </div>

      <div className="flex min-h-0 flex-[1.4] flex-col border-t border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Output</span>
          <div className="ml-auto flex items-center gap-1">
            {canTree && (
              <div className="flex rounded-md border border-border p-0.5">
                <ViewToggle active={view === "tree"} onClick={() => setView("tree")} label="Tree view">
                  <ListTree className="h-3.5 w-3.5" />
                </ViewToggle>
                <ViewToggle active={view === "formatted"} onClick={() => setView("formatted")} label="Text view">
                  <FileText className="h-3.5 w-3.5" />
                </ViewToggle>
              </div>
            )}
            {canPreview && (
              <div className="flex rounded-md border border-border p-0.5">
                <ViewToggle active={view === "formatted"} onClick={() => setView("formatted")} label="Source view">
                  <FileText className="h-3.5 w-3.5" />
                </ViewToggle>
                <ViewToggle active={view === "preview"} onClick={() => setView("preview")} label="Rendered preview">
                  <Eye className="h-3.5 w-3.5" />
                </ViewToggle>
              </div>
            )}
            <div className="flex rounded-md border border-border p-0.5">
              <ViewToggle active={view === "compare"} onClick={() => setView("compare")} label="Compare input and output">
                <Columns2 className="h-3.5 w-3.5" />
              </ViewToggle>
            </div>
            {view === "formatted" && (
              <IconButton label={wrap ? "Disable wrap" : "Enable wrap"} active={wrap} onClick={() => setWrap((w) => !w)}>
                <span className="text-[10px] font-bold">↵</span>
              </IconButton>
            )}
          </div>
        </div>

        {canTree && view === "tree" && (
          <div className="border-b border-border px-3 py-1.5">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search keys and values…"
                className="w-full bg-transparent text-[12.5px] focus:outline-none"
              />
              {search.trim() && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{jsonMatchCount}</span>
              )}
              <IconButton
                label="Expand all"
                onClick={() => setTreeOpenState(true)}
                className="h-6 w-6"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Collapse all"
                onClick={() => setTreeOpenState(false)}
                className="h-6 w-6"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <div className="flex items-start gap-2 px-3 py-3 text-[12.5px] text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          ) : !input.trim() ? (
            <EmptyState label={meta.label} />
          ) : canTree && view === "tree" ? (
            <JsonTree
              data={parsedJson}
              search={search}
              syntaxThemeId={syntaxThemeId}
              expandAll={treeExpansion.expandAll}
              expandVersion={treeExpansion.version}
            />
          ) : canPreview && view === "preview" ? (
            <MarkdownPreview source={output} syntaxThemeId={syntaxThemeId} />
          ) : view === "compare" ? (
            <CompareView input={input} output={output} syntaxThemeId={syntaxThemeId} />
          ) : (
            <CodeView code={output} language={language} wrap={wrap} syntaxThemeId={syntaxThemeId} />
          )}
        </div>
      </div>

      {showSnapshot && (
        <SnapshotModal
          code={output || input}
          language={language}
          syntaxThemeId={syntaxThemeId}
          defaultTitle={`${slugify(input.slice(0, 24) || meta.label)}.${meta.ext}`}
          onClose={() => setShowSnapshot(false)}
        />
      )}
    </div>
  )
}

function countJsonMatches(value: unknown, search: string, path = "$", keyName: string | null = null): number {
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

function StatusPill({ status, empty }: { status: { ok: boolean; error?: string }; empty: boolean }) {
  if (empty) return null
  if (status.ok) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--success)]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Valid
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-destructive">
      <AlertCircle className="h-3.5 w-3.5" /> Invalid
    </span>
  )
}

function ViewToggle({
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
        className={cn(
          "flex h-6 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
          active && "bg-secondary text-foreground",
        )}
      >
        {children}
      </button>
      <FloatingTooltip anchorRef={ref} label={label} open={showTooltip} />
    </>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <FileText className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-[13px] text-muted-foreground">
        Formatted {label} appears here as you type.
      </p>
    </div>
  )
}
