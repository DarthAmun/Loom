import type { ProficiencyRank } from "../core/proficiency.js"
import type { DurationSpec, EntityRef } from "../entities/types.js"

export interface EntityInstance {
  entityId: EntityRef
  /** What granted this — a class package, an item, a spell slot expenditure, etc. Provenance-lite for Phase 0. */
  source?: string
  duration?: DurationSpec
  /** Runtime knobs an instance carries that the Entity definition itself doesn't, e.g. which cast level a spell was heightened to. */
  runtimeState?: Record<string, unknown>
}

export interface Character {
  attributes: Record<string, number>
  level: number
  proficiencies: Map<string, ProficiencyRank>
  resources: Map<string, { current: number; max: number }>
  activeEntities: EntityInstance[]
}

export interface GameEvent {
  type: string
  payload: Record<string, unknown>
}
