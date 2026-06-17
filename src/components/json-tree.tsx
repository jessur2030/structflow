import { useMemo, useState } from "react"
import { ChevronRight, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { copyToClipboard } from "@/lib/io"
import { getSyntaxTheme, syntaxThemeVars } from "@/lib/syntax-themes"

interface JsonTreeProps {
  data: unknown
  search: string
  syntaxThemeId: string
}

export function JsonTree({ data, search, syntaxThemeId }: JsonTreeProps) {
  const theme = getSyntaxTheme(syntaxThemeId)
  return (
    <div
      className="syntax-surface min-h-full px-2 py-2 font-mono text-[12.5px] leading-[1.7]"
      style={syntaxThemeVars(theme) as React.CSSProperties}
    >
      <TreeNode keyName={null} value={data} depth={0} search={search.toLowerCase()} defaultOpen />
    </div>
  )
}

interface TreeNodeProps {
  keyName: string | null
  value: unknown
  depth: number
  search: string
  defaultOpen?: boolean
  isLast?: boolean
}

function TreeNode({ keyName, value, depth, search, defaultOpen, isLast }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2 || !!defaultOpen)
  const [copied, setCopied] = useState(false)

  const isObject = value !== null && typeof value === "object"
  const isArray = Array.isArray(value)
  const entries = useMemo(
    () => (isObject ? Object.entries(value as Record<string, unknown>) : []),
    [isObject, value],
  )

  const matches =
    !!search &&
    ((keyName != null && keyName.toLowerCase().includes(search)) ||
      (!isObject && String(value).toLowerCase().includes(search)))

  const copyValue = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = isObject ? JSON.stringify(value, null, 2) : String(value)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  const keyLabel =
    keyName != null ? (
      <span className={cn("syn-key", matches && "syn-match")}>
        {isArray || !Number.isNaN(Number(keyName)) ? keyName : `"${keyName}"`}
      </span>
    ) : null

  if (!isObject) {
    return (
      <div
        className="group flex items-start gap-1 rounded pl-[var(--indent)] pr-1 hover:bg-[color-mix(in_srgb,var(--syn-fg)_8%,transparent)]"
        style={{ ["--indent" as string]: `${depth * 12 + 4}px` }}
      >
        <span className="w-3.5 shrink-0" />
        <span className="min-w-0 break-all">
          {keyLabel}
          {keyName != null && <span className="syn-punctuation">: </span>}
          <ValueLiteral value={value} highlight={matches && !!search} />
          {!isLast && <span className="syn-punctuation">,</span>}
        </span>
        <CopyDot copied={copied} onClick={copyValue} />
      </div>
    )
  }

  const openBrace = isArray ? "[" : "{"
  const close = isArray ? "]" : "}"

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded pl-[var(--indent)] pr-1 hover:bg-[color-mix(in_srgb,var(--syn-fg)_8%,transparent)] cursor-pointer"
        style={{ ["--indent" as string]: `${depth * 12 + 4}px` }}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform syn-punctuation", open && "rotate-90")}
        />
        <span className="min-w-0 break-all">
          {keyLabel}
          {keyName != null && <span className="syn-punctuation">: </span>}
          <span className="syn-punctuation">{openBrace}</span>
          {!open && (
            <span className="opacity-70 syn-punctuation">
              {" "}
              {entries.length} {entries.length === 1 ? "item" : "items"}{" "}
              <span>{close}</span>
            </span>
          )}
        </span>
        <CopyDot copied={copied} onClick={copyValue} />
      </div>

      {open && (
        <div>
          {entries.map(([k, v], i) => (
            <TreeNode
              key={k}
              keyName={k}
              value={v}
              depth={depth + 1}
              search={search}
              isLast={i === entries.length - 1}
            />
          ))}
          <div
            className="pl-[var(--indent)] syn-punctuation"
            style={{ ["--indent" as string]: `${depth * 12 + 4 + 18}px` }}
          >
            {close}
            {!isLast && depth > 0 && ","}
          </div>
        </div>
      )}
    </div>
  )
}

function ValueLiteral({ value, highlight }: { value: unknown; highlight: boolean }) {
  let cls = "syn-string"
  let text = String(value)
  if (typeof value === "string") {
    cls = "syn-string"
    text = `"${value}"`
  } else if (typeof value === "number") {
    cls = "syn-number"
  } else if (typeof value === "boolean") {
    cls = "syn-boolean"
  } else if (value === null) {
    cls = "syn-null"
    text = "null"
  }
  return <span className={cn(cls, highlight && "syn-match")}>{text}</span>
}

function CopyDot({ copied, onClick }: { copied: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy value"
      className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[color-mix(in_srgb,var(--syn-fg)_12%,transparent)] group-hover:opacity-100 syn-punctuation"
    >
      {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}
