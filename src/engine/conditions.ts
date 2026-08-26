import { rankAtLeast } from "../core/proficiency.js"
import type { ConditionSpec } from "../entities/types.js"
import type { Character, GameEvent } from "../character/types.js"
import type { EntityRegistry } from "../entities/registry.js"

export interface ConditionEvalContext {
  registry: EntityRegistry
  self: Character
  event?: GameEvent
}

/** Tags a combatant currently "has" — derived from the entity.tags of
 * whatever is in their activeEntities. Phase 0 has no separate status-tag
 * store, so a condition like "flat-footed" being checkable via hasTag
 * depends entirely on it being modeled as an applied Entity with that tag. */
function combatantTags(combatant: Character | undefined, registry: EntityRegistry): Set<string> {
  const tags = new Set<string>()
  if (!combatant) return tags
  for (const instance of combatant.activeEntities) {
    const entity = registry.tryGet(instance.entityId)
    if (entity) for (const tag of entity.tags) tags.add(tag)
  }
  return tags
}

function compare(value: number, op: "gte" | "lte" | "eq", target: number): boolean {
  if (op === "gte") return value >= target
  if (op === "lte") return value <= target
  return value === target
}

function combatantFromEvent(ctx: ConditionEvalContext, which: "target" | "attacker"): Character | undefined {
  return ctx.event?.payload[which] as Character | undefined
}

export function evaluateCondition(spec: ConditionSpec, ctx: ConditionEvalContext): boolean {
  switch (spec.kind) {
    case "attribute": {
      const value = ctx.self.attributes[spec.attribute] ?? 0
      return compare(value, spec.op, spec.value)
    }
    case "proficiency": {
      const rank = ctx.self.proficiencies.get(spec.proficiencyKey) ?? "untrained"
      return rankAtLeast(rank, spec.minRank)
    }
    case "hasTag": {
      const combatant =
        spec.on === "self" ? ctx.self
        : spec.on === "event.target" ? combatantFromEvent(ctx, "target")
        : combatantFromEvent(ctx, "attacker")
      return combatantTags(combatant, ctx.registry).has(spec.tag)
    }
    case "eventField":
      return ctx.event?.payload[spec.field] === spec.equals
    case "resource": {
      const resource = ctx.self.resources.get(spec.resourceKey)
      return resource ? compare(resource.current, spec.op, spec.value) : false
    }
  }
}

export function evaluateConditions(conditions: ConditionSpec[] | undefined, ctx: ConditionEvalContext): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every((spec) => evaluateCondition(spec, ctx))
}
