// Phase C — the first appliesTo the engine actually interprets. Hooks are
// otherwise entirely unconsumed (see README's "Hook.value: unknown means
// hooks aren't actually declarative" report) — this deliberately stays
// scoped to exactly "incomingDamage.byTag" rather than becoming a generic
// hook interpreter.
import type { Character } from "../character/types.js"
import type { EntityRegistry } from "../entities/registry.js"
import type { AdjustIfTaggedValue } from "../entities/types.js"

/** Reduces (Resistance), increases (Weakness), or zeroes (Immunity) incoming
 * damage against a target's active `incomingDamage.byTag` hooks, then
 * clamps at 0. `damageType` is supplied by the caller (same as `targetAC`/
 * `attackBonus` in resolveStrike) rather than derived from the strike's
 * Effects — the schema has no per-damage-instance type breakdown yet (a
 * Strike's `value` effects just target the single "damage" key), so one
 * damage type covers the whole strike, base + any trigger-added bonus
 * (e.g. Sneak Attack) alike. */
export function resolveIncomingDamage(
  rawDamage: number,
  damageType: string | undefined,
  target: Character,
  registry: EntityRegistry,
): number {
  if (rawDamage <= 0 || !damageType) return rawDamage

  let damage = rawDamage
  for (const instance of target.activeEntities) {
    const entity = registry.get(instance.entityId)
    for (const hook of entity.hooks ?? []) {
      if (hook.appliesTo !== "incomingDamage.byTag") continue
      if (hook.operation === "negateIfTagged" && hook.value === damageType) return 0
      if (hook.operation === "adjustIfTagged") {
        const adjustment = hook.value as AdjustIfTaggedValue
        if (adjustment.tag === damageType) damage += adjustment.amount
      }
    }
  }
  return Math.max(0, damage)
}
