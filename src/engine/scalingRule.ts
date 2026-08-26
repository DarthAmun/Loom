import type { ProficiencyRank } from "../core/proficiency.js"
import type { ScalingRule } from "../entities/types.js"

export interface ScalingInput {
  level?: number
  castLevel?: number
  proficiencyRank?: ProficiencyRank
}

export function evaluateScalingRule(rule: ScalingRule, input: ScalingInput): number {
  switch (rule.by) {
    case "level": {
      const level = input.level ?? 0
      const stepSize = rule.stepSize ?? 1
      return rule.base + rule.perStep * Math.floor(level / stepSize)
    }
    case "castLevel": {
      const castLevel = input.castLevel ?? 1
      const stepSize = rule.stepSize ?? 1
      return rule.base + rule.perStep * Math.floor(castLevel / stepSize)
    }
    case "proficiencyRank": {
      const rank = input.proficiencyRank ?? "untrained"
      return rule.amounts[rank] ?? 0
    }
  }
}
