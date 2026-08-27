import { describe, expect, it } from "vitest"
import { EntityRegistry } from "../src/entities/registry.js"
import { GameEngine, resolveEffect, type ResolutionContext } from "../src/engine/engine.js"
import { randomDie } from "../src/engine/dice.js"
import { firstOptionChooser } from "../src/engine/choice.js"
import { allMechanics } from "../src/data/mechanics/index.js"
import { allPackageEntities } from "../src/data/packages/index.js"
import { makeCharacter } from "../src/character/fixtures.js"
import type { Character } from "../src/character/types.js"
import type { Entity } from "../src/entities/types.js"

function buildRegistry(): EntityRegistry {
  const registry = new EntityRegistry()
  registry.registerAll(allMechanics)
  registry.registerAll(allPackageEntities)
  return registry
}

describe("trigger bus: Strike -> strike.hit -> Sneak Attack", () => {
  it("adds Sneak Attack's bonus damage when the target is flat-footed", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5, activeEntities: [{ entityId: "core.sneakAttack" }] })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.condition.flat-footed" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target] })

    expect(result.degree).toBe("success")
    expect(result.damage).toBe(10) // 4 base + 6 sneak attack (level 5)
    expect(target.resources.get("hp")?.current).toBe(20)
  })

  it("does not add bonus damage when the target is not flat-footed", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5, activeEntities: [{ entityId: "core.sneakAttack" }] })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target] })

    expect(result.degree).toBe("success")
    expect(result.damage).toBe(4)
    expect(target.resources.get("hp")?.current).toBe(26)
  })

  it("does not trigger Sneak Attack on a miss even if the target is flat-footed", () => {
    const engine = new GameEngine(buildRegistry(), () => 1) // natural 1, guaranteed miss
    const attacker = makeCharacter({ hp: 40, level: 5, activeEntities: [{ entityId: "core.sneakAttack" }] })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.condition.flat-footed" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target] })

    expect(result.degree).toBe("criticalFailure")
    expect(result.damage).toBe(0)
    expect(target.resources.get("hp")?.current).toBe(30)
  })
})

describe("all drafted entities load into a registry without id collisions", () => {
  it("registers every mechanic and package entity", () => {
    expect(() => buildRegistry()).not.toThrow()
  })
})

describe("nested variant (castLevel -> degreeOfSuccess) resolves correctly", () => {
  // resolveStrike is Strike-shaped (degreeOfSuccess only, no castLevel) — it
  // doesn't drive a spell like Ember Burst end-to-end. That's a real gap
  // (see README report: Phase 0 has no resolveSpell path). This test proves
  // the nested-variant *mechanism itself* works by calling resolveEffect
  // directly with a hand-built context, independent of that gap.
  it("picks the heightened+failed-save branch when both selectors are set", () => {
    const registry = buildRegistry()
    const entity = registry.get("pkg.caster.emberBurst")
    const caster = makeCharacter({ hp: 20, level: 5 })
    const values: Record<string, number> = {}
    const ctx: ResolutionContext = {
      registry,
      self: caster,
      event: { type: "spell.cast", payload: { castLevel: 1, baseCastLevel: 0, degree: "failure" } },
      values,
      roller: () => 10,
      dieRoller: randomDie,
      sourceEntityId: entity.id,
    }
    const trace: string[] = []
    for (const effect of entity.effects) resolveEffect(effect, ctx, trace)

    expect(values.damage).toBe(14) // heightened (+1) row, "failure" column
  })
})

describe("DiceExpression value effects", () => {
  it("resolves a flat dice count by rolling and summing via the injected dieRoller", () => {
    const registry = buildRegistry()
    const caster = makeCharacter({ hp: 20, level: 5 })
    const values: Record<string, number> = {}
    const ctx: ResolutionContext = {
      registry,
      self: caster,
      values,
      roller: () => 10,
      dieRoller: () => 4, // fixed roll, so 2d6 sums to 8 deterministically
      sourceEntityId: "test",
    }
    resolveEffect({ kind: "value", target: "damage", op: "+", amount: { kind: "dice", count: 2, faces: 6 } }, ctx, [])

    expect(values.damage).toBe(8)
  })

  it("resolves a level-scaled dice count (die count grows with level)", () => {
    const registry = buildRegistry()
    const caster = makeCharacter({ hp: 20, level: 11 }) // base 1 + perStep 1 * floor(11/5) = 3 dice
    const values: Record<string, number> = {}
    const ctx: ResolutionContext = {
      registry,
      self: caster,
      values,
      roller: () => 10,
      dieRoller: () => 4,
      sourceEntityId: "test",
    }
    resolveEffect(
      { kind: "value", target: "damage", op: "+", amount: { kind: "dice", count: { by: "level", base: 1, perStep: 1, stepSize: 5 }, faces: 6 } },
      ctx,
      [],
    )

    expect(values.damage).toBe(12) // 3 dice * fixed roll of 4
  })
})

