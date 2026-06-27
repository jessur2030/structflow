import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import { STRUCTFLOW_SCHEMA_VERSION, projectDescendantIds, type Entry, type Project } from "./types"

interface StructFlowDB extends DBSchema {
  entries: {
    key: string
    value: Entry
    indexes: { "by-project": string; "by-updated": number }
  }
  projects: {
    key: string
    value: Project
    indexes: { "by-created": number }
  }
}

let dbPromise: Promise<IDBPDatabase<StructFlowDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StructFlowDB>("structflow", STRUCTFLOW_SCHEMA_VERSION, {
      // Migrations must be ADDITIVE — never drop a store or index that may hold
      // user data. Create stores only if missing, and gate any future change on
      // `oldVersion` (e.g. `if (oldVersion < 4) { ...add an index... }`) so a
      // version bump migrates existing libraries instead of wiping them.
      upgrade(db) {
        if (!db.objectStoreNames.contains("entries")) {
          const entries = db.createObjectStore("entries", { keyPath: "id" })
          entries.createIndex("by-project", "projectId")
          entries.createIndex("by-updated", "updatedAt")
        }

        if (!db.objectStoreNames.contains("projects")) {
          const projects = db.createObjectStore("projects", { keyPath: "id" })
          projects.createIndex("by-created", "createdAt")
        }
      },
    })
  }
  return dbPromise
}

export function uid(): string {
  return crypto.randomUUID()
}

export async function getAllEntries(): Promise<Entry[]> {
  const db = await getDB()
  const all = await db.getAll("entries")
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveEntry(entry: Entry): Promise<void> {
  const db = await getDB()
  await db.put("entries", entry)
}

export async function saveEntries(entries: Entry[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("entries", "readwrite")
  await Promise.all(entries.map((entry) => tx.store.put(entry)))
  await tx.done
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("entries", id)
}

export async function moveEntry(id: string, projectId: string | null): Promise<void> {
  const db = await getDB()
  const entry = await db.get("entries", id)
  if (entry) {
    entry.projectId = projectId
    entry.updatedAt = Date.now()
    await db.put("entries", entry)
  }
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB()
  const all = await db.getAll("projects")
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put("projects", project)
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("projects", "readwrite")
  await Promise.all(projects.map((project) => tx.store.put(project)))
  await tx.done
}

/**
 * Wipe all saved entries and folders. Clears the records inside the object
 * stores; it never drops the stores themselves, so the additive-migration
 * guarantee is preserved (see storage upgrade() note). Destructive — callers
 * must confirm first.
 */
export async function clearAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(["entries", "projects"], "readwrite")
  await tx.objectStore("entries").clear()
  await tx.objectStore("projects").clear()
  await tx.done
}

/**
 * Delete a folder and everything inside it: all descendant subfolders and every
 * entry that belongs to the folder or any of its descendants (cascade delete).
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  const allProjects = await db.getAll("projects")
  const targetIds = [id, ...projectDescendantIds(id, allProjects)]
  const tx = db.transaction(["entries", "projects"], "readwrite")
  for (const pid of targetIds) {
    const entries = await tx.objectStore("entries").index("by-project").getAll(pid)
    for (const entry of entries) {
      await tx.objectStore("entries").delete(entry.id)
    }
    await tx.objectStore("projects").delete(pid)
  }
  await tx.done
}
