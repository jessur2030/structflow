import { useMemo, type CSSProperties, type ElementType, type ReactNode } from "react"
import { marked } from "marked"
import { computeHeadingIds, stripMarkup, type MarkdownToken } from "@/lib/markdown-outline"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"
import { HighlightedCode } from "./highlighted-code"

interface MarkdownPreviewProps {
  source: string
  syntaxThemeId: string
}

type HeadingIds = Map<MarkdownToken, string>

export function MarkdownPreview({ source, syntaxThemeId }: MarkdownPreviewProps) {
  const theme = getSyntaxTheme(syntaxThemeId)
  const tokens = useMemo(() => {
    if (!source) return []
    try {
      return marked.lexer(source, { gfm: true }) as MarkdownToken[]
    } catch {
      return []
    }
  }, [source])

  // Ids are precomputed per lex pass (pure), so the Contents links and the
  // rendered heading ids always agree, no matter how often React re-renders.
  const headingIds = useMemo(() => computeHeadingIds(tokens), [tokens])

  if (!source) return null

  return (
    <div className="md-preview px-4 py-3" style={syntaxThemeVars(theme) as CSSProperties}>
      <TableOfContents tokens={tokens} headingIds={headingIds} />
      {tokens.map((token, index) => renderBlock(token, index, headingIds))}
    </div>
  )
}

function TableOfContents({ tokens, headingIds }: { tokens: MarkdownToken[]; headingIds: HeadingIds }) {
  const headings = tokens.filter((token) => token.type === "heading" && token.depth <= 3)
  if (headings.length < 3) return null

  // A per-view, collapsed-by-default outline: available when you want it, but it
  // doesn't dominate the top of every doc. State is local to this preview instance.
  return (
    <details className="md-toc">
      <summary>Contents</summary>
      <ol>
        {headings.map((heading, index) => (
          <li key={index} className={`md-toc-depth-${heading.depth}`}>
            <a href={`#${headingIds.get(heading) ?? ""}`}>
              {stripMarkup(heading.text ?? "")}
            </a>
          </li>
        ))}
      </ol>
    </details>
  )
}

function renderBlock(token: MarkdownToken, key: number | string, headingIds: HeadingIds): ReactNode {
  switch (token.type) {
    case "space":
      return null
    case "checkbox":
      // GFM task-list marker (first child of a task list_item).
      return (
        <input key={key} type="checkbox" checked={Boolean(token.checked)} readOnly disabled />
      )
    case "hr":
      return <hr key={key} />
    case "heading": {
      const Tag = `h${Math.min(Math.max(token.depth ?? 2, 1), 6)}` as ElementType
      return (
        <Tag key={key} id={headingIds.get(token)}>
          {renderInline(token.tokens, token.text)}
        </Tag>
      )
    }
    case "paragraph":
      return <p key={key}>{renderInline(token.tokens, token.text)}</p>
    case "text":
      return <p key={key}>{renderInline(token.tokens, token.text ?? token.raw)}</p>
    case "blockquote":
      return (
        <blockquote key={key}>
          {(token.tokens ?? []).map((child: MarkdownToken, index: number) =>
            renderBlock(child, index, headingIds),
          )}
        </blockquote>
      )
    case "list": {
      const ListTag = token.ordered ? "ol" : "ul"
      return (
        <ListTag key={key} start={token.start || undefined}>
          {(token.items ?? []).map((item: MarkdownToken, index: number) => {
            // Task items render checkbox + label inline; the block path would
            // drop the label to the next line.
            if (item.task) {
              const label = (item.tokens ?? []).filter(
                (child: MarkdownToken) => child.type !== "checkbox",
              )
              return (
                <li key={index}>
                  <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />{" "}
                  {label.map((child: MarkdownToken) =>
                    renderInline(child.tokens, child.text),
                  )}
                </li>
              )
            }
            return (
              <li key={index}>
                {item.tokens?.length
                  ? item.tokens.map((child: MarkdownToken, childIndex: number) =>
                      renderBlock(child, childIndex, headingIds),
                    )
                  : renderInline(item.tokens, item.text)}
              </li>
            )
          })}
        </ListTag>
      )
    }
    case "code": {
      const language = token.lang || "text"
      return (
        <div key={key} className="md-code-shell">
          <div className="md-code-header">{String(language).toUpperCase()}</div>
          <pre className="syntax-surface md-code-block">
            <HighlightedCode code={token.text ?? ""} language={language} />
          </pre>
        </div>
      )
    }
    case "table":
      return renderTable(token, key)
    case "html":
      return token.text || token.raw ? (
        <pre key={key} className="syntax-surface md-code-block">
          <code>{token.text || token.raw}</code>
        </pre>
      ) : null
    default:
      return token.tokens?.length ? (
        <div key={key}>
          {token.tokens.map((child: MarkdownToken, index: number) =>
            renderBlock(child, index, headingIds),
          )}
        </div>
      ) : token.raw ? (
        <p key={key}>{token.raw}</p>
      ) : null
  }
}

function renderTable(token: MarkdownToken, key: number | string) {
  return (
    <table key={key}>
      <thead>
        <tr>
          {(token.header ?? []).map((cell: MarkdownToken, index: number) => (
            <th key={index} style={{ textAlign: token.align?.[index] || undefined }}>
              {renderInline(cell.tokens, cell.text)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(token.rows ?? []).map((row: MarkdownToken[], rowIndex: number) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} style={{ textAlign: token.align?.[cellIndex] || undefined }}>
                {renderInline(cell.tokens, cell.text)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function renderInline(tokens?: MarkdownToken[], fallback = ""): ReactNode {
  if (!tokens?.length) return fallback

  return tokens.map((token, index) => {
    switch (token.type) {
      case "text":
        return token.tokens?.length ? renderInline(token.tokens, token.text) : token.text
      case "escape":
        return token.text
      case "checkbox":
        return <input key={index} type="checkbox" checked={Boolean(token.checked)} readOnly disabled />
      case "strong":
        return <strong key={index}>{renderInline(token.tokens, token.text)}</strong>
      case "em":
        return <em key={index}>{renderInline(token.tokens, token.text)}</em>
      case "codespan":
        return <code key={index}>{token.text}</code>
      case "br":
        return <br key={index} />
      case "del":
        return <del key={index}>{renderInline(token.tokens, token.text)}</del>
      case "link": {
        const href = safeHref(token.href)
        // In-document anchors must navigate in place; a new tab can't scroll
        // this preview.
        const external = !href.startsWith("#")
        return (
          <a
            key={index}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {renderInline(token.tokens, token.text || token.href)}
          </a>
        )
      }
      case "image":
        return token.text || token.href
      case "html":
        return token.text || token.raw || ""
      default:
        return token.raw || token.text || ""
    }
  })
}

function safeHref(href: string): string {
  const trimmed = href.trim()
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed
  return "#"
}
