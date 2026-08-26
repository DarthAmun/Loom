import type { Entity } from "../../entities/types.js"

/** #14 Monster Abilities — fits the schema cleanly; a recharging breath
 * weapon is just cost + a resource-gated condition + a save-based `variant`.
 * `resource` as a ConditionSpec kind (drafted for this file) covers
 * "only usable if rechargeCharges >= 1"; nothing here needed inventing
 * beyond the already-drafted supporting types. */
export const breathWeapon: Entity = {
  id: "monster.dragon.breathWeapon",
  name: "Breath Weapon",
  tags: ["source:core", "category:monster-ability", "trait:fire", "trait:recharge"],
  prerequisites: [],
  conflicts: [],
  cost: { type: "actions", count: 2 },
  condition: [{ kind: "resource", resourceKey: "breathWeaponCharge", op: "gte", value: 1 }],
  effects: [
    {
      kind: "variant",
      selectBy: "degreeOfSuccess",
      variants: [
        { kind: "value", target: "damage", op: "set", amount: 40 },
        { kind: "value", target: "damage", op: "set", amount: 20 },
        { kind: "value", target: "damage", op: "set", amount: 20 },
        { kind: "value", target: "damage", op: "set", amount: 10 },
      ],
    },
  ],
}
