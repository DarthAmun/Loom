// Must be the first import: Dexie detects IndexedDB support once, at import
// time, so the polyfill has to be in place before "dexie" is loaded. This is
// independent of the test suite's polyfill (test/setup.ts, wired through
// vitest.config.ts) — this file is a standalone Node entry point, not a
// test, so it needs its own. Phase 1 has no browser yet; this is what lets
// `pnpm demo:storage` run under plain Node.
import "fake-indexeddb/auto"

import { entityStore, loadRegistryFromDb } from "./storage/entityStore.js"
import { characterStore } from "./storage/characterStore.js"
import { allMechanics } from "./data/mechanics/index.js"
import { allPackageEntities } from "./data/packages/index.js"
import { GameEngine } from "./engine/engine.js"
import { acEnvelope } from "./core/scaling.js"
import { ProficiencyBonus } from "./core/proficiency.js"
import { makeCharacter, hpLabel } from "./character/fixtures.js"

// Phase 1 proof: seed the Phase 0 draft Entities into Dexie/IndexedDB, load
// them back out into a fresh EntityRegistry (no static imports feeding the
// engine directly), create a persisted Character whose starting HP comes
// from Layer 0's classHpForTier, and rerun the same Strike -> strike.hit ->
// Sneak Attack scenario from Phase 0 — this time sourced entirely from storage.
async function main(): Promise<void> {
  console.log("=== seeding Entities into IndexedDB ===")
  await entityStore.putAll([...allMechanics, ...allPackageEntities])
  console.log(`stored ${(await entityStore.list()).length} entities`)

  console.log("\n=== creating a persisted Character (starting HP from Layer 0) ===")
  const rogueRecord = await characterStore.create({
    name: "Vex the Rogue",
    level: 5,
    durabilityTier: "hybrid", // rogue-ish: 8 hp/level tier
    ancestryAndAbilityHp: 10,
    activeEntities: [{ entityId: "core.sneakAttack" }],
  })
  console.log(`created "${rogueRecord.name}" (id ${rogueRecord.id}), hp ${hpLabel(rogueRecord)}`)

  console.log("\n=== loading the engine's registry from storage, not static imports ===")
  // Independent reads (entities table vs. characters table) — no reason to
  // serialize them.
  const [registry, rogue] = await Promise.all([loadRegistryFromDb(), characterStore.get(rogueRecord.id!)])
  if (!rogue) throw new Error("rogue not found after create")

  const targetLevel = 3
  const target = makeCharacter({ hp: 30, level: targetLevel, activeEntities: [{ entityId: "core.condition.flat-footed" }] })

  const engine = new GameEngine(registry, () => 12)
  const result = engine.resolveStrike({
    attacker: rogue,
    target,
    targetAC: acEnvelope(targetLevel),
    attackBonus: ProficiencyBonus.expert(rogue.level),
    allCharacters: [rogue, target],
  })

  console.log("\n" + engine.trace.join("\n"))
  console.log(`-> degree: ${result.degree}, total damage: ${result.damage}, target hp: ${hpLabel(target)}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
