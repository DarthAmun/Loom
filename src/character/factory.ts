// The real character-creation path: ties Layer 0 (core math) to a Layer 4
// Character. Kept separate from src/storage so persistence stays generic
// ("save this Character") rather than owning game-math defaults — storage's
// characterStore.create calls this and persists the result.
import { classHpForTier, type DurabilityTier } from "../core/scaling.js"
import type { Character, EntityInstance } from "./types.js"

export interface NewCharacterParams {
  level: number
  durabilityTier: DurabilityTier
  /** Ancestry HP + key-ability modifier — the part of PF2e's HP total that
   * class-tier HP (Layer 0's classHpForTier) doesn't cover. Real values are
   * a Layer 5/character-builder concern; Phase 1 just needs *something*
   * plausible so starting HP isn't zero. */
  ancestryAndAbilityHp?: number
  attributes?: Record<string, number>
  activeEntities?: EntityInstance[]
}

export function createCharacter(params: NewCharacterParams): Character {
  const hp = (params.ancestryAndAbilityHp ?? 8) + classHpForTier(params.durabilityTier, params.level)
  return {
    attributes: params.attributes ?? {},
    level: params.level,
    proficiencies: new Map(),
    resources: new Map([["hp", { current: hp, max: hp }]]),
    activeEntities: params.activeEntities ?? [],
  }
}
