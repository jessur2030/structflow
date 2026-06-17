import { useMemo, type CSSProperties } from "react"
import { Renderer, marked, type Tokens } from "marked"
import DOMPurify from "dompurify"
import { highlightCode } from "@/lib/highlight"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"

interface MarkdownPreviewProps {
  source: string
  syntaxThemeId: string
}

export function MarkdownPreview({ source, syntaxThemeId }: MarkdownPreviewProps) {
  const theme = getSyntaxTheme(syntaxThemeId)

  const html = useMemo(() => {
    if (!source) return ""
    try {
      const renderer = new Renderer()
      renderer.code = ({ text, lang }: Tokens.Code) => {
        const language = lang ?? "plaintext"
        const highlighted = highlightCode(text, language)
        const languageClass = getLanguageClass(language)

        return `<pre class="syntax-surface md-code-block"><code class="hljs${languageClass}">${highlighted}</code></pre>\n`
      }

      const raw = marked.parse(source, { async: false, gfm: true, breaks: false, renderer }) as string
      return DOMPurify.sanitize(raw)
    } catch {
      return ""
    }
  }, [source])

  if (!source) return null

  return (
    <div
      className="md-preview px-4 py-3"
      style={syntaxThemeVars(theme) as CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function getLanguageClass(language: string): string {
  const lang = language.trim().toLowerCase().split(/\s+/)[0] ?? ""
  const safeLang = lang.replace(/[^\w-]/g, "")

  return safeLang ? ` language-${safeLang}` : ""
}
