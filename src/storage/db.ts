// Phase 1 — Dexie storage. Conventions follow DM's Tome's useDb.ts: a Dexie
// subclass with versioned `.stores()`, a lazy singleton via getDb(), and a
// `now()` ISO-timestamp helper.
//
// One deliberate difference: DM's Tome JSON-stringifies nested columns
// (attributes, data, etc.) because its schema mirrors a prior SQLite layout.
// Loom has no legacy schema to mirror, and IndexedDB's structured-clone
// storage handles nested objects/arrays/Maps/Sets natively — so Entity's
// nested fields (effects, hooks, prerequisites) and Character's Map fields
// (proficiencies, resources) are stored as-is, no JSON round-trip needed.
import Dexie, { type Table } from "dexie"
import type { Entity } from "../entities/types.js"
import type { Character } from "../character/types.js"

export interface StoredCharacter extends Character {
  id?: number
  name: string
  createdAt: string
  updatedAt: string
}

export class LoomDb extends Dexie {
  entities!: Table<Entity, string>
  characters!: Table<StoredCharacter, number>

  constructor(name = "loom") {
    super(name)
    this.version(1).stores({
      // Entity.id is the natural key (string, author-assigned) — no ++id.
      // "name" is indexed for lookup/search; "*tags" is a multi-entry index
      // so `where("tags").equals(...)` finds an Entity by any one of its tags.
      entities: "id, name, *tags",
      characters: "++id, name, updatedAt",
    })
  }
}

let sharedDb: LoomDb | null = null

export function getDb(): LoomDb {
  if (!sharedDb) sharedDb = new LoomDb()
  return sharedDb
}

/** Mainly for tests: drop the singleton so the next getDb() opens fresh. */
export function resetDb(): void {
  sharedDb?.close()
  sharedDb = null
}

export function now(): string {
  return new Date().toISOString()
}
