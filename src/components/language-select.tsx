import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { LANGUAGES, type Language } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LanguageSelectProps {
  value: Language
  onChange: (lang: Language) => void
}

export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.id === value)!

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
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] font-medium hover:bg-secondary"
      >
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => {
                onChange(lang.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-secondary",
                lang.id === value && "bg-secondary/60",
              )}
            >
              <span className="mt-0.5 w-4 shrink-0">
                {lang.id === value && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{lang.label}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {lang.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
