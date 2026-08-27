import type { Entity } from "../../entities/types.js"

/** Package B — caster, `variant`-heavy. Force Bolt (core.spell.forceBolt)
 * plus a save-based spell that nests two `variant` effects: outer keyed by
 * castLevel (heightening), inner keyed by degreeOfSuccess (the save). The
 * engine supports this for free since resolveEffect already recurses into
 * whichever variant gets chosen — no engine change needed, which is a good
 * sign for the schema's composability. */

export { forceBolt } from "../mechanics/spellcasting.js"

export const emberBurst: Entity = {
  id: "pkg.caster.emberBurst",
  name: "Ember Burst",
  tags: ["source:pkg-caster", "category:spell", "trait:fire", "trait:save"],
  prerequisites: [{ kind: "proficiency", proficiencyKey: "spellcasting.arcane", minRank: "trained" }],
  conflicts: [],
  cost: { type: "actions", count: 2 },
  effects: [
    {
      kind: "variant",
      selectBy: "castLevel",
      variants: [
        {
          kind: "variant",
          selectBy: "degreeOfSuccess",
          variants: [
            { kind: "value", target: "damage", op: "set", amount: 16 },
            { kind: "value", target: "damage", op: "set", amount: 8 },
            { kind: "value", target: "damage", op: "set", amount: 8 },
            { kind: "value", target: "damage", op: "set", amount: 4 },
          ],
        },
        {
          kind: "variant",
          selectBy: "degreeOfSuccess",
          variants: [
            { kind: "value", target: "damage", op: "set", amount: 28 },
            { kind: "value", target: "damage", op: "set", amount: 14 },
            { kind: "value", target: "damage", op: "set", amount: 14 },
            { kind: "value", target: "damage", op: "set", amount: 7 },
          ],
        },
      ],
    },
  ],
}
