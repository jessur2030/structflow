import { useMemo } from "react"
import hljs from "highlight.js/lib/core"
import json from "highlight.js/lib/languages/json"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import css from "highlight.js/lib/languages/css"
import markdown from "highlight.js/lib/languages/markdown"
import sql from "highlight.js/lib/languages/sql"
import plaintext from "highlight.js/lib/languages/plaintext"
import { getLanguage, type Language } from "@/lib/types"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"

hljs.registerLanguage("json", json)
hljs.registerLanguage("javascript", javascript)
hljs.registerLanguage("typescript", typescript)
hljs.registerLanguage("xml", xml)
hljs.registerLanguage("css", css)
hljs.registerLanguage("markdown", markdown)
hljs.registerLanguage("sql", sql)
hljs.registerLanguage("plaintext", plaintext)

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
    if (!code) return ""
    try {
      return hljs.highlight(code, { language: meta.hljs, ignoreIllegals: true }).value
    } catch {
      return escapeHtml(code)
    }
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
