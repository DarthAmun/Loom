import type { Entity } from "../../entities/types.js"

/** Package A — martial, `wraps`-heavy. Strike (core.strike) plus two more
 * Strike variants that only change the numbers, exercising `wraps` +
 * cost:"inherit" repeatedly to see if the pattern holds up across more than
 * one example. It does — no schema changes needed for this package. */

export { strike } from "../mechanics/strike.js"
export { powerAttack } from "../mechanics/powerAttack.js"

export const certainStrike: Entity = {
  id: "pkg.martial.certainStrike",
  name: "Certain Strike",
  tags: ["source:core", "category:strike", "martial"],
  prerequisites: [{ kind: "level", minLevel: 3 }],
  conflicts: [],
  cost: { type: "inherit" },
  wraps: "core.strike",
  effects: [
    {
      kind: "variant",
      selectBy: "degreeOfSuccess",
      variants: [
        { kind: "value", target: "damage", op: "set", amount: 4 }, // even on a miss it deals damage — the whole point of the feat
        { kind: "value", target: "damage", op: "set", amount: 4 },
        { kind: "value", target: "damage", op: "set", amount: 4 },
        { kind: "value", target: "damage", op: "set", amount: 8 },
      ],
    },
  ],
}
