import type { Entity } from "../../entities/types.js"

/** #1 Strike — the base attack action every character has "for free".
 *
 * The roll-vs-AC and degree-of-success branching is engine-native
 * (GameEngine.resolveStrike), not expressible via the four Effect kinds
 * alone — see README's report. This Entity only supplies what *is*
 * data-driven: cost, and damage-by-degree-of-success as a `variant` effect.
 *
 * Damage is a flat placeholder number standing in for "weapon die average +
 * ability mod" — the schema has no dice-expression type, only
 * number | ScalingRule, so real dice damage isn't representable without
 * adding one. Flagged in README. */
export const strike: Entity = {
  id: "core.strike",
  name: "Strike",
  tags: ["source:core", "category:strike"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "actions", count: 1 },
  effects: [
    {
      kind: "variant",
      selectBy: "degreeOfSuccess",
      variants: [
        { kind: "value", target: "damage", op: "set", amount: 0 }, // criticalFailure
        { kind: "value", target: "damage", op: "set", amount: 0 }, // failure
        { kind: "value", target: "damage", op: "set", amount: 4 }, // success (placeholder avg weapon damage)
        { kind: "value", target: "damage", op: "set", amount: 8 }, // criticalSuccess (doubled)
      ],
    },
  ],
}
