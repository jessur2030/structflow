import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Trash2,
  Keyboard,
  ExternalLink,
} from "lucide-react"
import { SyntaxThemeSelect } from "./syntax-theme-select"
import { Modal } from "./modal"
import { ModalButton } from "./library"
import { exportEntriesAsZip, importFiles } from "@/lib/io"
import { clearAll } from "@/lib/storage"
import { SUPPORT_LINKS } from "@/lib/support-links"
import { LANGUAGES, STRUCTFLOW_APP_VERSION, type Entry, type Language, type Project } from "@/lib/types"
import type { ThemeMode } from "@/lib/use-theme"
import { cn } from "@/lib/utils"

const INPAGE_KEY = "structflow_inpage_enabled"
const SHORTCUTS_URL = "chrome://extensions/shortcuts"

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local
}

interface SettingsViewProps {
  onClose: () => void
  themeMode: ThemeMode
  onChangeThemeMode: (m: ThemeMode) => void
  syntaxThemeId: string
  onChangeSyntaxTheme: (id: string) => void
  defaultLanguage: Language
  onChangeDefaultLanguage: (l: Language) => void
  entries: Entry[]
  projects: Project[]
  onImportData: (entries: Entry[], projects: Project[]) => Promise<void>
  onClearAll: () => Promise<void>
}

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
]

export function SettingsView({
  onClose,
  themeMode,
  onChangeThemeMode,
  syntaxThemeId,
  onChangeSyntaxTheme,
  defaultLanguage,
  onChangeDefaultLanguage,
  entries,
  projects,
  onImportData,
  onClearAll,
}: SettingsViewProps) {
  const [inpageEnabled, setInpageEnabled] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasChromeStorage()) return
    chrome.storage.local.get(INPAGE_KEY, (res) => setInpageEnabled(res?.[INPAGE_KEY] !== false))
  }, [])

  const toggleInpage = () => {
    const next = !inpageEnabled
    setInpageEnabled(next)
    if (hasChromeStorage()) chrome.storage.local.set({ [INPAGE_KEY]: next })
  }

  const runImport = async (list: FileList | null) => {
    const files = list ? Array.from(list) : []
    if (fileRef.current) fileRef.current.value = ""
    if (files.length === 0) return
    setImportMsg(null)
    try {
      const imported = await importFiles(files)
      if (imported.entries.length === 0) {
        setImportMsg("No importable files were found.")
        return
      }
      await onImportData(imported.entries, imported.projects)
      setImportMsg(
        `Imported ${imported.entries.length} item(s)${imported.projects.length ? ` and ${imported.projects.length} folder(s)` : ""}.`,
      )
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Could not import these files.")
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-[15px] font-semibold">Settings</span>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-4">
        <Section title="General">
          <Row label="Appearance" desc="Light, dark, or follow your system.">
            <div className="flex rounded-md border border-border p-0.5">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeThemeMode(opt.id)}
                    aria-pressed={themeMode === opt.id}
                    title={opt.label}
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded text-muted-foreground transition-colors",
                      themeMode === opt.id && "bg-secondary text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Syntax theme" desc="Colors for the editor and JSON views.">
            <SyntaxThemeSelect value={syntaxThemeId} onChange={onChangeSyntaxTheme} />
          </Row>
          <Row label="Default language" desc="What a new, empty editor opens in.">
            <select
              value={defaultLanguage}
              onChange={(e) => onChangeDefaultLanguage(e.target.value as Language)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="In-page JSON viewer">
          <Row label="Auto-format JSON pages" desc="Open raw JSON pages in the StructFlow viewer.">
            <Switch checked={inpageEnabled} onChange={toggleInpage} label="Auto-format JSON pages" />
          </Row>
        </Section>

        <Section title="Data">
          <Row label="Export library" desc="Download all entries and folders as a .zip.">
            <button
              type="button"
              onClick={() => exportEntriesAsZip(entries, projects)}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </Row>
          <Row label="Import" desc="Bring in a StructFlow backup, files, or a .zip.">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-secondary"
            >
              <Upload className="h-3.5 w-3.5" /> Import
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void runImport(e.target.files)}
            />
          </Row>
          {importMsg && <p className="px-1 text-[11px] text-muted-foreground">{importMsg}</p>}
          <Row label="Clear all data" desc="Permanently delete every saved entry and folder." danger>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={entries.length === 0 && projects.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-[12.5px] font-medium text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          </Row>
        </Section>

        <Section title="About">
          <Row label="Version" desc="StructFlow">
            <span className="text-[12.5px] tabular-nums text-muted-foreground">v{STRUCTFLOW_APP_VERSION}</span>
          </Row>
          <Row label="Keyboard shortcut" desc="Open the side panel. Change it in your browser's extension shortcuts.">
            <button
              type="button"
              onClick={() => {
                if (typeof chrome !== "undefined" && chrome.tabs?.create) chrome.tabs.create({ url: SHORTCUTS_URL })
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-secondary"
            >
              <Keyboard className="h-3.5 w-3.5" /> Configure
            </button>
          </Row>
          <div className="space-y-1 pt-1">
            {SUPPORT_LINKS.filter((l) => l.url.trim()).map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-1 py-1 text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {l.label}
              </a>
            ))}
          </div>
        </Section>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all data?"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </ModalButton>
            <ModalButton
              variant="danger"
              onClick={async () => {
                await onClearAll()
                setConfirmClear(false)
              }}
            >
              Delete everything
            </ModalButton>
          </>
        }
      >
        <p className="text-[13px] text-muted-foreground">
          This permanently deletes all {entries.length} saved entr{entries.length === 1 ? "y" : "ies"} and{" "}
          {projects.length} folder(s). This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3 rounded-lg border border-border p-3">{children}</div>
    </section>
  )
}

function Row({
  label,
  desc,
  danger,
  children,
}: {
  label: string
  desc?: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={cn("text-[13px] font-medium", danger && "text-destructive")}>{label}</p>
        {desc && <p className="text-[11px] leading-tight text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border-0 p-0 transition-colors",
        checked ? "bg-primary" : "bg-secondary-foreground/25",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  )
}
