// Export/import: turns a selection of stored Entities and Characters into
// one portable JSON bundle (a file the UI can offer for download, or the
// user can paste back in), and applies a parsed bundle back into the local
// database. Two concerns this file owns that the plain stores don't:
//  - Character's Map fields (proficiencies, resources) don't survive
//    JSON.stringify/parse — converted to plain Records at the boundary
//    (see character/schema.ts's CharacterExportSchema).
//  - A Character's `id` is a local Dexie autoincrement, meaningless in
//    another database (or after a re-import into the same one) — imported
//    characters are always inserted as new rows, never matched by id.
import { z } from "zod"
import { getDb, now, type StoredCharacter } from "./db.js"
import { entityStore } from "./entityStore.js"
import { EntitySchema } from "../entities/schema.js"
import { CharacterExportSchema, type CharacterExport } from "../character/schema.js"
import type { Entity } from "../entities/types.js"

export const EXPORT_FORMAT = "loom-export"
export const EXPORT_VERSION = 1

export interface ExportBundle {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  exportedAt: string
  entities: Entity[]
  characters: CharacterExport[]
}

const ExportBundleSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  entities: z.array(EntitySchema),
  characters: z.array(CharacterExportSchema),
})

function toCharacterExport(character: StoredCharacter): CharacterExport {
  return {
    name: character.name,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    attributes: character.attributes,
    level: character.level,
    proficiencies: Object.fromEntries(character.proficiencies),
    resources: Object.fromEntries(character.resources),
    activeEntities: character.activeEntities,
  }
}

function fromCharacterExport(exported: CharacterExport): StoredCharacter {
  return {
    name: exported.name,
    createdAt: exported.createdAt,
    updatedAt: exported.updatedAt,
    attributes: exported.attributes,
    level: exported.level,
    proficiencies: new Map(Object.entries(exported.proficiencies)),
    resources: new Map(Object.entries(exported.resources)),
    // Same exactOptionalPropertyTypes cast as parseExportBundle's — zod's
    // inferred optional fields are `T | undefined`, not `T?`.
    activeEntities: exported.activeEntities as StoredCharacter["activeEntities"],
  }
}

/** Builds a portable bundle from a selection of ids — pass every id (e.g.
 * from the full store list) for a full export, or a subset for a partial
 * one. An id with nothing behind it (deleted between the selection UI
 * rendering and the export click) is silently skipped. */
export async function buildExportBundle(entityIds: readonly string[], characterIds: readonly number[]): Promise<ExportBundle> {
  const db = getDb()
  const [entities, characters] = await Promise.all([db.entities.bulkGet([...entityIds]), db.characters.bulkGet([...characterIds])])
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now(),
    entities: entities.filter((entity): entity is Entity => entity !== undefined),
    characters: characters.filter((character): character is StoredCharacter => character !== undefined).map(toCharacterExport),
  }
}

export type ParseBundleResult = { success: true; data: ExportBundle } | { success: false; error: string }

/** Human-readable validation of pasted/uploaded JSON, same shape as
 * safeParseEntity — a UI wants to display the problem, not catch an
 * exception. The cast mirrors safeParseEntity's: zod's inferred optional
 * fields are `T | undefined`, which trips exactOptionalPropertyTypes
 * against the hand-written Entity/CharacterExport types even though the
 * two are structurally the same at runtime. */
export function parseExportBundle(json: unknown): ParseBundleResult {
  const result = ExportBundleSchema.safeParse(json)
  if (result.success) return { success: true, data: result.data as ExportBundle }
  return { success: false, error: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n") }
}

export interface ImportSelection {
  /** Ids to import, out of bundle.entities. Omit to import every entity in the bundle. */
  entityIds?: readonly string[]
  /** Indices into bundle.characters to import. Omit to import every character in the bundle. */
  characterIndices?: readonly number[]
}

export interface ImportSummary {
  entitiesImported: number
  charactersImported: number
}

/** Applies a validated bundle to the local database. Entities upsert by id
 * — an id already present is overwritten, same as a plain entityStore.put.
 * Characters are always inserted as new rows (see file header). */
export async function importBundle(bundle: ExportBundle, selection: ImportSelection = {}): Promise<ImportSummary> {
  const entityIds = selection.entityIds
  const entities = entityIds ? bundle.entities.filter((entity) => entityIds.includes(entity.id)) : bundle.entities

  const characterIndices = selection.characterIndices
  const characters = characterIndices
    ? characterIndices.map((index) => bundle.characters[index]).filter((character): character is CharacterExport => character !== undefined)
    : bundle.characters

  if (entities.length > 0) await entityStore.putAll(entities)
  if (characters.length > 0) await getDb().characters.bulkAdd(characters.map(fromCharacterExport))

  return { entitiesImported: entities.length, charactersImported: characters.length }
}
