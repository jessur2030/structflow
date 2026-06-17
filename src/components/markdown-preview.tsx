import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"

interface MarkdownPreviewProps {
  source: string
}

export function MarkdownPreview({ source }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!source) return ""
    try {
      const raw = marked.parse(source, { async: false, gfm: true, breaks: false }) as string
      return DOMPurify.sanitize(raw)
    } catch {
      return ""
    }
  }, [source])

  if (!source) return null

  return (
    <div className="md-preview px-4 py-3" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
