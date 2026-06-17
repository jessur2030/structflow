import { useEffect, useRef, useState } from "react"
import { Check, Palette } from "lucide-react"
import { SYNTAX_THEMES, getSyntaxTheme } from "@/lib/syntax-themes"
import { cn } from "@/lib/utils"

interface SyntaxThemeSelectProps {
  value: string
  onChange: (id: string) => void
}

export function SyntaxThemeSelect({ value, onChange }: SyntaxThemeSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getSyntaxTheme(value)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Editor theme"
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="max-w-[90px] truncate">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Editor &amp; JSON theme
          </div>
          {SYNTAX_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange(t.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary",
                t.id === value && "bg-secondary/60",
              )}
            >
              <span className="w-4 shrink-0">
                {t.id === value && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
              <span
                className="h-4 w-4 shrink-0 rounded border border-border"
                style={{ backgroundColor: t.colors.bg }}
                aria-hidden
              >
                <span className="block h-full w-full scale-50 origin-top-left" />
              </span>
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
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
