import { useState } from "react"
import {
  ChevronDown,
  Check,
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { Badge } from "./ui/badge"

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
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]")
    if (Array.isArray(parsed)) return parsed.filter((id): id is Language => LANGUAGES.some((l) => l.id === id))
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

export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const [open, setOpen] = useState(false)
  const [recents, setRecents] = useState<Language[]>(loadRecents)
  const current = getLanguage(value)
  const CurrentIcon = LANG_ICON[value] ?? FileCode

  const select = (id: Language) => {
    onChange(id)
    setRecents(pushRecent(id))
    setOpen(false)
  }

  const recentList = recents.filter((id) => LANGUAGES.some((l) => l.id === id))

  const renderItem = (lang: (typeof LANGUAGES)[number], keyPrefix = "") => {
    const Icon = LANG_ICON[lang.id] ?? FileCode
    return (
      <CommandItem
        key={keyPrefix + lang.id}
        value={`${keyPrefix}${lang.label} ${lang.id}`}
        onSelect={() => select(lang.id)}
        className="gap-2.5"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{lang.label}</span>
        {lang.formattable && (
          <Badge variant="secondary" className="px-1.5 py-0 text-micro font-medium uppercase tracking-wide">
            formats
          </Badge>
        )}
        {lang.id === value && <Check className="h-3.5 w-3.5 text-primary" />}
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Language"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-body font-medium hover:bg-secondary"
        >
          <CurrentIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {current.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search languages…" />
          <CommandList>
            <CommandEmpty>No languages found.</CommandEmpty>
            {recentList.length > 0 && (
              <CommandGroup heading="Recent">
                {recentList.map((id) => renderItem(getLanguage(id), "recent:"))}
              </CommandGroup>
            )}
            <CommandGroup heading={recentList.length > 0 ? "All languages" : "Languages"}>
              {LANGUAGES.map((lang) => renderItem(lang))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
