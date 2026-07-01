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
  AlertCircle,
  CheckCircle2,
  Maximize2,
  MoreVertical,
  FilePlus,
  Sparkles,
  Star,
  Folder,
  Inbox,
  CopyPlus,
  Tags as TagsIcon,
} from "lucide-react"
import { LanguageSelect } from "./language-select"
import { OptionsPanel } from "./options-panel"
import { SnapshotModal } from "./snapshot-modal"
import { FocusView } from "./focus-view"
import { EditorSurface, type Mode } from "./editor-surface"
import { IconButton } from "./icon-button"
import { TagsInput } from "./tags-input"
import { MoveToDialog } from "./move-to-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { formatCode, validate } from "@/lib/formatter"
import { copyToClipboard, downloadFile, mimeFor, slugify } from "@/lib/io"
import {
  DEFAULT_OPTIONS,
  getLanguage,
  type Entry,
  type FormatOptions,
  type Language,
  type Project,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SaveEntryPayload {
  rawInput: string
  formattedOutput: string
  language: Language
  formatOptions: FormatOptions
}

interface EditorProps {
  language: Language
  setLanguage: (l: Language) => void
  input: string
  setInput: (v: string) => void
  onRequestSave: (payload: SaveEntryPayload) => void
  syntaxThemeId: string
  /** The library entry the live doc is linked to, or null for an unsaved buffer. */
  currentEntry: Entry | null
  projects: Project[]
  /** Tags used across the library, for autocomplete in the identity bar. */
  tagSuggestions: string[]
  onUpdateCurrent: (patch: Partial<Entry>) => void
  onDuplicateCurrent: () => void
  onDeleteCurrent: () => void
  onDetachCurrent: () => void
  /** Start a fresh, empty entry without leaving the Editor (confirms in App if a
   *  non-empty unsaved scratch would be lost). */
  onNewEntry: () => void
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

export function Editor({
  language,
  setLanguage,
  input,
  setInput,
  onRequestSave,
  syntaxThemeId,
  currentEntry,
  projects,
  tagSuggestions,
  onUpdateCurrent,
  onDuplicateCurrent,
  onDeleteCurrent,
  onDetachCurrent,
  onNewEntry,
}: EditorProps) {
  const [options, setOptions] = useState<FormatOptions>(loadOptions)
  const [showOptions, setShowOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Markdown is note-first, so default to the rendered preview; everything else
  // opens in the editor.
  const [mode, setMode] = useState<Mode>(() =>
    language === "markdown" && input.trim() ? "preview" : "edit",
  )
  // An empty buffer can't be previewed (Preview shows a dead-end placeholder) and
  // isn't editable in Preview either, so the only way it goes empty here is an
  // external action — New entry, Clear, or opening an empty doc. Drop to Edit so you
  // can start writing immediately instead of staring at "Nothing to preview yet".
  useEffect(() => {
    if (mode === "preview" && !input.trim()) setMode("edit")
  }, [mode, input])
  const [copied, setCopied] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [detectChip, setDetectChip] = useState<{ from: Language; to: Language } | null>(null)
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [snapshotCode, setSnapshotCode] = useState("")
  const [showFocus, setShowFocus] = useState(false)

  const meta = getLanguage(language)
  const liveStatus = useMemo(() => validate(language, input), [language, input])
  const canPreview = language === "markdown"
  const currentFolder =
    currentEntry && currentEntry.projectId ? projects.find((p) => p.id === currentEntry.projectId) ?? null : null

  useEffect(() => {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(options))
    } catch {
    }
  }, [options])

  // Clear a stale format error once the user edits or switches language/options.
  useEffect(() => {
    setError(null)
  }, [input, language, options])

  // Auto-detect on paste sets the language and offers a quick Undo.
  const handleDetectLanguage = useCallback(
    (detected: Language) => {
      if (detected === language) return
      setLanguage(detected)
      setDetectChip({ from: language, to: detected })
      if (chipTimer.current) clearTimeout(chipTimer.current)
      chipTimer.current = setTimeout(() => setDetectChip(null), 6000)
    },
    [language, setLanguage],
  )

  // Dismiss the chip when the language changes for any other reason.
  useEffect(() => {
    setDetectChip((c) => (c && c.to !== language ? null : c))
  }, [language])

  useEffect(() => () => void (chipTimer.current && clearTimeout(chipTimer.current)), [])

  const undoDetect = useCallback(() => {
    if (detectChip) setLanguage(detectChip.from)
    setDetectChip(null)
    if (chipTimer.current) clearTimeout(chipTimer.current)
  }, [detectChip, setLanguage])

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(input)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1300)
    }
  }, [input])

  const handleExport = () => {
    const name = `${slugify(input.slice(0, 30) || meta.label)}.${meta.ext}`
    downloadFile(name, input, mimeFor(language))
  }

  const handleFormatNow = useCallback(async () => {
    const res = await formatCode(language, input, options)
    if (res.ok) {
      setInput(res.output)
      setError(null)
      setMode("edit")
    } else {
      setError(res.error ?? "Could not format input.")
    }
  }, [input, language, options, setInput])

  const handleSave = useCallback(async () => {
    if (!input.trim()) return
    // A linked doc already auto-syncs; saving again would just duplicate it.
    if (currentEntry) return
    const res = await formatCode(language, input, options)
    onRequestSave({
      rawInput: input,
      formattedOutput: res.ok ? res.output : input,
      language,
      formatOptions: options,
    })
  }, [input, language, onRequestSave, options, currentEntry])

  const openSnapshot = useCallback(async () => {
    const res = await formatCode(language, input, options)
    setSnapshotCode(res.ok ? res.output : input)
    setShowSnapshot(true)
  }, [input, language, options])

  const handleClear = useCallback(() => {
    setInput("")
    setError(null)
    setMode((m) => (m === "tree" || m === "diff" ? "edit" : m))
    // Clearing the buffer detaches it from any linked entry (the entry stays in
    // the library); the buffer becomes a fresh unsaved scratch.
    onDetachCurrent()
  }, [setInput, onDetachCurrent])

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
        void handleSave()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault()
        void handleCopy()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === "p" && canPreview) {
        event.preventDefault()
        setMode((current) => (current === "preview" ? "edit" : "preview"))
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === "f" && input.trim()) {
        event.preventDefault()
        setShowFocus(true)
        return
      }

      if (event.shiftKey && event.key === "Backspace") {
        event.preventDefault()
        handleClear()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canPreview, handleClear, handleCopy, handleFormatNow, handleSave, input])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <LanguageSelect value={language} onChange={setLanguage} />
        {detectChip ? (
          <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-label text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Detected {getLanguage(detectChip.to).label}
            <button
              type="button"
              onClick={undoDetect}
              className="ml-0.5 cursor-pointer font-medium text-primary hover:underline"
            >
              Undo
            </button>
          </span>
        ) : (
          <StatusPill status={liveStatus} empty={!input.trim()} />
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="New entry" onClick={onNewEntry}>
            <FilePlus className="h-4 w-4" />
          </IconButton>
          <IconButton label="Format options" active={showOptions} onClick={() => setShowOptions((s) => !s)}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Copy result" onClick={handleCopy} disabled={!input}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Full view" onClick={() => setShowFocus(true)} disabled={!input}>
            <Maximize2 className="h-4 w-4" />
          </IconButton>
          {!currentEntry && (
            <IconButton label="Save to library" onClick={() => void handleSave()} disabled={!input}>
              <Save className="h-4 w-4" />
            </IconButton>
          )}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    disabled={!input}
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="w-44"
              // Don't restore focus to the trigger on close: a selected item may
              // open a dialog (Code snapshot), and refocusing the trigger re-fires
              // its hover/focus Tooltip on top of that dialog.
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem onSelect={() => handleExport()}>
                <Download className="h-3.5 w-3.5" /> Export to file
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void openSnapshot()}>
                <Camera className="h-3.5 w-3.5" /> Code snapshot
              </DropdownMenuItem>
              {currentEntry && (
                <DropdownMenuItem onSelect={() => onDuplicateCurrent()}>
                  <CopyPlus className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => handleClear()}>
                <Trash2 className="h-3.5 w-3.5" /> {currentEntry ? "Close (keep in library)" : "Clear"}
              </DropdownMenuItem>
              {currentEntry && (
                <DropdownMenuItem variant="destructive" onSelect={() => void onDeleteCurrent()}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete entry
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {currentEntry && (
        <div className="space-y-1.5 border-b border-border px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateCurrent({ pinned: !currentEntry.pinned })}
              aria-label={currentEntry.pinned ? "Unpin" : "Pin"}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Star className={cn("h-3.5 w-3.5", currentEntry.pinned && "fill-primary text-primary")} />
            </button>
            <input
              key={currentEntry.id}
              defaultValue={currentEntry.title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== currentEntry.title) onUpdateCurrent({ title: v })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
              }}
              aria-label="Entry title"
              className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-body font-medium focus:bg-secondary focus:outline-none"
            />
            <button
              type="button"
              aria-label="Move to folder"
              onClick={() => setMoveOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-label text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {currentFolder ? (
                <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: currentFolder.color }} />
              ) : (
                <Inbox className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="max-w-24 truncate">{currentFolder ? currentFolder.name : "No folder"}</span>
            </button>
            <MoveToDialog
              open={moveOpen}
              onOpenChange={setMoveOpen}
              projects={projects}
              currentProjectId={currentEntry?.projectId ?? null}
              onMove={(projectId) => onUpdateCurrent({ projectId })}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <TagsIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <TagsInput
              value={currentEntry.tags}
              onChange={(tags) => onUpdateCurrent({ tags })}
              suggestions={tagSuggestions}
              placeholder="Add tags…"
              className="min-h-7 border-0 px-0 py-0 focus-visible:ring-0"
            />
          </div>
        </div>
      )}

      {showOptions && <OptionsPanel language={language} options={options} onChange={setOptions} />}

      <EditorSurface
        input={input}
        onChangeInput={setInput}
        language={language}
        options={options}
        syntaxThemeId={syntaxThemeId}
        mode={mode}
        onChangeMode={setMode}
        onDetectLanguage={handleDetectLanguage}
        error={error}
        compact
      />

      {/* Only formattable languages get the action; Plain Text and Tier 2 pass through. */}
      {mode === "edit" && meta.formattable && (
        <button
          type="button"
          onClick={() => void handleFormatNow()}
          disabled={!input.trim()}
          className={cn(
            "mx-3 mb-2 mt-1.5 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-body font-medium text-primary-foreground transition-opacity",
            "hover:opacity-90 disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Format &amp; Beautify
        </button>
      )}

      {showSnapshot && (
        <SnapshotModal
          code={snapshotCode || input}
          language={language}
          syntaxThemeId={syntaxThemeId}
          defaultTitle={`${slugify(input.slice(0, 24) || meta.label)}.${meta.ext}`}
          onClose={() => setShowSnapshot(false)}
        />
      )}

      {showFocus && (
        <FocusView
          input={input}
          onChangeInput={setInput}
          language={language}
          options={options}
          syntaxThemeId={syntaxThemeId}
          onClose={() => setShowFocus(false)}
        />
      )}
    </div>
  )
}

function StatusPill({ status, empty }: { status: { ok: boolean; error?: string }; empty: boolean }) {
  if (empty) return null
  if (status.ok) {
    return (
      <span className="flex items-center gap-1 text-label text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Valid
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-label text-destructive">
      <AlertCircle className="h-3.5 w-3.5" /> Invalid
    </span>
  )
}
