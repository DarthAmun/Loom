import type { Entity } from "../../entities/types.js"

/** #9 Spellcasting — a spell as an Entity, using `variant` selectBy
 * "castLevel" for heightening. See engine/engine.ts's resolveVariantIndex
 * for the "index 0 = base level, each next index = +1" convention this
 * assumes, and README's report on why that's a gap (PF2e spells commonly
 * heighten every 2 levels, not every 1). */
export const forceBolt: Entity = {
  id: "core.spell.forceBolt",
  name: "Force Bolt",
  tags: ["source:core", "category:spell", "trait:force", "trait:attack"],
  prerequisites: [{ kind: "proficiency", proficiencyKey: "spellcasting.arcane", minRank: "trained" }],
  conflicts: [],
  cost: { type: "actions", count: 2 },
  effects: [
    {
      kind: "variant",
      selectBy: "castLevel",
      variants: [
        { kind: "value", target: "damage", op: "set", amount: 6 }, // base (1st rank)
        { kind: "value", target: "damage", op: "set", amount: 12 }, // heightened +1
        { kind: "value", target: "damage", op: "set", amount: 18 }, // heightened +2
      ],
    },
  ],
}
