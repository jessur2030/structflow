import { describe, it, expect } from "vitest"
import { formatCode, tryWrapJsonValues, validate } from "@/lib/formatter"
import { DEFAULT_OPTIONS, type FormatOptions } from "@/lib/types"

const opts = (overrides: Partial<FormatOptions> = {}): FormatOptions => ({
  ...DEFAULT_OPTIONS,
  ...overrides,
})

describe("formatCode - JSON", () => {
  it("pretty-prints with 2-space indent by default", async () => {
    const res = await formatCode("json", '{"a":1,"b":2}', opts())
    expect(res.ok).toBe(true)
    expect(res.output).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it("minifies when indent is 'minify'", async () => {
    const res = await formatCode("json", '{\n  "a": 1\n}', opts({ indent: "minify" }))
    expect(res.output).toBe('{"a":1}')
  })

  it("sorts keys deeply when sortKeys is set", async () => {
    const res = await formatCode("json", '{"b":1,"a":{"d":1,"c":2}}', opts({ sortKeys: true }))
    expect(res.output).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}')
  })

  it("indents with a tab when indent is 'tab'", async () => {
    const res = await formatCode("json", '{"a":1}', opts({ indent: "tab" }))
    expect(res.output).toBe('{\n\t"a": 1\n}')
  })

  it("reports invalid JSON with a line/column hint", async () => {
    const res = await formatCode("json", "{ bad }", opts())
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/line \d+, column \d+/)
    expect(res.output).toBe("{ bad }") // original returned untouched
  })
})

describe("formatCode - other languages", () => {
  it("returns empty output for blank input", async () => {
    const res = await formatCode("json", "   \n  ", opts())
    expect(res).toEqual({ ok: true, output: "" })
  })

  it("never reformats plain text", async () => {
    const input = "just   some\n  notes"
    const res = await formatCode("text", input, opts())
    expect(res.output).toBe(input)
  })

  it("formats TypeScript via prettier (semicolons on by default)", async () => {
    const res = await formatCode("typescript", "const   x=1", opts())
    expect(res.ok).toBe(true)
    expect(res.output).toBe("const x = 1;\n")
  })

  it("respects the semi:false option for TypeScript", async () => {
    const res = await formatCode("typescript", "const x = 1", opts({ semi: false }))
    expect(res.output).toBe("const x = 1\n")
  })

  it("formats CSS via prettier", async () => {
    const res = await formatCode("css", "a{color:red}", opts())
    expect(res.ok).toBe(true)
    expect(res.output).toContain("color: red;")
  })

  it("uppercases SQL keywords when requested", async () => {
    const res = await formatCode("sql", "select id from users", opts({ sqlUppercase: true }))
    expect(res.output).toContain("SELECT")
    expect(res.output).toContain("FROM")
  })
})

describe("validate", () => {
  it("accepts valid JSON", () => {
    expect(validate("json", '{"a":1}')).toEqual({ ok: true })
  })

  it("rejects invalid JSON with an error", () => {
    const res = validate("json", "{ nope }")
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })

  it("treats blank input as valid", () => {
    expect(validate("json", "  ")).toEqual({ ok: true })
  })

  it("does not validate non-JSON languages", () => {
    expect(validate("typescript", "const x = (")).toEqual({ ok: true })
  })
})

describe("tryWrapJsonValues (recovering loose JSON objects)", () => {
  it("recovers NDJSON / JSON Lines (one object per line, no commas)", () => {
    const res = tryWrapJsonValues('{"a":1}\n{"b":2}\n{"c":3}')
    expect(res?.count).toBe(3)
    expect(JSON.parse(res!.wrapped)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it("recovers a fragment copied out of an array (commas, no brackets)", () => {
    const res = tryWrapJsonValues('{"a":1},\n{"b":2}')
    expect(res?.count).toBe(2)
    expect(JSON.parse(res!.wrapped)).toEqual([{ a: 1 }, { b: 2 }])
  })

  it("recovers multi-line pretty-printed objects (the common copy/paste case)", () => {
    const res = tryWrapJsonValues('{\n  "a": 1\n},\n{\n  "b": 2\n}')
    expect(res?.count).toBe(2)
    expect(JSON.parse(res!.wrapped)).toEqual([{ a: 1 }, { b: 2 }])
  })

  it("is not confused by braces or commas inside strings", () => {
    const res = tryWrapJsonValues('{"a":"},{"}\n{"b":"x"}')
    expect(res?.count).toBe(2)
    expect(JSON.parse(res!.wrapped)).toEqual([{ a: "},{" }, { b: "x" }])
  })

  it("returns null for already-valid JSON (nothing to fix)", () => {
    expect(tryWrapJsonValues('[{"a":1},{"b":2}]')).toBeNull() // a single top-level value
    expect(tryWrapJsonValues('{"a":1}')).toBeNull()
  })

  it("returns null for input that isn't just loose JSON values", () => {
    expect(tryWrapJsonValues("not json at all")).toBeNull()
    expect(tryWrapJsonValues('{"a":1} trailing junk {"b":2}')).toBeNull()
    expect(tryWrapJsonValues('{"a":1}\n{"b":')).toBeNull() // truncated
  })
})
