import type { Entity } from "../../entities/types.js"

/** #8 Conditions — modeled as ordinary Entities applied via `applyEntity`,
 * per the unified-entity premise: a condition is just an Entity that
 * happens to get referenced by `hasTag` checks a lot (see core.sneakAttack).
 * flat-footed has no independent effects of its own in Phase 0 — its whole
 * job is being a tag other Entities' conditions look for. */
export const flatFooted: Entity = {
  id: "core.condition.flat-footed",
  name: "Flat-Footed",
  tags: ["source:core", "condition:flat-footed"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  effects: [],
}

/** Frightened DOES need to modify outgoing rolls (a Hook target like
 * "attackRoll.flatPenalty" or "check.flatPenalty"), which Phase 0's engine
 * doesn't consume during resolveStrike yet — drafted for shape, not
 * exercised end-to-end. Also frightened decreases each turn ("frightened 2"
 * -> "frightened 1"), which is per-instance numeric state the current
 * EntityInstance.runtimeState could hold, but nothing in Phase 0 ticks it
 * down (no turn loop). Flagged in README. */
export const frightened: Entity = {
  id: "core.condition.frightened",
  name: "Frightened",
  tags: ["source:core", "condition:frightened"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "free" },
  hooks: [{ appliesTo: "check.flatPenalty", operation: "override", value: { fromRuntimeState: "frightenedValue" } }],
  effects: [],
}
