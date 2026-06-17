import { type FormatOptions, type IndentStyle, type Language } from "@/lib/types"
import { cn } from "@/lib/utils"

interface OptionsPanelProps {
  language: Language
  options: FormatOptions
  onChange: (next: FormatOptions) => void
}

const INDENTS: { value: IndentStyle; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
  { value: "minify", label: "Minify" },
]

export function OptionsPanel({ language, options, onChange }: OptionsPanelProps) {
  const set = <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) =>
    onChange({ ...options, [key]: value })

  const isJsLike = language === "javascript" || language === "typescript"
  const isPrettier = isJsLike || language === "html" || language === "css" || language === "markdown"

  return (
    <div className="space-y-4 border-b border-border bg-card/50 px-4 py-3.5 text-[13px]">
      <Field label="Indentation">
        <div className="flex flex-wrap gap-1">
          {INDENTS.map((opt) => (
            <Segment
              key={opt.value}
              active={options.indent === opt.value}
              onClick={() => set("indent", opt.value)}
            >
              {opt.label}
            </Segment>
          ))}
        </div>
      </Field>

      {language === "json" && (
        <Toggle
          label="Sort keys alphabetically"
          checked={options.sortKeys}
          onChange={(v) => set("sortKeys", v)}
        />
      )}

      {isPrettier && (
        <Field label={`Print width: ${options.printWidth}`}>
          <input
            type="range"
            min={40}
            max={160}
            step={10}
            value={options.printWidth}
            onChange={(e) => set("printWidth", Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
      )}

      {isJsLike && (
        <div className="grid grid-cols-1 gap-2.5">
          <Toggle label="Single quotes" checked={options.singleQuote} onChange={(v) => set("singleQuote", v)} />
          <Toggle label="Semicolons" checked={options.semi} onChange={(v) => set("semi", v)} />
          <Field label="Trailing commas">
            <div className="flex gap-1">
              {(["none", "es5", "all"] as const).map((tc) => (
                <Segment key={tc} active={options.trailingComma === tc} onClick={() => set("trailingComma", tc)}>
                  {tc}
                </Segment>
              ))}
            </div>
          </Field>
        </div>
      )}

      {language === "sql" && (
        <Toggle
          label="Uppercase keywords"
          checked={options.sqlUppercase}
          onChange={(v) => set("sqlUppercase", v)}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between text-left"
    >
      <span className="text-foreground/90">{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  )
}
