import type { Entity } from "../../entities/types.js"

/** #4 Rage — a self-buff Entity applied via `applyEntity`, demonstrating
 * duration-tracked activeEntities rather than a one-shot resolution.
 *
 * The buff itself (`core.buff.raging`) only carries a tag for now. Making it
 * actually add damage to every subsequent Strike would need a Hook on
 * something like "outgoingDamage.flatBonus" plus engine support for reading
 * hooks from *other* activeEntities during Strike resolution — Phase 0's
 * resolveStrike doesn't scan hooks at all yet (see README report). Drafted
 * as a flag rather than silently faked. */
export const rage: Entity = {
  id: "core.rage",
  name: "Rage",
  tags: ["source:core", "category:buff-action", "martial"],
  prerequisites: [{ kind: "proficiency", proficiencyKey: "fortitude", minRank: "trained" }],
  conflicts: ["core.buff.raging"],
  cost: { type: "actions", count: 1 },
  effects: [{ kind: "applyEntity", entityId: "core.buff.raging", duration: { unit: "rounds", value: 10 } }],
}

export const ragingBuff: Entity = {
  id: "core.buff.raging",
  name: "Raging",
  tags: ["source:core", "condition:raging"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  effects: [],
}
