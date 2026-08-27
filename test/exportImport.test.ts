import Dexie from "dexie"
import { beforeEach, describe, expect, it } from "vitest"
import { resetDb } from "../src/storage/db.js"
import { entityStore } from "../src/storage/entityStore.js"
import { characterStore } from "../src/storage/characterStore.js"
import { buildExportBundle, importBundle, parseExportBundle } from "../src/storage/exportImport.js"
import { strike } from "../src/data/mechanics/strike.js"
import { sneakAttack } from "../src/data/mechanics/sneakAttack.js"

beforeEach(async () => {
  resetDb()
  await Dexie.delete("loom")
})

describe("export/import bundle", () => {
  it("round-trips entities and characters through a JSON.stringify/parse boundary", async () => {
    await entityStore.putAll([strike, sneakAttack])
    const character = await characterStore.create({ name: "Vex", level: 3, durabilityTier: "martial" })

    const bundle = await buildExportBundle(["core.strike", "core.sneakAttack"], [character.id!])
    const json = JSON.parse(JSON.stringify(bundle)) // simulate a real download/paste round-trip

    const parsed = parseExportBundle(json)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data.entities.map((e) => e.id).sort()).toEqual(["core.sneakAttack", "core.strike"])
    expect(parsed.data.characters).toHaveLength(1)
    expect(parsed.data.characters[0]?.resources["hp"]).toEqual(character.resources.get("hp"))
  })

  it("imports entities (upsert by id) and characters (always new rows) into an empty database", async () => {
    await entityStore.putAll([strike, sneakAttack])
    const character = await characterStore.create({ name: "Vex", level: 3, durabilityTier: "martial" })
    const bundle = JSON.parse(JSON.stringify(await buildExportBundle(["core.strike", "core.sneakAttack"], [character.id!])))

    resetDb()
    await Dexie.delete("loom")

    const parsed = parseExportBundle(bundle)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const summary = await importBundle(parsed.data)
    expect(summary).toEqual({ entitiesImported: 2, charactersImported: 1 })

    const importedEntity = await entityStore.get("core.strike")
    expect(importedEntity).toEqual(strike)

    const importedCharacters = await characterStore.list()
    expect(importedCharacters).toHaveLength(1)
    expect(importedCharacters[0]?.name).toBe("Vex")
    expect(importedCharacters[0]?.resources).toBeInstanceOf(Map)
    expect(importedCharacters[0]?.resources.get("hp")).toEqual(character.resources.get("hp"))
  })

  it("always inserts characters as new rows, even re-importing into the same database", async () => {
    const character = await characterStore.create({ name: "Vex", level: 3, durabilityTier: "martial" })
    const bundle = await buildExportBundle([], [character.id!])

    await importBundle(bundle)

    const all = await characterStore.list()
    expect(all).toHaveLength(2)
    expect(new Set(all.map((c) => c.id)).size).toBe(2) // distinct ids, not overwritten
    expect(all.every((c) => c.name === "Vex")).toBe(true)
  })

  it("supports a partial selection — only the chosen entities/characters are imported", async () => {
    await entityStore.putAll([strike, sneakAttack])
    const bundle = await buildExportBundle(["core.strike", "core.sneakAttack"], [])

    const summary = await importBundle(bundle, { entityIds: ["core.strike"] })
    expect(summary).toEqual({ entitiesImported: 1, charactersImported: 0 })
    expect(await entityStore.get("core.strike")).toEqual(strike)
  })

  it("rejects a bundle with the wrong format/version tag", () => {
    const result = parseExportBundle({ format: "something-else", version: 1, exportedAt: "now", entities: [], characters: [] })
    expect(result.success).toBe(false)
  })

  it("rejects non-object input", () => {
    expect(parseExportBundle("just a string").success).toBe(false)
    expect(parseExportBundle(null).success).toBe(false)
  })
})
