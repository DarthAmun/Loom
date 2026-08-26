// fake-indexeddb polyfill is loaded globally via vitest.config.ts's
// setupFiles (test/setup.ts) — it has to run before "dexie" is imported
// anywhere, which a per-file import can't guarantee across test files.
import Dexie from "dexie"
import { beforeEach, describe, expect, it } from "vitest"
import { resetDb } from "../src/storage/db.js"
import { entityStore, loadRegistryFromDb } from "../src/storage/entityStore.js"
import { characterStore } from "../src/storage/characterStore.js"
import { strike } from "../src/data/mechanics/strike.js"
import { sneakAttack } from "../src/data/mechanics/sneakAttack.js"

beforeEach(async () => {
  resetDb()
  await Dexie.delete("loom")
})

describe("entityStore", () => {
  it("round-trips an Entity's nested effects/hooks without a JSON step", async () => {
    await entityStore.put(sneakAttack)
    const loaded = await entityStore.get("core.sneakAttack")
    expect(loaded).toEqual(sneakAttack)
  })

  it("bulk-loads entities and finds them by tag", async () => {
    await entityStore.putAll([strike, sneakAttack])
    const found = await entityStore.findByTag("skirmisher")
    expect(found.map((e) => e.id)).toEqual(["core.sneakAttack"])
  })

  it("loadRegistryFromDb produces a registry the engine can use", async () => {
    await entityStore.putAll([strike, sneakAttack])
    const registry = await loadRegistryFromDb()
    expect(registry.get("core.strike").name).toBe("Strike")
  })
})

describe("characterStore", () => {
  it("computes starting HP from Layer 0's classHpForTier, not a hand-typed number", async () => {
    const character = await characterStore.create({ name: "Vex", level: 5, durabilityTier: "martial", ancestryAndAbilityHp: 10 })
    // 10 (ancestry+ability) + 10hp/level(martial) * 5 = 60
    expect(character.resources.get("hp")).toEqual({ current: 60, max: 60 })
  })

  it("round-trips Map-typed fields (proficiencies, resources) through IndexedDB", async () => {
    const created = await characterStore.create({ name: "Rin", level: 1, durabilityTier: "caster" })
    const reloaded = await characterStore.get(created.id!)
    expect(reloaded?.resources).toBeInstanceOf(Map)
    expect(reloaded?.proficiencies).toBeInstanceOf(Map)
    expect(reloaded?.resources.get("hp")?.current).toBe(14) // 8 + 6*1
  })

  it("update() persists partial changes", async () => {
    const created = await characterStore.create({ name: "Tam", level: 1, durabilityTier: "hybrid" })
    await characterStore.update(created.id!, { level: 2 })
    const reloaded = await characterStore.get(created.id!)
    expect(reloaded?.level).toBe(2)
    expect(reloaded?.name).toBe("Tam") // untouched fields survive a partial update
  })
})
