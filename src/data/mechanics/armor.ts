import type { Entity } from "../../entities/types.js"

/** #7 Armor — a passive item Entity. Modeled as an always-active
 * activeEntity (no trigger) whose effect nudges "ac". Phase 0's engine only
 * reads `values` inside a triggered resolution or resolveStrike's own
 * scratch record, so a passive "ac" value effect like this has nowhere to
 * be *read from* yet — AC is currently just passed into resolveStrike as a
 * plain number by the caller. Modeling gear as an Entity is straightforward;
 * wiring passive value effects into "what AC does this character actually
 * have" needs a small aggregation step the Phase 0 engine doesn't build.
 * Flagged in README rather than bolted on ad hoc. */
export const chainmail: Entity = {
  id: "core.armor.chainmail",
  name: "Chainmail",
  tags: ["source:core", "category:armor", "trait:heavy"],
  prerequisites: [{ kind: "proficiency", proficiencyKey: "armor.heavy", minRank: "trained" }],
  conflicts: [],
  cost: { type: "free" },
  effects: [{ kind: "value", target: "ac", op: "+", amount: 6 }],
}
