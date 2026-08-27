// Runtime validation for Character JSON crossing an external boundary —
// currently just the export/import bundle (src/storage/exportImport.ts).
// Mirrors entities/schema.ts's approach: types.ts checks shape at compile
// time, this checks it at runtime for JSON parsed from a file/paste.
//
// Character.proficiencies and .resources are Maps, which don't survive
// JSON.stringify/parse (they'd serialize as "{}"). CharacterExportSchema
// validates the JSON-safe Record form instead — exportImport.ts converts
// to/from the real Map-based Character at the storage boundary.
import { z } from "zod"
import { DurationSpecSchema, ProficiencyRankSchema } from "../entities/schema.js"

const EntityInstanceSchema = z.object({
  entityId: z.string(),
  source: z.string().optional(),
  duration: DurationSpecSchema.optional(),
  runtimeState: z.record(z.string(), z.unknown()).optional(),
})

export const CharacterExportSchema = z.object({
  name: z.string().min(1, "name is required"),
  createdAt: z.string(),
  updatedAt: z.string(),
  attributes: z.record(z.string(), z.number()),
  level: z.number(),
  proficiencies: z.record(z.string(), ProficiencyRankSchema),
  resources: z.record(z.string(), z.object({ current: z.number(), max: z.number() })),
  activeEntities: z.array(EntityInstanceSchema),
})

export type CharacterExport = z.infer<typeof CharacterExportSchema>
