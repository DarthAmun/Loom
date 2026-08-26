import type { Entity } from "../../entities/types.js"

/** #13 Weapon Traits — Finesse as the canonical Hook example: it doesn't add
 * a value, it changes *which* input another computation uses.
 *
 * Hook.value is typed `unknown`, which is honest about the schema (a hook
 * target like "attackRoll.abilityScoreSource" needs a payload shaped
 * differently per operation), but it does mean hooks aren't declaratively
 * interpretable — the engine has to special-case *this exact appliesTo +
 * operation* string to know what shape `value` is. Every new hook target
 * effectively adds a bespoke interpreter, not just data. Flagged in README;
 * Phase 0's engine doesn't consume this hook at all yet (see core.armor's
 * note on the same "declared but not wired into resolution" gap). */
export const finesse: Entity = {
  id: "core.trait.finesse",
  name: "Finesse",
  tags: ["source:core", "category:weapon-trait", "trait:finesse"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [
    {
      appliesTo: "attackRoll.abilityScoreSource",
      operation: "override",
      value: { preferHigherOf: ["str", "dex"] },
    },
  ],
  effects: [],
}
