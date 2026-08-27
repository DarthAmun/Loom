import type { Entity } from "../../entities/types.js"

/** Phase C — Resistance/Weakness/Immunity, the first drafted Entities that
 * exercise an actually-consumed Hook (engine/incomingDamage.ts's
 * "incomingDamage.byTag"). Immunity's shape matches loom-import-pf2e's
 * handleImmunity exactly (value: the matching tag as a bare string), so
 * PF2e-converted immunities plug in without a re-shape. */
export const fireImmunity: Entity = {
  id: "core.immunity.fire",
  name: "Fire Immunity",
  tags: ["source:core", "category:passive", "trait:fire"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [{ appliesTo: "incomingDamage.byTag", operation: "negateIfTagged", value: "fire" }],
  effects: [],
}

/** Resistance and Weakness share one operation (`adjustIfTagged`) per the
 * schema-fixes-plan: Resistance is a negative amount, Weakness a positive
 * one — see AdjustIfTaggedValue's doc comment in entities/types.ts. */
export const fireResistance: Entity = {
  id: "core.resistance.fire",
  name: "Fire Resistance 5",
  tags: ["source:core", "category:passive", "trait:fire"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [{ appliesTo: "incomingDamage.byTag", operation: "adjustIfTagged", value: { tag: "fire", amount: -5 } }],
  effects: [],
}

export const fireWeakness: Entity = {
  id: "core.weakness.fire",
  name: "Fire Weakness 5",
  tags: ["source:core", "category:passive", "trait:fire"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [{ appliesTo: "incomingDamage.byTag", operation: "adjustIfTagged", value: { tag: "fire", amount: 5 } }],
  effects: [],
}
