import { useMemo, type CSSProperties } from "react"
import { Renderer, marked, type Tokens } from "marked"
import DOMPurify from "dompurify"
import { escapeHtml, highlightCode } from "@/lib/highlight"
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
      const headingCounts = new Map<string, number>()
      renderer.code = ({ text, lang }: Tokens.Code) => {
        const language = lang ?? "plaintext"
        const highlighted = highlightCode(text, language)
        const languageClass = getLanguageClass(language)
        const languageLabel = getLanguageLabel(language)

        return `<div class="md-code-shell"><div class="md-code-header">${languageLabel}</div><pre class="syntax-surface md-code-block"><code class="hljs${languageClass}">${highlighted}</code></pre></div>\n`
      }
      renderer.heading = ({ text, depth }: Tokens.Heading) => {
        const id = headingId(text, headingCounts)
        const inline = marked.parseInline(text, { async: false }) as string

        return `<h${depth} id="${id}">${inline}</h${depth}>\n`
      }

      const raw = marked.parse(source, { async: false, gfm: true, breaks: false, renderer }) as string
      return sanitizeMarkdown(`${buildToc(source)}${raw}`)
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

function getLanguageLabel(language: string): string {
  const lang = language.trim().split(/\s+/)[0] || "text"
  return escapeHtml(lang.toUpperCase())
}

function headingId(text: string, counts: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  const count = counts.get(base) ?? 0
  counts.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function buildToc(source: string): string {
  const headings = marked
    .lexer(source, { gfm: true })
    .filter((token): token is Tokens.Heading => token.type === "heading" && token.depth <= 3)

  if (headings.length < 3) return ""

  const counts = new Map<string, number>()
  const items = headings
    .map((heading) => {
      const id = headingId(heading.text, counts)
      const text = escapeHtml(heading.text.replace(/<[^>]+>/g, ""))
      return `<li class="md-toc-depth-${heading.depth}"><a href="#${id}">${text}</a></li>`
    })
    .join("")

  return `<nav class="md-toc"><ol>${items}</ol></nav>`
}

function sanitizeMarkdown(raw: string): string {
  const clean = DOMPurify.sanitize(raw)
  const template = document.createElement("template")
  template.innerHTML = clean
  template.content.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", "_blank")
    link.setAttribute("rel", "noopener noreferrer")
  })
  return template.innerHTML
}