describe("incomingDamage.byTag hooks: Immunity/Resistance/Weakness", () => {
  it("Immunity zeroes out matching-tagged damage entirely", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5 })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.immunity.fire" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target], damageType: "fire" })

    expect(result.damage).toBe(0)
    expect(target.resources.get("hp")?.current).toBe(30)
  })

  it("Resistance reduces matching-tagged damage by its amount", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5 })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.resistance.fire" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target], damageType: "fire" })

    expect(result.damage).toBe(0) // 4 base damage - 5 resistance, clamped at 0
    expect(target.resources.get("hp")?.current).toBe(30)
  })

  it("Weakness increases matching-tagged damage by its amount", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5 })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.weakness.fire" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target], damageType: "fire" })

    expect(result.damage).toBe(9) // 4 base damage + 5 weakness
    expect(target.resources.get("hp")?.current).toBe(21)
  })

  it("does not apply a fire hook against untagged (or differently-tagged) damage", () => {
    const engine = new GameEngine(buildRegistry(), () => 12)
    const attacker = makeCharacter({ hp: 40, level: 5 })
    const target = makeCharacter({ hp: 30, level: 3, activeEntities: [{ entityId: "core.resistance.fire" }] })

    const result = engine.resolveStrike({ attacker, target, targetAC: 18, attackBonus: 9, allCharacters: [attacker, target] })

    expect(result.damage).toBe(4) // no damageType supplied -> resistance can't match
    expect(target.resources.get("hp")?.current).toBe(26)
  })
})

describe("choice effects", () => {
  // Mirrors the corpus's dominant ChoiceSet shape (Arcane School, Bloodline,
  // Druidic Order, ...): pick one Entity carrying a shared tag, applying it
  // and recording the pick in one step.
  const flame: Entity = { id: "test.school.flame", name: "Flame School", tags: ["test:arcane-school"], prerequisites: [], conflicts: [], cost: { type: "free" }, effects: [] }
  const frost: Entity = { id: "test.school.frost", name: "Frost School", tags: ["test:arcane-school"], prerequisites: [], conflicts: [], cost: { type: "free" }, effects: [] }
  const arcaneSchoolPick: Entity = {
    id: "test.arcaneSchool",
    name: "Arcane School",
    tags: [],
    prerequisites: [],
    conflicts: [],
    cost: { type: "free" },
    effects: [{ kind: "choice", bind: "arcaneSchool", count: 1, from: { kind: "entitiesByTag", tag: "test:arcane-school" } }],
  }

  /** Shared setup for the three tests below that only vary the chooser —
   * the literal-pool test builds its own registry/character since its
   * source entity is genuinely different. */
  function makeArcaneSchoolCtx(chooser?: ResolutionContext["chooser"]): { registry: EntityRegistry; caster: Character; ctx: ResolutionContext } {
    const registry = new EntityRegistry()
    registry.registerAll([flame, frost, arcaneSchoolPick])
    const caster = makeCharacter({ hp: 20, level: 1, activeEntities: [{ entityId: "test.arcaneSchool" }] })
    const ctx: ResolutionContext = {
      registry,
      self: caster,
      values: {},
      roller: () => 10,
      dieRoller: randomDie,
      sourceEntityId: "test.arcaneSchool",
      ...(chooser ? { chooser } : {}),
    }
    return { registry, caster, ctx }
  }

  it("picking from an entity-tagged pool both applies the choice and records it on the granting instance", () => {
    const { registry, caster, ctx } = makeArcaneSchoolCtx(firstOptionChooser) // pool order is registration order: flame, frost
    resolveEffect(registry.get("test.arcaneSchool").effects[0]!, ctx, [])

    expect(caster.activeEntities.map((i) => i.entityId)).toEqual(["test.arcaneSchool", "test.school.flame"])
    expect(caster.activeEntities[0]!.runtimeState).toEqual({ arcaneSchool: "test.school.flame" })
  })

  it("picking from a literal pool records the pick but applies nothing", () => {
    const literalPick: Entity = {
      id: "test.skillPick",
      name: "Skill Pick",
      tags: [],
      prerequisites: [],
      conflicts: [],
      cost: { type: "free" },
      effects: [{ kind: "choice", bind: "skill", count: 1, from: { kind: "literal", options: ["occultism", "religion"] } }],
    }
    const registry = new EntityRegistry()
    registry.registerAll([literalPick])
    const caster = makeCharacter({ hp: 20, level: 1, activeEntities: [{ entityId: "test.skillPick" }] })
    const ctx: ResolutionContext = {
      registry,
      self: caster,
      values: {},
      roller: () => 10,
      dieRoller: randomDie,
      sourceEntityId: "test.skillPick",
      chooser: firstOptionChooser,
    }
    resolveEffect(literalPick.effects[0]!, ctx, [])

    expect(caster.activeEntities).toHaveLength(1) // no entity applied
    expect(caster.activeEntities[0]!.runtimeState).toEqual({ skill: "occultism" })
  })

  it("is a no-op (logged, not thrown) when no chooser is supplied", () => {
    const { registry, caster, ctx } = makeArcaneSchoolCtx()
    const trace: string[] = []
    resolveEffect(registry.get("test.arcaneSchool").effects[0]!, ctx, trace)

    expect(caster.activeEntities).toHaveLength(1)
    expect(trace[0]).toContain("no chooser supplied")
  })

  it("throws if the chooser returns a value outside the offered pool", () => {
    const { registry, ctx } = makeArcaneSchoolCtx(() => ["not-a-real-school"])
    expect(() => resolveEffect(registry.get("test.arcaneSchool").effects[0]!, ctx, [])).toThrow(/not one of the offered options/)
  })
})
