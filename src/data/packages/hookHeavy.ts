import type { Entity } from "../../entities/types.js"

/** Package C — weapon traits, Hook-heavy. Finesse (core.trait.finesse) plus
 * two more traits exercising the other two Hook operations
 * ("replaceCurve", "negateIfTagged"), so all three declared operations have
 * at least one drafted example. As with Finesse, none of these are actually
 * consumed by Phase 0's engine (see core.trait.finesse's note) — they're
 * schema-shape drafts, flagged for the same reason. */

export { finesse } from "../mechanics/weaponTraits.js"

export const agile: Entity = {
  id: "pkg.hooks.agile",
  name: "Agile",
  tags: ["source:core", "category:weapon-trait", "trait:agile"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [
    {
      appliesTo: "multipleAttackPenalty.curve",
      operation: "replaceCurve",
      value: { second: -4, third: -8 }, // vs the default -5/-10
    },
  ],
  effects: [],
}

export const versatileS: Entity = {
  id: "pkg.hooks.versatileS",
  name: "Versatile (Slashing)",
  tags: ["source:core", "category:weapon-trait", "trait:versatile-s"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [
    {
      // negateIfTagged reads as "cancel some other effect when a tag is
      // present" everywhere else it's used (e.g. incoming-damage
      // resistances); here it has to mean something closer to "swap the
      // damage type unless a tag says otherwise", which is a stretch of the
      // same operation name for a different purpose. Flagged in README.
      appliesTo: "damage.type",
      operation: "negateIfTagged",
      value: { unlessTag: "damage:bludgeoning-or-piercing-forced", fallback: "slashing" },
    },
  ],
  effects: [],
}
