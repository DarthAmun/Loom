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
})
