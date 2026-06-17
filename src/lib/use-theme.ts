import { useEffect, useState } from "react"

export type ThemeMode = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const KEY = "structflow_theme"

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
}

function resolve(mode: ThemeMode): Resolved {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light"
  return mode
}

function apply(resolved: Resolved) {
  document.documentElement.classList.toggle("dark", resolved === "dark")
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system")
  const [resolved, setResolved] = useState<Resolved>("dark")

  useEffect(() => {
    let initial: ThemeMode = "system"
    try {
      const stored = localStorage.getItem(KEY) as ThemeMode | null
      if (stored === "light" || stored === "dark" || stored === "system") initial = stored
    } catch {
    }
    setModeState(initial)
    const r = resolve(initial)
    setResolved(r)
    apply(r)
  }, [])

  useEffect(() => {
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const r = systemPrefersDark() ? "dark" : "light"
      setResolved(r)
      apply(r)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mode])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
    const r = resolve(next)
    setResolved(r)
    apply(r)
    try {
      localStorage.setItem(KEY, next)
    } catch {
    }
  }

  return { mode, resolved, setMode }
}
