import { useMemo, type ReactNode } from "react"
import type { RootContent } from "hast"
import { highlightCode } from "@/lib/highlight"

interface HighlightedCodeProps {
  code: string
  language: string
  className?: string
}

export function HighlightedCode({ code, language, className = "hljs" }: HighlightedCodeProps) {
  const tree = useMemo(() => highlightCode(code, language), [code, language])

  return (
    <code className={className}>
      {tree.children.map((child, index) => renderNode(child, index))}
    </code>
  )
}

function renderNode(node: RootContent, key: number): ReactNode {
  if (node.type === "text") return node.value

  if (node.type === "element") {
    const raw = node.properties?.className
    const classNames = Array.isArray(raw) ? raw.join(" ") : typeof raw === "string" ? raw : undefined

    return (
      <span key={key} className={classNames}>
        {node.children.map((child, childIndex) => renderNode(child, childIndex))}
      </span>
    )
  }

  return null
}
