import { EntityRegistry } from "./entities/registry.js"
import { GameEngine } from "./engine/engine.js"
import { allMechanics } from "./data/mechanics/index.js"
import { allPackageEntities } from "./data/packages/index.js"
import { ProficiencyBonus } from "./core/proficiency.js"
import { acEnvelope } from "./core/scaling.js"
import type { Character, EntityInstance } from "./character/types.js"

function makeCharacter(params: { hp: number; level?: number; activeEntities?: EntityInstance[] }): Character {
  return {
    attributes: {},
    level: params.level ?? 1,
    proficiencies: new Map(),
    resources: new Map([["hp", { current: params.hp, max: params.hp }]]),
    activeEntities: params.activeEntities ?? [],
  }
}

function hp(character: Character): string {
  const res = character.resources.get("hp")
  return res ? `${res.current}/${res.max}` : "?"
}

// Deliverable 4: prove the trigger bus end-to-end — a Strike resolves,
// fires "strike.hit", and Sneak Attack (subscribed to that event) checks its
// condition and applies its effect. Run twice with the same fixed d20 roll
// to show the condition branching both ways.
function main(): void {
  const registry = new EntityRegistry()
  registry.registerAll(allMechanics)
  registry.registerAll(allPackageEntities)

  const rogueLevel = 5
  const targetAC = acEnvelope(3) // level-3 target
  const attackBonus = ProficiencyBonus.expert(rogueLevel)
  const fixedRoller = () => 12 // natural 12 + attackBonus(9) = 21, vs AC 18 -> "success", not critical

  for (const [label, targetIsFlatFooted] of [
    ["Scenario 1: target IS flat-footed -> Sneak Attack should fire", true],
    ["Scenario 2: target is NOT flat-footed -> Sneak Attack's condition should fail", false],
  ] as const) {
    console.log(`\n=== ${label} ===`)

    const rogue = makeCharacter({ hp: 40, level: rogueLevel, activeEntities: [{ entityId: "core.sneakAttack" }] })
    const target = makeCharacter({
      hp: 30,
      level: 3,
      activeEntities: targetIsFlatFooted ? [{ entityId: "core.condition.flat-footed" }] : [],
    })

    const engine = new GameEngine(registry, fixedRoller)
    const result = engine.resolveStrike({
      attacker: rogue,
      target,
      targetAC,
      attackBonus,
      allCharacters: [rogue, target],
    })

    console.log(engine.trace.join("\n"))
    console.log(`-> degree: ${result.degree}, total damage: ${result.damage}, target hp: ${hp(target)}`)
  }
}

main()
