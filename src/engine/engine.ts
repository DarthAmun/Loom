import type { Character, GameEvent } from "../character/types.js"
import { isDiceExpression, type DurationSpec, type Effect, type EntityRef } from "../entities/types.js"
import type { EntityRegistry } from "../entities/registry.js"
import { evaluateConditions } from "./conditions.js"
import { evaluateScalingRule } from "./scalingRule.js"
import { rollDiceExpression, randomDie, type DieRoller } from "./dice.js"
import { resolveIncomingDamage } from "./incomingDamage.js"
import { resolveChoice, type Chooser } from "./choice.js"
import { degreeOfSuccess, DEGREE_ORDER, type D20Roller, type DegreeOfSuccess, randomD20 } from "./check.js"

export interface ResolutionContext {
  registry: EntityRegistry
  self: Character
  event?: GameEvent
  /** Shared scratch record effects read/write by target key, e.g. "damage".
   * When resolution happens inside emit(), this is the SAME object as
   * event.payload.values — that's how a triggered Entity (Sneak Attack) can
   * add onto an in-flight Strike's damage before the caller reads it back. */
  values: Record<string, number>
  roller: D20Roller
  /** Rolls a value effect's DiceExpression amount. Separate from `roller`
   * (fixed to d20 checks) since dice amounts vary by `faces`. */
  dieRoller: DieRoller
  sourceEntityId: string
  /** Supplies the pick(s) for a "choice" Effect — a build-time player
   * decision, not something the engine derives. Optional: GameEngine's
   * chooser constructor param is itself optional (see below), since not
   * every caller resolves entities with "choice" effects — a "choice" with
   * no chooser is logged and skipped rather than throwing, matching
   * conditionalDuration's "noted, not evaluated" treatment below. */
  chooser?: Chooser
}

/** Pushes a new EntityInstance onto `self.activeEntities` — the "grant this
 * entity to this character" primitive shared by the "applyEntity" and
 * "choice" cases below, so a future refinement (duration handling, stacking
 * rules, provenance) only needs to change in one place. */
function applyEntityInstance(self: Character, entityId: EntityRef, source: string, duration?: DurationSpec): void {
  self.activeEntities.push(duration ? { entityId, source, duration } : { entityId, source })
}

function resolveVariantIndex(effect: Extract<Effect, { kind: "variant" }>, ctx: ResolutionContext): number {
  if (effect.selectBy === "degreeOfSuccess") {
    const degree = (ctx.event?.payload.degree as DegreeOfSuccess | undefined) ?? "failure"
    return DEGREE_ORDER.indexOf(degree)
  }
  // selectBy "castLevel": no per-variant level tag in the schema (see README
  // report), so Phase 0 assumes variants[0] = base cast level and each next
  // index = +1 spell level, clamped to the array bounds.
  const castLevel = (ctx.event?.payload.castLevel as number | undefined) ?? 1
  const baseLevel = (ctx.event?.payload.baseCastLevel as number | undefined) ?? castLevel
  return Math.max(0, Math.min(effect.variants.length - 1, castLevel - baseLevel))
}

export function resolveEffect(effect: Effect, ctx: ResolutionContext, trace: string[]): void {
  switch (effect.kind) {
    case "value": {
      const amount =
        typeof effect.amount === "number" ? effect.amount :
        isDiceExpression(effect.amount) ? rollDiceExpression(effect.amount, { level: ctx.self.level }, ctx.dieRoller) :
        evaluateScalingRule(effect.amount, { level: ctx.self.level })
      const current = ctx.values[effect.target] ?? 0
      const next =
        effect.op === "+" ? current + amount :
        effect.op === "-" ? current - amount :
        effect.op === "×" ? current * amount :
        amount // "set"
      ctx.values[effect.target] = next
      trace.push(`    [${ctx.sourceEntityId}] ${effect.target} ${effect.op} ${amount} -> ${next}`)
      break
    }
    case "applyEntity": {
      applyEntityInstance(ctx.self, effect.entityId, ctx.sourceEntityId, effect.duration)
      trace.push(`    [${ctx.sourceEntityId}] applied ${effect.entityId} to character`)
      break
    }
    case "variant": {
      const index = resolveVariantIndex(effect, ctx)
      const chosen = effect.variants[index]
      if (chosen) resolveEffect(chosen, ctx, trace)
      break
    }
    case "conditionalDuration": {
      // Phase 0 has no turn loop to re-roll this against each round, so it's
      // logged rather than evaluated. See README report re: onFail-only.
      trace.push(`    [${ctx.sourceEntityId}] conditionalDuration noted (not evaluated in Phase 0)`)
      break
    }
    case "choice": {
      if (!ctx.chooser) {
        trace.push(`    [${ctx.sourceEntityId}] choice "${effect.bind}" noted (no chooser supplied)`)
        break
      }
      const picks = resolveChoice(effect.from, effect.bind, effect.count, ctx.chooser, ctx.registry)

      const instance = ctx.self.activeEntities.find((i) => i.entityId === ctx.sourceEntityId)
      if (instance) instance.runtimeState = { ...instance.runtimeState, [effect.bind]: picks.length === 1 ? picks[0] : picks }

      if (effect.from.kind !== "literal") {
        for (const entityId of picks) applyEntityInstance(ctx.self, entityId, ctx.sourceEntityId)
      }
      trace.push(`    [${ctx.sourceEntityId}] choice "${effect.bind}" -> ${picks.join(", ")}`)
      break
    }
  }
}

