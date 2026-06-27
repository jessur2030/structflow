import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  Search,
  FileText,
  FileCode,
  FileCode2,
  Braces,
  Code2,
  Database,
  Palette,
  Terminal,
  Settings2,
  Type,
  Box,
  type LucideIcon,
} from "lucide-react"
import { LANGUAGES, getLanguage, type Language } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LanguageSelectProps {
  value: Language
  onChange: (lang: Language) => void
}

const LANG_ICON: Record<Language, LucideIcon> = {
  markdown: FileText,
  text: Type,
  typescript: FileCode2,
  javascript: Braces,
  json: Braces,
  html: Code2,
  css: Palette,
  sql: Database,
  yaml: Settings2,
  python: FileCode,
  go: FileCode,
  rust: FileCode,
  java: FileCode,
  cpp: FileCode,
  csharp: FileCode,
  php: FileCode,
  ruby: FileCode,
  shell: Terminal,
  toml: Settings2,
  dockerfile: Box,
  kotlin: FileCode,
  swift: FileCode,
}

const RECENTS_KEY = "structflow_recent_langs"
const RECENTS_MAX = 5

function loadRecents(): Language[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is Language => LANGUAGES.some((l) => l.id === id))
    }
  } catch {
  }
  return []
}

function pushRecent(id: Language): Language[] {
  const next = [id, ...loadRecents().filter((x) => x !== id)].slice(0, RECENTS_MAX)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
  }
  return next
}

const optionId = (id: Language) => `lang-opt-${id}`

export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<Language[]>(loadRecents)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = getLanguage(value)
  const CurrentIcon = LANG_ICON[value] ?? FileCode

  // Ordered id list driving both display and keyboard nav.
  const { ids, recentCount } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const filtered = LANGUAGES.filter(
        (l) => l.label.toLowerCase().includes(q) || l.id.includes(q),
      ).map((l) => l.id)
      return { ids: filtered, recentCount: 0 }
    }
    const valid = recents.filter((id) => LANGUAGES.some((l) => l.id === id))
    const rest = LANGUAGES.map((l) => l.id).filter((id) => !valid.includes(id))
    return { ids: [...valid, ...rest], recentCount: valid.length }
  }, [query, recents])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  // On open: reset query, focus search, highlight the current language.
  useEffect(() => {
    if (!open) return
    setQuery("")
    setRecents(loadRecents())
    const idx = LANGUAGES.findIndex((l) => l.id === value)
    setActiveIndex(idx >= 0 ? idx : 0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open, value])

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return
    const id = ids[activeIndex]
    if (id) document.getElementById(optionId(id))?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, ids, open])

  const select = (id: Language) => {
    onChange(id)
    setRecents(pushRecent(id))
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (ids.length ? (i + 1) % ids.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (ids.length ? (i - 1 + ids.length) % ids.length : 0))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(Math.max(0, ids.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const id = ids[activeIndex]
      if (id) select(id)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] font-medium hover:bg-secondary"
      >
        <CurrentIcon className="h-3.5 w-3.5 text-muted-foreground" />
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search languages…"
              role="combobox"
              aria-expanded
              aria-controls="lang-listbox"
              aria-activedescendant={ids[activeIndex] ? optionId(ids[activeIndex]) : undefined}
              className="w-full bg-transparent text-[13px] focus:outline-none"
            />
          </div>

          <ul id="lang-listbox" role="listbox" className="max-h-72 overflow-y-auto py-1">
            {ids.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-muted-foreground">No languages match “{query}”.</li>
            )}
            {ids.map((id, i) => {
              const lang = getLanguage(id)
              const Icon = LANG_ICON[id] ?? FileCode
              const showRecentLabel = !query.trim() && recentCount > 0 && i === 0
              const showAllLabel = !query.trim() && i === recentCount
              return (
                <Fragment key={id}>
                  {showRecentLabel && <SectionLabel>Recent</SectionLabel>}
                  {showAllLabel && <SectionLabel>{recentCount > 0 ? "All languages" : "Languages"}</SectionLabel>}
                  <li
                    id={optionId(id)}
                    role="option"
                    aria-selected={id === value}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-1.5",
                      i === activeIndex && "bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium">{lang.label}</span>
                        {id === value && <span className="text-[10px] text-primary">●</span>}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                        {lang.description}
                      </span>
                    </span>
                    {lang.formattable && (
                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        formats
                      </span>
                    )}
                  </li>
                </Fragment>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </li>
  )
}
