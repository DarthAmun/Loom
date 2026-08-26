import type { Entity } from "../../entities/types.js"

/** #11 Healing — plain positive `value` effect against "hp". The only
 * open question is that "hp" as an effect target and "hp" as a
 * Character.resources key are two different namespaces the engine has to
 * reconcile manually (resolveStrike does the same reconciliation for
 * "damage" -> resources.get("hp")); there's no schema-level link between an
 * Effect's string `target` and a resource key. Noted, not fixed, in README. */
export const layOnHands: Entity = {
  id: "core.healing.layOnHands",
  name: "Lay on Hands",
  tags: ["source:core", "category:action", "trait:divine", "trait:healing"],
  prerequisites: [{ kind: "level", minLevel: 1 }],
  conflicts: [],
  cost: { type: "actions", count: 1 },
  effects: [{ kind: "value", target: "hp", op: "+", amount: { by: "level", base: 6, perStep: 2, stepSize: 1 } }],
}
