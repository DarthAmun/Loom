import { rankAtLeast } from "../core/proficiency.js"
import { compare } from "./conditions.js"
import type { Prerequisite } from "../entities/types.js"
import type { Character } from "../character/types.js"

export interface PrerequisiteEvalContext {
  character: Character
  /** Ids of entities currently active — kept separate from
   * character.activeEntities so a caller evaluating a hypothetical (e.g.
   * "would this still be met without entity X") can pass a modified set
   * without mutating the character. */
  activeIds: ReadonlySet<string>
}

export interface PrerequisiteResult {
  met: boolean
  /** Populated only when !met — what's missing, e.g. "needs level 3 —
   * you're 1". Empty on success: callers that only need pass/fail (or
   * want their own "why eligible" copy) have no use for a redundant
   * success message. */
  reason: string
}

export function evaluatePrerequisite(prereq: Prerequisite, ctx: PrerequisiteEvalContext): PrerequisiteResult {
  switch (prereq.kind) {
    case "level":
      return ctx.character.level >= prereq.minLevel
        ? { met: true, reason: "" }
        : { met: false, reason: `needs level ${prereq.minLevel} — you're ${ctx.character.level}` }
    case "attribute": {
      const value = ctx.character.attributes[prereq.attribute] ?? 0
      return compare(value, "gte", prereq.minValue)
        ? { met: true, reason: "" }
        : { met: false, reason: `needs ${prereq.attribute} ≥ ${prereq.minValue} — you have ${value}` }
    }
    case "proficiency": {
      const rank = ctx.character.proficiencies.get(prereq.proficiencyKey) ?? "untrained"
      return rankAtLeast(rank, prereq.minRank)
        ? { met: true, reason: "" }
        : { met: false, reason: `needs ${prereq.proficiencyKey} ${prereq.minRank} — you're ${rank}` }
    }
    case "entity":
      return ctx.activeIds.has(prereq.entityId)
        ? { met: true, reason: "" }
        : { met: false, reason: `needs ${prereq.entityId} active` }
  }
}

/** Short-circuits on the first unmet prerequisite. Mirrors
 * conditions.ts's evaluateConditions shape for the sibling ConditionSpec
 * type — Prerequisite and ConditionSpec are structurally similar but
 * evaluated against different things (a Character's own state vs. a live
 * event's combatants), so they stay separate rather than sharing one
 * generic evaluator. */
export function evaluatePrerequisites(prereqs: readonly Prerequisite[], ctx: PrerequisiteEvalContext): PrerequisiteResult {
  for (const prereq of prereqs) {
    const result = evaluatePrerequisite(prereq, ctx)
    if (!result.met) return result
  }
  return { met: true, reason: "" }
}
