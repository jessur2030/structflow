import { describe, it, expect } from "vitest"
import {
  projectChildren,
  projectDescendantIds,
  projectPath,
  type Project,
} from "@/lib/types"

// Tree:  work
//        ├─ sql
//        │  └─ reports
//        └─ js
//        personal
const p = (id: string, name: string, parentId: string | null = null): Project => ({
  id,
  name,
  color: "#000",
  createdAt: 1,
  parentId,
})
const projects: Project[] = [
  p("work", "Work"),
  p("sql", "SQL", "work"),
  p("reports", "Reports", "sql"),
  p("js", "JS", "work"),
  p("personal", "Personal"),
]

describe("projectChildren", () => {
  it("returns top-level folders for null parent", () => {
    expect(projectChildren(null, projects).map((x) => x.id).sort()).toEqual(["personal", "work"])
  })

  it("returns direct children of a folder", () => {
    expect(projectChildren("work", projects).map((x) => x.id).sort()).toEqual(["js", "sql"])
  })

  it("treats a missing parentId as top-level", () => {
    const legacy: Project = { id: "old", name: "Old", color: "#000", createdAt: 1 } // no parentId
    expect(projectChildren(null, [legacy])).toHaveLength(1)
  })
})

describe("projectDescendantIds", () => {
  it("collects all nested descendants (depth > 1)", () => {
    expect(projectDescendantIds("work", projects).sort()).toEqual(["js", "reports", "sql"])
  })

  it("returns [] for a leaf folder", () => {
    expect(projectDescendantIds("reports", projects)).toEqual([])
  })
})

describe("projectPath", () => {
  it("builds the breadcrumb from root to the folder", () => {
    expect(projectPath("reports", projects)).toEqual(["Work", "SQL", "Reports"])
  })

  it("returns a single name for a top-level folder", () => {
    expect(projectPath("personal", projects)).toEqual(["Personal"])
  })

  it("returns [] for null", () => {
    expect(projectPath(null, projects)).toEqual([])
  })
})
