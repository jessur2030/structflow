import { describe, it, expect } from "vitest"
import { buildRows } from "@/components/diff-view"

describe("buildRows", () => {
  it("pairs equal lines and flags none as changed", () => {
    const rows = buildRows("a\nb", "a\nb")
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => !r.before.changed && !r.after.changed)).toBe(true)
    expect(rows[0].before.lineNumber).toBe(1)
    expect(rows[1].after.lineNumber).toBe(2)
  })

  it("flags lines that differ", () => {
    const rows = buildRows("a\nb", "a\nB")
    expect(rows[0].before.changed).toBe(false)
    expect(rows[1].before.changed).toBe(true)
    expect(rows[1].after.text).toBe("B")
  })

  it("pads the shorter side and flags the extra lines", () => {
    const rows = buildRows("a", "a\nb\nc")
    expect(rows).toHaveLength(3)
    expect(rows[0].before.changed).toBe(false)
    expect(rows[1].before.text).toBe("")
    expect(rows[1].before.changed).toBe(true)
    expect(rows[2].after.text).toBe("c")
  })

  it("treats a trailing newline as an extra empty line", () => {
    const rows = buildRows("a", "a\n")
    expect(rows).toHaveLength(2)
    expect(rows[1].before.text).toBe("")
    expect(rows[1].after.text).toBe("")
  })
})
