// Phase 5 — Layer 5 balance comparison. Compares an Entity's level-scaled
// value effects against Layer 0's envelope curves. Lives here (not in
// apps/web) because the target->envelope mapping and deviation thresholds
// are domain knowledge about the schema and Layer 0, not a UI concern —
// apps/web/src/app/utils/balance.ts only adds display labels/colors on top
// of this, mirroring how eligibility.ts wraps engine/prerequisites.ts.
import { LevelScalingCurve } from "../core/scaling.js"
import { evaluateScalingRule } from "../engine/scalingRule.js"
import type { Effect, Entity, ScalingRule } from "./types.js"

/** Sample levels for balance comparisons — also reused by
 * entity-summary.ts's scalingChartFor, so a chart and a balance row for the
 * same entity show numbers from the same levels. */
export const BALANCE_LEVELS = [1, 5, 10, 15, 20]

/** Deviation bands for the "comparable" bucket's status. A starting
 * default, not a tuned value — Layer 0's own envelope curves are still
 * partly placeholder (see core/scaling.ts's expectedDamage), and the brief
 * explicitly left "how much deviation is acceptable" as a human decision.
 * Easy to retune: nothing downstream depends on the exact numbers, only on
 * 'in' | 'watch' | 'off' ordering. */
export const BALANCE_THRESHOLDS = { watch: 0.2, off: 0.5 }

/** Targets with a Layer 0 curve to compare against. `hp`'s only envelope
 * (classHpForTier) needs a durability tier, which isn't a per-Entity
 * concept, so there's nothing correct to compare against yet — deliberately
 * left out rather than guessing a tier. */
const ENVELOPE_BY_TARGET: Partial<Record<string, (level: number) => number>> = {
  damage: LevelScalingCurve["expectedDamage"],
  ac: LevelScalingCurve["acEnvelope"],
}

export type BalanceStatus = "in" | "watch" | "off"

export interface ComparablePoint {
  level: number
  actual: number
  envelope: number
  deltaPct: number
}

export interface ComparableRow {
  target: string
  points: ComparablePoint[]
  status: BalanceStatus
}

export interface FlatRow {
  target: string
  amount: number
}

export interface NoEnvelopeRow {
  target: string
  rule: ScalingRule
  reason: string
}

export interface BalanceReport {
  entity: Entity
  comparable: ComparableRow[]
  unscaled: FlatRow[]
  noEnvelope: NoEnvelopeRow[]
}

type ValueEffect = Extract<Effect, { kind: "value" }>

/** Pulls every top-level `value` effect out of a (possibly nested) variant
 * tree, keeping the target/amount pair. */
function flattenValueEffects(effect: Effect): { target: string; amount: ValueEffect["amount"] }[] {
  if (effect.kind === "value") return [{ target: effect.target, amount: effect.amount }]
  if (effect.kind === "variant") return effect.variants.flatMap(flattenValueEffects)
  return []
}

function statusFor(points: ComparablePoint[]): BalanceStatus {
  const maxAbsDelta = Math.max(...points.map((p) => Math.abs(p.deltaPct)))
  if (maxAbsDelta >= BALANCE_THRESHOLDS.off) return "off"
  if (maxAbsDelta >= BALANCE_THRESHOLDS.watch) return "watch"
  return "in"
}

export function balanceReportFor(entity: Entity): BalanceReport {
  const comparable: ComparableRow[] = []
  const unscaled: FlatRow[] = []
  const noEnvelope: NoEnvelopeRow[] = []

  for (const effect of entity.effects) {
    for (const { target, amount } of flattenValueEffects(effect)) {
      if (typeof amount === "number") {
        unscaled.push({ target, amount })
        continue
      }

      const rule = amount
      if (rule.by === "proficiencyRank") {
        noEnvelope.push({ target, rule, reason: "scaled by proficiency rank, not level" })
        continue
      }

      const envelope = ENVELOPE_BY_TARGET[target]
      if (!envelope) {
        noEnvelope.push({ target, rule, reason: `no Layer 0 envelope defined for "${target}"` })
        continue
      }

      const points = BALANCE_LEVELS.map((level) => {
        const actual = evaluateScalingRule(rule, { level, castLevel: level })
        const envelopeValue = envelope(level)
        return { level, actual, envelope: envelopeValue, deltaPct: envelopeValue === 0 ? 0 : (actual - envelopeValue) / envelopeValue }
      })
      comparable.push({ target, points, status: statusFor(points) })
    }
  }

  return { entity, comparable, unscaled, noEnvelope }
}

export function allBalanceReports(entities: readonly Entity[]): BalanceReport[] {
  return entities.map(balanceReportFor)
}
