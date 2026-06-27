import { useEffect, useRef, type CSSProperties } from "react"
import { Compartment, EditorState } from "@codemirror/state"
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  placeholder as cmPlaceholder,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"
import { loadLanguageSupport } from "@/lib/cm-languages"
import { synEditorTheme, synHighlightStyle } from "@/lib/cm-theme"
import { detectLanguage } from "@/lib/detect"
import type { Language } from "@/lib/types"
import { cn } from "@/lib/utils"

// const EDITOR_PLACEHOLDER = "Paste or type to begin — the language is detected automatically."

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: Language
  syntaxThemeId: string
  /** Called when a paste into an EMPTY editor confidently detects a language. */
  onDetectLanguage?: (lang: Language) => void
  wrap?: boolean
  autoFocus?: boolean
  fontSize?: number
  className?: string
}

/**
 * Controlled CodeMirror 6 surface: in-place syntax highlighting + line numbers,
 * themed entirely through the existing `--syn-*` CSS vars (see `cm-theme.ts`).
 * The editor is built once; language / theme-base / wrap are swapped via
 * Compartments so the view never rebuilds, preserving undo history and cursor.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  syntaxThemeId,
  onDetectLanguage,
  wrap = false,
  autoFocus = false,
  fontSize = 12.5,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Keep mutable refs of the latest props the update listener / async loaders
  // need, so the editor can be created exactly once.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onDetectLanguageRef = useRef(onDetectLanguage)
  onDetectLanguageRef.current = onDetectLanguage
  const langReqRef = useRef(0)

  const languageCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const wrapCompartment = useRef(new Compartment())

  const theme = getSyntaxTheme(syntaxThemeId)

  // Build the editor once.
  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(synHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        // cmPlaceholder(EDITOR_PLACEHOLDER),
        languageCompartment.current.of([]),
        themeCompartment.current.of(synEditorTheme(getSyntaxTheme(syntaxThemeId).base)),
        wrapCompartment.current.of(wrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        }),
        // Auto-detect language when a paste starts a fresh buffer: either the doc
        // is empty, or the paste replaces the whole document (select-all + paste).
        // Appending into existing content is left alone so notes aren't hijacked.
        EditorView.domEventHandlers({
          paste(_event, view) {
            if (!onDetectLanguageRef.current) return false
            const { doc, selection } = view.state
            const sel = selection.main
            const replacesAll = doc.length === 0 || (sel.from === 0 && sel.to === doc.length)
            if (!replacesAll) return false
            queueMicrotask(() => {
              const detected = detectLanguage(view.state.doc.toString())
              if (detected) onDetectLanguageRef.current?.(detected)
            })
            return false
          },
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    if (autoFocus) view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Build once; subsequent prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Controlled sync — only dispatch when the external value diverges from the
  // current doc. This short-circuits the typing echo (no cursor jump) while
  // still applying external writes (format-in-place, library open, clear).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  // Language grammar (lazy, race-guarded).
  useEffect(() => {
    const req = ++langReqRef.current
    void loadLanguageSupport(language).then((support) => {
      const view = viewRef.current
      if (!view || req !== langReqRef.current) return
      view.dispatch({ effects: languageCompartment.current.reconfigure(support) })
    })
  }, [language])

  // Theme base (dark/light) — colors themselves come from the inline --syn-*
  // vars on the host, so only reconfigure when the base flips.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: themeCompartment.current.reconfigure(synEditorTheme(theme.base)) })
  }, [theme.base])

  // Line wrapping.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: wrapCompartment.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    })
  }, [wrap])

  const style = {
    ...syntaxThemeVars(theme),
    "--cm-font-size": `${fontSize}px`,
  } as CSSProperties

  return (
    <div
      ref={hostRef}
      className={cn("syntax-surface cm-host h-full min-h-0 overflow-hidden text-(length:--cm-font-size)", className)}
      style={style}
    />
  )
}
