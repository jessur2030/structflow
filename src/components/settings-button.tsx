import { useEffect, useRef, useState } from "react"
import { Cog } from "lucide-react"
import { cn } from "@/lib/utils"

// Mirrors the key the content script reads (src/content.ts ENABLED_KEY). Stored
// in chrome.storage.local so the in-page JSON viewer picks it up on the next page.
const ENABLED_KEY = "structflow_inpage_enabled"

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local
}

export function SettingsButton() {
  const [open, setOpen] = useState(false)
  const [inpageEnabled, setInpageEnabled] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasChromeStorage()) return
    chrome.storage.local.get(ENABLED_KEY, (res) => {
      setInpageEnabled(res?.[ENABLED_KEY] !== false)
    })
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const toggleInpage = () => {
    const next = !inpageEnabled
    setInpageEnabled(next)
    if (hasChromeStorage()) chrome.storage.local.set({ [ENABLED_KEY]: next })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          open ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Cog className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
          <div className="px-3 py-2">
            <p className="text-[12px] font-semibold">Settings</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="switch"
            aria-checked={inpageEnabled}
            onClick={toggleInpage}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium">Auto-format JSON pages</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                Open raw JSON pages in the StructFlow viewer. Turn off to leave them as-is.
              </span>
            </span>
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                inpageEnabled ? "bg-primary" : "bg-secondary-foreground/25",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  inpageEnabled ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
