import type { Entity } from "../../entities/types.js"

/** #15 Skill Feats — also a clean fit: a prerequisite gated on proficiency
 * rank, an action with its own trigger-free effect. Battle Medicine reuses
 * the same "value +hp" shape as core.healing.layOnHands, which is a good
 * sign for the unified-entity premise (two very differently-flavored
 * sources converge on the same Effect shape). */
export const battleMedicine: Entity = {
  id: "core.skillFeat.battleMedicine",
  name: "Battle Medicine",
  tags: ["source:core", "category:skill-feat", "trait:manipulate", "trait:healing"],
  prerequisites: [{ kind: "proficiency", proficiencyKey: "skill.medicine", minRank: "trained" }],
  conflicts: [],
  cost: { type: "actions", count: 1 },
  effects: [{ kind: "value", target: "hp", op: "+", amount: { by: "proficiencyRank", amounts: { trained: 10, expert: 15, master: 20, legendary: 30 } } }],
}
