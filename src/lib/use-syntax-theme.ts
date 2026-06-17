import { useEffect, useState } from "react"
import { DEFAULT_SYNTAX_THEME } from "@/lib/syntax-themes"

const KEY = "structflow_syntax_theme"

export function useSyntaxTheme() {
  const [syntaxThemeId, setSyntaxThemeId] = useState<string>(DEFAULT_SYNTAX_THEME)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) setSyntaxThemeId(stored)
    } catch {
    }
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
