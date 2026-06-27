import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"
import { formatCode } from "@/lib/formatter"
import type { FormatOptions, Language } from "@/lib/types"

interface DiffViewProps {
  input: string
  language: Language
  options: FormatOptions
  syntaxThemeId: string
}

/**
 * Side-by-side line diff of the current buffer vs. what Format & Beautify would
 * produce. Replaces the old always-on output pane's "compare" mode: the formatted
 * side is computed on demand instead of read from a stored `output` string.
 */
export function DiffView({ input, language, options, syntaxThemeId }: DiffViewProps) {
  const theme = getSyntaxTheme(syntaxThemeId)
  const [formatted, setFormatted] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void formatCode(language, input, options).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setFormatted(res.output)
        setError(null)
      } else {
        setFormatted(null)
        setError(res.error ?? "Could not format input.")
      }
    })
    return () => {
      cancelled = true
    }
  }, [input, language, options])

  const rows = useMemo(() => buildRows(input, formatted ?? input), [input, formatted])

  if (!input) return null

  const changedCount = rows.filter((r) => r.before.changed).length

  return (
    <div
      className="syntax-surface flex min-h-full flex-col font-mono text-[12.5px] leading-[1.6]"
      style={syntaxThemeVars(theme) as CSSProperties}
    >
      {error ? (
        <p className="px-3 py-2 font-sans text-[12px] text-destructive">
          Cannot format ({error}); showing the buffer unchanged.
        </p>
      ) : changedCount === 0 ? (
        <p className="px-3 py-2 font-sans text-[12px] text-(--syn-gutter)">
          No changes — formatting this {language} would leave it as is.
        </p>
      ) : null}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        <ComparePane title="Current" rows={rows.map((row) => row.before)} />
        <ComparePane title="Formatted" rows={rows.map((row) => row.after)} border />
      </div>
    </div>
  )
}

interface Row {
  lineNumber: number
  text: string
  changed: boolean
}

function ComparePane({ title, rows, border }: { title: string; rows: Row[]; border?: boolean }) {
  return (
    <div className={border ? "border-t border-[color-mix(in_srgb,var(--syn-gutter)_30%,transparent)] md:border-l md:border-t-0" : ""}>
      <div className="sticky top-0 border-b border-[color-mix(in_srgb,var(--syn-gutter)_30%,transparent)] bg-(--syn-bg) px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-wide text-(--syn-gutter)">
        {title}
      </div>
      <pre className="overflow-x-auto py-2">
        {rows.map((row) => (
          <div key={row.lineNumber} className={row.changed ? "bg-(--syn-match)" : ""}>
            <span className="inline-block w-10 select-none pr-3 text-right text-(--syn-gutter)">{row.lineNumber}</span>
            <code>{row.text || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  )
}

export function buildRows(input: string, output: string): { before: Row; after: Row }[] {
  const before = input.split("\n")
  const after = output.split("\n")
  const length = Math.max(before.length, after.length)

  return Array.from({ length }, (_, i) => {
    const beforeText = before[i] ?? ""
    const afterText = after[i] ?? ""
    const changed = beforeText !== afterText
    return {
      before: { lineNumber: i + 1, text: beforeText, changed },
      after: { lineNumber: i + 1, text: afterText, changed },
    }
  })
}
