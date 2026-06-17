import prettier from "prettier/standalone"
import * as pluginBabel from "prettier/plugins/babel"
import * as pluginEstree from "prettier/plugins/estree"
import * as pluginTypescript from "prettier/plugins/typescript"
import * as pluginHtml from "prettier/plugins/html"
import * as pluginPostcss from "prettier/plugins/postcss"
import * as pluginMarkdown from "prettier/plugins/markdown"
import { format as formatSql } from "sql-formatter"
import type { FormatOptions, Language } from "./types"

export interface FormatResult {
  ok: boolean
  output: string
  error?: string
}

function indentWidth(opts: FormatOptions): number {
  if (opts.indent === "tab") return 1
  if (opts.indent === "4") return 4
  return 2
}

function prettierBase(opts: FormatOptions) {
  return {
    printWidth: opts.printWidth,
    tabWidth: opts.indent === "4" ? 4 : 2,
    useTabs: opts.indent === "tab",
    singleQuote: opts.singleQuote,
    semi: opts.semi,
    trailingComma: opts.trailingComma,
  }
}

// JSON gets its own path so we can support sort-keys + minify without Prettier.
function formatJson(input: string, opts: FormatOptions): FormatResult {
  try {
    const parsed = JSON.parse(input)
    const sorted = opts.sortKeys ? sortDeep(parsed) : parsed
    if (opts.indent === "minify") {
      return { ok: true, output: JSON.stringify(sorted) }
    }
    const space = opts.indent === "tab" ? "\t" : indentWidth(opts)
    return { ok: true, output: JSON.stringify(sorted, null, space as number | string) }
  } catch (err) {
    return { ok: false, output: input, error: humanizeJsonError(err, input) }
  }
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

function humanizeJsonError(err: unknown, input: string): string {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/position (\d+)/)
  if (match) {
    const pos = Number(match[1])
    const before = input.slice(0, pos)
    const line = before.split("\n").length
    const col = pos - before.lastIndexOf("\n")
    return `${msg} (line ${line}, column ${col})`
  }
  return msg
}

export async function formatCode(
  language: Language,
  input: string,
  opts: FormatOptions,
): Promise<FormatResult> {
  if (!input.trim()) return { ok: true, output: "" }

  try {
    switch (language) {
      case "text":
        // Plain text is a note-taking surface; never reformat it.
        return { ok: true, output: input }
      case "json":
        return formatJson(input, opts)
      case "javascript": {
        const out = await prettier.format(input, {
          parser: "babel",
          plugins: [pluginBabel, pluginEstree],
          ...prettierBase(opts),
        })
        return { ok: true, output: out }
      }
      case "typescript": {
        const out = await prettier.format(input, {
          parser: "typescript",
          plugins: [pluginTypescript, pluginEstree],
          ...prettierBase(opts),
        })
        return { ok: true, output: out }
      }
      case "html": {
        const out = await prettier.format(input, {
          parser: "html",
          plugins: [pluginHtml],
          ...prettierBase(opts),
        })
        return { ok: true, output: out }
      }
      case "css": {
        const out = await prettier.format(input, {
          parser: "css",
          plugins: [pluginPostcss],
          ...prettierBase(opts),
        })
        return { ok: true, output: out }
      }
      case "markdown": {
        const out = await prettier.format(input, {
          parser: "markdown",
          plugins: [pluginMarkdown],
          ...prettierBase(opts),
        })
        return { ok: true, output: out }
      }
      case "sql": {
        const out = formatSql(input, {
          tabWidth: opts.indent === "tab" ? 1 : indentWidth(opts),
          useTabs: opts.indent === "tab",
          keywordCase: opts.sqlUppercase ? "upper" : "lower",
        })
        return { ok: true, output: out }
      }
      default:
        return { ok: true, output: input }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, output: input, error: msg }
  }
}

/** Validate without reformatting (used for the status indicator). */
export function validate(language: Language, input: string): { ok: boolean; error?: string } {
  if (!input.trim()) return { ok: true }
  if (language === "json") {
    try {
      JSON.parse(input)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: humanizeJsonError(err, input) }
    }
  }
  return { ok: true }
}
