import { useEffect, useRef, useState } from "react"
import { Moon, Sun, Monitor, Check } from "lucide-react"
import type { ThemeMode } from "@/lib/use-theme"
import { cn } from "@/lib/utils"
import { FloatingTooltip } from "./tooltip"

interface ThemeModeToggleProps {
  mode: ThemeMode
  resolved: "light" | "dark"
  onChange: (mode: ThemeMode) => void
}

const OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
]

export function ThemeModeToggle({ mode, resolved, onChange }: ThemeModeToggleProps) {
  const [open, setOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const TriggerIcon = mode === "system" ? Monitor : resolved === "dark" ? Moon : Sun

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme"
        onPointerEnter={() => setShowTooltip(true)}
        onPointerLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        ref={buttonRef}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <TriggerIcon className="h-4 w-4" />
      </button>
      <FloatingTooltip anchorRef={buttonRef} label="Theme" open={showTooltip && !open} preferredSide="bottom" />

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-secondary",
                  opt.id === mode && "bg-secondary/60",
                )}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1">{opt.label}</span>
                {opt.id === mode && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
