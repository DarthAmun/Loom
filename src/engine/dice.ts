import type { DiceExpression } from "../entities/types.js"
import { evaluateScalingRule, type ScalingInput } from "./scalingRule.js"

/** Injectable so tests can be deterministic instead of actually random —
 * same pattern as check.ts's D20Roller. */
export type DieRoller = (faces: number) => number
export const randomDie: DieRoller = (faces) => 1 + Math.floor(Math.random() * faces)

function resolveDiceCount(dice: DiceExpression, input: ScalingInput): number {
  return typeof dice.count === "number" ? dice.count : evaluateScalingRule(dice.count, input)
}

/** Rolls `count` dice of `faces` and sums them — the actual resolution-time
 * value for a dice-based value effect. */
export function rollDiceExpression(dice: DiceExpression, input: ScalingInput, roll: DieRoller = randomDie): number {
  const count = resolveDiceCount(dice, input)
  let total = 0
  for (let i = 0; i < count; i++) total += roll(dice.faces)
  return total
}

/** Expected value (count × average face) rather than an actual roll — for
 * display and balance comparisons (Layer 5) where a random sample would be
 * misleading. */
export function expectedDiceValue(dice: DiceExpression, input: ScalingInput): number {
  return resolveDiceCount(dice, input) * ((dice.faces + 1) / 2)
}
