import { useEffect, useState } from "react"

const KEY = "structflow_syntax_theme"
const THEME_KEY = "structflow_theme"

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local
}

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
  // Also mirror into chrome.storage.local: that's the store the in-page JSON
  // viewer (content script) reads — it cannot see the panel's localStorage.
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, syntaxThemeId)
    } catch {
    }
    if (hasChromeStorage()) {
      chrome.storage.local.get(KEY, (res) => {
        if (typeof res?.[KEY] !== "string") chrome.storage.local.set({ [KEY]: syntaxThemeId })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow theme changes made from the in-page JSON viewer's own picker.
  useEffect(() => {
    if (!hasChromeStorage() || !chrome.storage.onChanged) return
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== "local") return
      const next = changes[KEY]?.newValue
      if (typeof next !== "string") return
      setSyntaxThemeId((prev) => {
        if (next === prev) return prev
        try {
          localStorage.setItem(KEY, next)
        } catch {
        }
        return next
      })
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const setTheme = (id: string) => {
    setSyntaxThemeId(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
    }
    if (hasChromeStorage()) chrome.storage.local.set({ [KEY]: id })
  }

  return { syntaxThemeId, setSyntaxTheme: setTheme }
}
