import { Check, Palette } from "lucide-react"
import { SYNTAX_THEMES, getSyntaxTheme } from "@/lib/syntax-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

interface SyntaxThemeSelectProps {
  value: string
  onChange: (id: string) => void
}

export function SyntaxThemeSelect({ value, onChange }: SyntaxThemeSelectProps) {
  const current = getSyntaxTheme(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Editor & JSON theme"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-compact font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="max-w-24 truncate">{current.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel className="text-micro uppercase tracking-wide text-muted-foreground">
          Editor &amp; JSON theme
        </DropdownMenuLabel>
        {SYNTAX_THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onChange(t.id)} className="gap-2">
            <span className="w-4 shrink-0">
              {t.id === value && <Check className="h-3.5 w-3.5 text-primary" />}
            </span>
            <span
              className="h-4 w-4 shrink-0 rounded border border-border"
              style={{ backgroundColor: t.colors.bg }}
              aria-hidden
            />
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: t.colors.string }}
                aria-hidden
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: t.colors.keyword }}
                aria-hidden
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-compact font-medium">{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
