import { useMemo, type CSSProperties } from "react"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"

interface CompareViewProps {
  input: string
  output: string
  syntaxThemeId: string
}

export function CompareView({ input, output, syntaxThemeId }: CompareViewProps) {
  const theme = getSyntaxTheme(syntaxThemeId)
  const rows = useMemo(() => buildRows(input, output || input), [input, output])

  if (!input) return null

  return (
    <div
      className="syntax-surface grid min-h-full grid-cols-1 font-mono text-[12.5px] leading-[1.6] md:grid-cols-2"
      style={syntaxThemeVars(theme) as CSSProperties}
    >
      <ComparePane title="Input" rows={rows.map((row) => row.before)} />
      <ComparePane title="Formatted" rows={rows.map((row) => row.after)} border />
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
          <div
            key={row.lineNumber}
            className={row.changed ? "bg-(--syn-match)" : ""}
          >
            <span className="inline-block w-10 select-none pr-3 text-right text-(--syn-gutter)">
              {row.lineNumber}
            </span>
            <code>{row.text || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  )
}

function buildRows(input: string, output: string): { before: Row; after: Row }[] {
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
