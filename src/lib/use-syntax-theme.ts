import { useEffect, useState } from "react"

const KEY = "structflow_syntax_theme"
const THEME_KEY = "structflow_theme"

/** Whether the app is (or will resolve to) dark, used only for the first-run default. */
function appPrefersDark(): boolean {
  try {
    const m = localStorage.getItem(THEME_KEY)
    if (m === "dark") return true
    if (m === "light") return false
  } catch {
  }
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
}

/**
 * First-run syntax theme: match the app's light/dark so a fresh install never
 * shows a dark code surface on a light UI (or vice versa). Once the user picks a
 * theme it's persisted and takes precedence regardless of app mode.
 */
function firstRunDefault(): string {
  return appPrefersDark() ? "aura-noir-modern" : "aura-day"
}

export function useSyntaxTheme() {
  const [syntaxThemeId, setSyntaxThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) || firstRunDefault()
    } catch {
      return firstRunDefault()
    }
  })

  // Persist the first-run default once, so it becomes the stored choice.
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, syntaxThemeId)
    } catch {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = (id: string) => {
    setSyntaxThemeId(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
    }
  }

  return { syntaxThemeId, setSyntaxTheme: setTheme }
}
