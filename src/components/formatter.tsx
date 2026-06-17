import { useEffect, useMemo, useState } from "react"
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
} from "lucide-react"
import { LanguageSelect } from "./language-select"
import { OptionsPanel } from "./options-panel"
import { CodeView } from "./code-view"
import { JsonTree } from "./json-tree"
import { MarkdownPreview } from "./markdown-preview"
import { SnapshotModal } from "./snapshot-modal"
import { IconButton } from "./icon-button"
import { formatCode, validate } from "@/lib/formatter"
import { copyToClipboard, downloadFile, mimeFor, slugify } from "@/lib/io"
import { DEFAULT_OPTIONS, getLanguage, type FormatOptions, type Language } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "tree" | "formatted" | "preview"

interface FormatterProps {
  language: Language
  setLanguage: (l: Language) => void
  input: string
  setInput: (v: string) => void
  onRequestSave: (content: string, language: Language) => void
  syntaxThemeId: string
}

const OPTS_KEY = "structflow_options"

function loadOptions(): FormatOptions {
  try {
    const raw = localStorage.getItem(OPTS_KEY)
    if (raw) return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) }
  } catch {
    // ignore
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

  const meta = getLanguage(language)
  const liveStatus = useMemo(() => validate(language, input), [language, input])

  useEffect(() => {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(options))
    } catch {
      // ignore
    }
  }, [options])

  // Auto-format on input/option/language change (debounced).
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

  // Keep view valid when switching languages.
  useEffect(() => {
    if (view === "tree" && !canTree) setView("formatted")
    if (view === "preview" && !canPreview) setView("formatted")
  }, [canTree, canPreview, view])

  const handleCopy = async () => {
    const ok = await copyToClipboard(output || input)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1300)
    }
  }

  const handleExport = () => {
    const name = `${slugify(input.slice(0, 30) || meta.label)}.${meta.ext}`
    downloadFile(name, output || input, mimeFor(language))
  }

  const handleFormatNow = async () => {
    const res = await formatCode(language, input, options)
    if (res.ok) {
      setOutput(res.output)
      setInput(res.output)
      setError(null)
    } else {
      setError(res.error ?? "Could not format input.")
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
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
          <IconButton label="Save to library" onClick={() => onRequestSave(output || input, language)} disabled={!input}>
            <Save className="h-4 w-4" />
          </IconButton>
          <IconButton label="Clear" onClick={() => setInput("")} disabled={!input}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {showOptions && <OptionsPanel language={language} options={options} onChange={setOptions} />}

      {/* Input */}
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

      {/* Output */}
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
            <JsonTree data={parsedJson} search={search} syntaxThemeId={syntaxThemeId} />
          ) : canPreview && view === "preview" ? (
            <MarkdownPreview source={output} />
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
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-6 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
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