export interface StrikeResult {
  degree: DegreeOfSuccess
  damage: number
}

export class GameEngine {
  readonly trace: string[] = []

  constructor(
    private readonly registry: EntityRegistry,
    private readonly roller: D20Roller = randomD20,
    private readonly dieRoller: DieRoller = randomDie,
    /** No default (unlike roller/dieRoller): a "choice" pick is a real
     * build-time decision, not something a fallback implementation could
     * stand in for. Callers that don't resolve "choice" effects can omit
     * this — see ResolutionContext.chooser's doc comment. */
    private readonly chooser?: Chooser,
  ) {}

  /** Assembles a ResolutionContext from this engine's fixed inputs
   * (registry/roller/dieRoller/chooser) plus the per-call fields — the one
   * place that decides how to attach the optional `chooser` (a ternary
   * spread, since `exactOptionalPropertyTypes` rejects an explicit
   * `chooser: undefined`), shared by emit() and resolveStrike() instead of
   * each rebuilding the same object shape. */
  private buildContext(fields: Pick<ResolutionContext, "self" | "event" | "values" | "sourceEntityId">): ResolutionContext {
    return {
      registry: this.registry,
      roller: this.roller,
      dieRoller: this.dieRoller,
      ...(this.chooser ? { chooser: this.chooser } : {}),
      ...fields,
    }
  }

  /** Layer 4 algorithm: find every activeEntity across `characters` whose
   * trigger matches this event, check its condition[], resolve effects[] if satisfied. */
  emit(event: GameEvent, characters: Character[]): void {
    this.trace.push(`event: ${event.type}`)
    for (const character of characters) {
      for (const instance of [...character.activeEntities]) {
        const entity = this.registry.get(instance.entityId)
        if (entity.trigger?.event !== event.type) continue

        const ctx = this.buildContext({
          self: character,
          event,
          values: (event.payload.values as Record<string, number> | undefined) ?? {},
          sourceEntityId: entity.id,
        })
        const met = evaluateConditions(entity.condition, ctx)
        this.trace.push(`  ${entity.id}: trigger matched, condition ${met ? "PASSED" : "FAILED"}`)
        if (!met) continue
        for (const effect of entity.effects) resolveEffect(effect, ctx, this.trace)
      }
    }
  }

  /** Strike is engine-native rather than fully data-driven: comparing a d20
   * roll to a target's AC and branching on degree of success isn't
   * expressible by any of the four Effect kinds alone (see README report).
   * The Strike Entity still supplies its own damage-by-degree via a
   * `variant` effect; only the roll-and-compare step is hardcoded here. */
  resolveStrike(params: {
    attacker: Character
    target: Character
    targetAC: number
    attackBonus: number
    allCharacters: Character[]
    strikeEntityId?: string
    /** Tag checked against the target's active `incomingDamage.byTag` hooks
     * (Immunity/Resistance/Weakness) — omit for untyped damage, which no
     * such hook can match. */
    damageType?: string
  }): StrikeResult {
    const entity = this.registry.get(params.strikeEntityId ?? "core.strike")
    const natural = this.roller()
    const total = natural + params.attackBonus
    const degree = degreeOfSuccess(total, params.targetAC, natural)
    this.trace.push(`strike: d20(${natural}) + ${params.attackBonus} = ${total} vs AC ${params.targetAC} -> ${degree}`)

    const values: Record<string, number> = { damage: 0 }
    const baseCtx = this.buildContext({
      self: params.attacker,
      event: { type: "strike.check", payload: { degree } },
      values,
      sourceEntityId: entity.id,
    })
    for (const effect of entity.effects) resolveEffect(effect, baseCtx, this.trace)

    const hit = degree === "success" || degree === "criticalSuccess"
    const event: GameEvent = {
      type: hit ? "strike.hit" : "strike.miss",
      payload: { attacker: params.attacker, target: params.target, degree, values },
    }
    this.emit(event, params.allCharacters)

    const rawDamage = hit ? (values.damage ?? 0) : 0
    const damage = resolveIncomingDamage(rawDamage, params.damageType, params.target, this.registry)
    if (damage !== rawDamage) this.trace.push(`  incomingDamage: ${rawDamage} -> ${damage} (${params.damageType})`)
    if (damage > 0) {
      const hp = params.target.resources.get("hp")
      if (hp) hp.current = Math.max(0, hp.current - damage)
    }
    return { degree, damage }
  }
}
