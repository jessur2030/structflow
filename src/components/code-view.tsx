import { useMemo } from "react"
import { getLanguage, type Language } from "@/lib/types"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"
import { highlightCode } from "@/lib/highlight"

interface CodeViewProps {
  code: string
  language: Language
  wrap?: boolean
  syntaxThemeId: string
}

export function CodeView({ code, language, wrap, syntaxThemeId }: CodeViewProps) {
  const meta = getLanguage(language)
  const theme = getSyntaxTheme(syntaxThemeId)

  const highlighted = useMemo(() => {
    return highlightCode(code, meta.hljs)
  }, [code, meta.hljs])

  const lineCount = useMemo(() => (code ? code.split("\n").length : 0), [code])

  if (!code) return null

  return (
    <div
      className="syntax-surface flex min-h-full font-mono text-[12.5px] leading-[1.6]"
      style={syntaxThemeVars(theme) as React.CSSProperties}
    >
      <div
        aria-hidden
        className="syntax-gutter select-none border-r px-3 py-3 text-right tabular-nums"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre
        className={
          "flex-1 overflow-x-auto px-3 py-3 " +
          (wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")
        }
      >
        <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
