import { useState } from "react"
import { X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { cn } from "@/lib/utils"

interface TagsInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  /** Existing tags from across the library, offered as autocomplete suggestions. */
  suggestions?: string[]
  placeholder?: string
  className?: string
}

/** Trim + strip a leading "#"; dedup is case-insensitive but display case is kept. */
function clean(raw: string): string {
  return raw.trim().replace(/^#/, "")
}

/**
 * Removable Badge chips + a cmdk combobox that autocompletes from tags already
 * used elsewhere and lets you create new ones. Replaces the old comma-separated
 * text inputs; shared by the Editor identity bar and the Library Details modal.
 */
export function TagsInput({ value, onChange, suggestions = [], placeholder = "Add tags…", className }: TagsInputProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const has = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase())

  const add = (raw: string) => {
    const tag = clean(raw)
    if (!tag || has(tag)) {
      setQuery("")
      return
    }
    onChange([...value, tag])
    setQuery("")
  }
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag))

  const available = suggestions.filter((s) => !has(s))
  const q = clean(query).toLowerCase()
  const canCreate = q.length > 0 && !available.some((s) => s.toLowerCase() === q) && !has(q)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Tags"
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-left text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {value.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Remove ${tag}`}
                onClick={(e) => {
                  e.stopPropagation()
                  remove(tag)
                }}
                className="flex items-center rounded-sm hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            </Badge>
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search or create a tag…" value={query} onValueChange={setQuery} />
          <CommandList>
            {/* Suggestions first so Enter selects the highlighted existing tag; cmdk
                handles Enter/click selection (CommandItem onSelect adds the tag). */}
            {available.length > 0 && (
              <CommandGroup heading="Reuse a tag">
                {available.map((s) => (
                  <CommandItem key={s} value={s} onSelect={() => add(s)}>
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandItem value={`__create__${q}`} onSelect={() => add(query)}>
                Create “{clean(query)}”
              </CommandItem>
            )}
            {!canCreate && available.length === 0 && (
              <p className="px-3 py-4 text-center text-compact text-muted-foreground">
                {query.trim()
                  ? "That tag is already added."
                  : "Type to create a tag. Tags you use are suggested here on other entries."}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
