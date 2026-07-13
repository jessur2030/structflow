import prettier from "prettier/standalone"
import * as pluginBabel from "prettier/plugins/babel"
import * as pluginEstree from "prettier/plugins/estree"
import * as pluginTypescript from "prettier/plugins/typescript"
import * as pluginHtml from "prettier/plugins/html"
import * as pluginPostcss from "prettier/plugins/postcss"
import * as pluginMarkdown from "prettier/plugins/markdown"
import * as pluginYaml from "prettier/plugins/yaml"
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

/**
 * Split input into top-level JSON values (objects/arrays). Returns null unless the
 * whole buffer is nothing but such values, separated only by whitespace/commas.
 * String- and depth-aware, so braces inside strings don't confuse it.
 */
function scanTopLevelJsonValues(input: string): string[] | null {
  const values: string[] = []
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
      continue
    }

    if (depth === 0) {
      // Between values only whitespace and separating commas are allowed. Anything
      // else (a bare scalar, stray text) means this isn't the shape we can recover.
      if (ch === "{" || ch === "[") {
        start = i
        depth++
      } else if (ch !== "," && !/\s/.test(ch)) {
        return null
      }
      continue
    }

    if (ch === '"') inStr = true
    else if (ch === "{" || ch === "[") depth++
    else if (ch === "}" || ch === "]") {
      depth--
      if (depth === 0 && start >= 0) {
        values.push(input.slice(start, i + 1))
        start = -1
      }
    }
  }

  if (depth !== 0 || inStr) return null
  return values
}

/**
 * Recover the two common "almost JSON" shapes: NDJSON / JSON Lines (one object per
 * line, no commas) and a fragment copied out of the middle of an array (objects
 * separated by commas, no wrapping brackets). Returns how many values were found
 * plus the bracket-wrapped text, or null when the input isn't that shape.
 *
 * Only used to OFFER a fix; it never rewrites the buffer on its own.
 */
export function tryWrapJsonValues(input: string): { count: number; wrapped: string } | null {
  const values = scanTopLevelJsonValues(input)
  if (!values || values.length < 2) return null

  const wrapped = `[${values.join(",")}]`
  try {
    JSON.parse(wrapped)
  } catch {
    return null
  }
  return { count: values.length, wrapped }
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
      case "yaml": {
        const out = await prettier.format(input, {
          parser: "yaml",
          plugins: [pluginYaml],
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
