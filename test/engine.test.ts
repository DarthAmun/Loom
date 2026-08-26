import { describe, expect, it } from "vitest"
import { EntityRegistry } from "../src/entities/registry.js"
import { GameEngine, resolveEffect, type ResolutionContext } from "../src/engine/engine.js"
import { allMechanics } from "../src/data/mechanics/index.js"
import { allPackageEntities } from "../src/data/packages/index.js"
import { makeCharacter } from "../src/character/fixtures.js"

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
      sourceEntityId: entity.id,
    }
    const trace: string[] = []
    for (const effect of entity.effects) resolveEffect(effect, ctx, trace)

    expect(values.damage).toBe(14) // heightened (+1) row, "failure" column
  })
})
