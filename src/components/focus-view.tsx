import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { getLanguage, type FormatOptions, type Language } from "@/lib/types"
import { EditorSurface, type Mode } from "./editor-surface"

interface FocusViewProps {
  input: string
  onChangeInput: (value: string) => void
  language: Language
  options: FormatOptions
  syntaxThemeId: string
  onClose: () => void
}

/**
 * Fullscreen "focus" view: the same unified editor surface as the main panel,
 * just larger and centered for distraction-free writing/presenting. Markdown
 * defaults to the rendered preview; everything else opens in the editor.
 */
export function FocusView({ input, onChangeInput, language, options, syntaxThemeId, onClose }: FocusViewProps) {
  const meta = getLanguage(language)
  const [mode, setMode] = useState<Mode>(language === "markdown" ? "preview" : "edit")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Full view">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-body">
          <span className="font-semibold">Full view</span>
          <span className="text-muted-foreground">{meta.label}</span>
        </div>
        <button
          type="button"
          aria-label="Close full view"
          onClick={onClose}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <EditorSurface
        input={input}
        onChangeInput={onChangeInput}
        language={language}
        options={options}
        syntaxThemeId={syntaxThemeId}
        mode={mode}
        onChangeMode={setMode}
        editorFontSize={13}
        editorAutoFocus
      />
    </div>
  )
}
