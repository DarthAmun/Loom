import { describe, expect, it } from "vitest"
import { safeParseEntity } from "../src/entities/schema.js"
import { sneakAttack } from "../src/data/mechanics/sneakAttack.js"
import { forceBolt } from "../src/data/mechanics/spellcasting.js"

describe("safeParseEntity", () => {
  it("accepts a real drafted Entity round-tripped through JSON (simulating externally-pasted JSON)", () => {
    const json = JSON.parse(JSON.stringify(sneakAttack))
    const result = safeParseEntity(json)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(sneakAttack)
  })

  it("accepts an Entity with a nested variant Effect (recursive schema)", () => {
    const json = JSON.parse(JSON.stringify(forceBolt))
    const result = safeParseEntity(json)
    expect(result.success).toBe(true)
  })

  it("rejects JSON missing a required field, with a readable path in the error", () => {
    const { id: _id, ...withoutId } = sneakAttack
    const result = safeParseEntity(withoutId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("id")
  })

  it("rejects an unknown discriminant value on a tagged union", () => {
    const broken = { ...sneakAttack, cost: { type: "not-a-real-cost" } }
    const result = safeParseEntity(broken)
    expect(result.success).toBe(false)
  })

  it("rejects non-object input", () => {
    expect(safeParseEntity("just a string").success).toBe(false)
    expect(safeParseEntity(null).success).toBe(false)
  })

  it("accepts a DiceExpression amount, flat or level-scaled count", () => {
    const flat = { ...sneakAttack, effects: [{ kind: "value", target: "damage", op: "+", amount: { kind: "dice", count: 2, faces: 6 } }] }
    expect(safeParseEntity(flat).success).toBe(true)

    const scaled = {
      ...sneakAttack,
      effects: [{ kind: "value", target: "damage", op: "+", amount: { kind: "dice", count: { by: "level", base: 1, perStep: 1, stepSize: 5 }, faces: 6 } }],
    }
    expect(safeParseEntity(scaled).success).toBe(true)
  })

  it("accepts a choice Effect for each ChoiceSource shape (tag pool, explicit refs, literal options)", () => {
    const byTag = { ...sneakAttack, effects: [{ kind: "choice", bind: "arcaneSchool", count: 1, from: { kind: "entitiesByTag", tag: "wizard-arcane-school" } }] }
    expect(safeParseEntity(byTag).success).toBe(true)

    const byRefs = { ...sneakAttack, effects: [{ kind: "choice", bind: "ikon", count: 1, from: { kind: "entitiesByRefs", refs: ["ikon.blade", "ikon.shield"] } }] }
    expect(safeParseEntity(byRefs).success).toBe(true)

    const literal = { ...sneakAttack, effects: [{ kind: "choice", bind: "skill", count: 1, from: { kind: "literal", options: ["occultism", "religion"] } }] }
    expect(safeParseEntity(literal).success).toBe(true)
  })

  it("rejects a choice Effect with an unknown ChoiceSource kind", () => {
    const broken = { ...sneakAttack, effects: [{ kind: "choice", bind: "x", count: 1, from: { kind: "not-a-real-source" } }] }
    expect(safeParseEntity(broken).success).toBe(false)
  })
})
