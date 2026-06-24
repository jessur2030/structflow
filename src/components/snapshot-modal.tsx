import { useEffect, useMemo, useRef, useState } from "react"
import { toBlob } from "html-to-image"
import { X, Copy, Check, Download, Loader2 } from "lucide-react"
import { getLanguage, type Language } from "@/lib/types"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"
import { cn } from "@/lib/utils"
import { HighlightedCode } from "./highlighted-code"

const BACKDROPS: { id: string; label: string; value: string }[] = [
  { id: "navy", label: "Navy", value: "#1b2440" },
  { id: "blue", label: "Blue", value: "#1d4ed8" },
  { id: "cyan", label: "Cyan", value: "#0e7490" },
  { id: "slate", label: "Slate", value: "#334155" },
  { id: "none", label: "None", value: "transparent" },
]

interface SnapshotModalProps {
  code: string
  language: Language
  syntaxThemeId: string
  defaultTitle?: string
  onClose: () => void
}

export function SnapshotModal({ code, language, syntaxThemeId, defaultTitle, onClose }: SnapshotModalProps) {
  const meta = getLanguage(language)
  const theme = getSyntaxTheme(syntaxThemeId)
  const cardRef = useRef<HTMLDivElement>(null)

  const [backdrop, setBackdrop] = useState(BACKDROPS[0].value)
  const [padding, setPadding] = useState(32)
  const [showTitle, setShowTitle] = useState(true)
  const [title, setTitle] = useState(defaultTitle || `snippet.${meta.ext}`)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<null | "copy" | "download">(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const lines = useMemo(() => (code ? code.split("\n") : []), [code])

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.download = `${(title || "snippet").replace(/[^\w.-]+/g, "-")}.png`
    a.href = url
    a.click()
    // Defer the revoke so the browser's async download read isn't cut short.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const render = async (kind: "copy" | "download") => {
    const node = cardRef.current
    if (!node || busy) return
    setBusy(kind)
    setError(null)
    setInfo(null)
    try {
      // Browsers cap canvas dimensions at ~16384px. Use a slightly conservative
      // bound so rounding / measurement differences can't clip the edge.
      const MAX_CANVAS_PX = 16000
      const rect = node.getBoundingClientRect()
      const fitRatio = Math.min(MAX_CANVAS_PX / rect.width, MAX_CANVAS_PX / rect.height)
      const pixelRatio = Math.min(2, fitRatio)
      if (pixelRatio < 1) setInfo("Large snapshot — scaled down to fit the image size limit.")

      const blob = await toBlob(node, { pixelRatio, cacheBust: true })
      if (!blob) throw new Error("Could not render image")

      if (kind === "download") {
        downloadBlob(blob)
      } else {
        try {
          if (!navigator.clipboard || !("write" in navigator.clipboard)) {
            throw new Error("unavailable")
          }
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch {
          // Clipboard image API blocked/unavailable — fall back to a download.
          downloadBlob(blob)
        }
      }
    } catch (err) {
      console.warn("StructFlow snapshot render failed:", (err as Error).message)
      setError("Couldn't render the snapshot. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Code snapshot"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">Code snapshot</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 overflow-auto bg-(--snap-checker) p-4">
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-medium shadow-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                {busy === "copy" ? "Copying image…" : "Generating image…"}
              </div>
            </div>
          )}
          <div className="flex justify-center">
            <div
              ref={cardRef}
              style={{ background: backdrop, padding }}
              className="inline-block rounded-xl"
            >
              <div
                className="syntax-surface overflow-hidden rounded-lg text-left font-mono text-[12.5px] leading-[1.6] shadow-xl"
                style={syntaxThemeVars(theme) as React.CSSProperties}
              >
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{ background: "var(--syn-bg)", color: "var(--syn-fg)" }}
                >
                  <span className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f" }} />
                  </span>
                  {showTitle && (
                    <span className="ml-2 truncate text-[12px] opacity-80">{title}</span>
                  )}
                </div>
                <div className="flex" style={{ background: "var(--syn-bg)" }}>
                  {showLineNumbers && (
                    <div
                      aria-hidden
                      className="syntax-gutter select-none px-3 pb-4 pt-1 text-right tabular-nums"
                    >
                      {lines.map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                  )}
                  <pre className="overflow-hidden px-4 pb-4 pt-1">
                    <HighlightedCode code={code} language={meta.hljs} />
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Backdrop</span>
              <div className="flex gap-1.5">
                {BACKDROPS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    aria-label={b.label}
                    onClick={() => setBackdrop(b.value)}
                    className={cn(
                      "h-6 w-6 rounded-md border-2 transition-transform",
                      backdrop === b.value ? "border-primary scale-110" : "border-border",
                    )}
                    style={
                      b.value === "transparent"
                        ? { backgroundImage: "var(--snap-checker)", backgroundColor: "var(--card)" }
                        : { background: b.value }
                    }
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Padding</span>
              <input
                type="range"
                min={0}
                max={64}
                step={8}
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                className="h-1 w-24 cursor-pointer accent-primary"
              />
            </label>

            {/* Toggles */}
            <ChipToggle active={showTitle} onClick={() => setShowTitle((v) => !v)}>
              Title bar
            </ChipToggle>
            <ChipToggle active={showLineNumbers} onClick={() => setShowLineNumbers((v) => !v)}>
              Line numbers
            </ChipToggle>
            </div>

            {showTitle && (
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Filename</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="filename"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {error && <span className="mr-auto text-[12px] text-red-500">{error}</span>}
            {!error && info && <span className="mr-auto text-[12px] text-muted-foreground">{info}</span>}
            <button
              type="button"
              onClick={() => render("copy")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-secondary disabled:opacity-50 cursor-pointer"
            >
            
              {busy === "copy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy PNG"}
            </button>
            <button
              type="button"
              onClick={() => render("download")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  )
}
