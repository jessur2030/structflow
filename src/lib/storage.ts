import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import { STRUCTFLOW_SCHEMA_VERSION, type Entry, type Project } from "./types"

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
      upgrade(db) {
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name)
        }

        const entries = db.createObjectStore("entries", { keyPath: "id" })
        entries.createIndex("by-project", "projectId")
        entries.createIndex("by-updated", "updatedAt")

        const projects = db.createObjectStore("projects", { keyPath: "id" })
        projects.createIndex("by-created", "createdAt")
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

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  const entries = await db.getAllFromIndex("entries", "by-project", id)
  const tx = db.transaction(["entries", "projects"], "readwrite")
  for (const entry of entries) {
    entry.projectId = null
    await tx.objectStore("entries").put(entry)
  }
  await tx.objectStore("projects").delete(id)
  await tx.done
}
