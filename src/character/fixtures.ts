// Shared by the console demos and engine tests for building throwaway
// Characters with an arbitrary HP total — NOT the real character-creation
// path (see factory.ts for that): a demo "target" enemy or a test fixture
// doesn't need its HP derived from Layer 0 math, just *something* to hit.
import type { Character, EntityInstance } from "./types.js"

export function makeCharacter(params: { hp: number; level?: number; activeEntities?: EntityInstance[] }): Character {
  return {
    attributes: {},
    level: params.level ?? 1,
    proficiencies: new Map(),
    resources: new Map([["hp", { current: params.hp, max: params.hp }]]),
    activeEntities: params.activeEntities ?? [],
  }
}

export function hpLabel(character: Character): string {
  const res = character.resources.get("hp")
  return res ? `${res.current}/${res.max}` : "?"
}
