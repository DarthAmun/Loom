import type { Entity } from "../../entities/types.js"

/** #3 Reactive Strike (Attack of Opportunity analog) — a reaction that also
 * wraps Strike, and is trigger-driven rather than player-chosen. Exercises
 * cost:"reaction" + trigger together, which Power Attack (cost inherited,
 * player-chosen) doesn't. */
export const reactiveStrike: Entity = {
  id: "core.reactiveStrike",
  name: "Reactive Strike",
  tags: ["source:core", "category:strike", "martial"],
  prerequisites: [{ kind: "level", minLevel: 1 }],
  conflicts: [],
  cost: { type: "reaction" },
  wraps: "core.strike",
  trigger: { event: "enemy.moveInReach" },
  condition: [{ kind: "attribute", attribute: "reactionsAvailable", op: "gte", value: 1 }],
  effects: [
    { kind: "value", target: "damage", op: "set", amount: 4 }, // same as a plain Strike's success line; see core.strike for the placeholder-avg-damage note
  ],
}
