import type { Entity } from "../../entities/types.js"

/** #2 Power Attack — `wraps`-heavy: it IS a Strike, just with the numbers
 * changed, rather than a new action from scratch. cost:"inherit" pulls its
 * action cost from the wrapped entity instead of restating "1 action".
 *
 * Open question flagged in README: `wraps` says Power Attack "wraps" Strike,
 * but nothing in the schema says whether that means "replace Strike's
 * effects" or "run both and combine" — Phase 0 assumes the engine, when
 * resolving a wrapping Entity, uses the wrapper's own effects/variants in
 * place of the base's (full override), which is what's modeled here. */
export const powerAttack: Entity = {
  id: "core.powerAttack",
  name: "Power Attack",
  tags: ["source:core", "category:strike", "martial"],
  prerequisites: [{ kind: "level", minLevel: 1 }],
  conflicts: [],
  cost: { type: "inherit" },
  wraps: "core.strike",
  effects: [
    {
      kind: "variant",
      selectBy: "degreeOfSuccess",
      variants: [
        { kind: "value", target: "damage", op: "set", amount: 0 },
        { kind: "value", target: "damage", op: "set", amount: 0 },
        { kind: "value", target: "damage", op: "set", amount: 8 }, // heavier hit, worse accuracy (accuracy penalty not modeled in Phase 0 — no attack-roll-modifier Effect target exists yet)
        { kind: "value", target: "damage", op: "set", amount: 16 },
      ],
    },
  ],
}
