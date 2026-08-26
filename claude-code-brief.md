# Project Brief — Custom d20 RPG Engine (for Claude Code)

## What this is

A personal pen-and-paper RPG system using Pathfinder 2e's chassis (three-action economy, degrees of success, tight math) as mechanical inspiration, built around a **unified entity system** instead of separate class/feat/ancestry-feat structures. The goal is **not** mechanical fidelity to PF2e, D&D 5e, or any other system — it's capturing the *flavor and playstyle* of a class/subclass/setting concept (from an existing system, or invented from scratch, e.g. a Harry-Potter-flavored wand wizard) as a small set of composable Entities that all share the same underlying schema, so anything built this way can mix and match through a shared prerequisite graph.

Stack: Vue 3 / Nuxt 3 / TypeScript / Tailwind / Dexie.js / pnpm — matches the author's existing toolchain and a prior project ("DM's Tome," an offline-first local-storage PWA) whose patterns are worth following for storage conventions.

## Current task: Phase 0 only

**Do not build any UI or set up Nuxt yet.** Phase 0 is a plain TypeScript package whose only goal is to prove the core resolution engine works before anything depends on it. Everything below is scoped to that.

---

## Schema (five layers)

### Layer 0 — Core Math
Pure formulas, not entities. Real starting values are available in `pf2e-math-reference.md` (extracted directly from foundryvtt/pf2e's source) — use those as the initial envelope rather than inventing placeholders. The exact constants are still tunable later; the formulas and tiering shape are the load-bearing part to preserve.

```ts
type ProficiencyRank = "untrained" | "trained" | "expert" | "master" | "legendary"
const ProficiencyBonus: Record<ProficiencyRank, (level: number) => number>
const LevelScalingCurve: Record<string, (level: number) => number> // e.g. "expectedDamage", "expectedHP", "acEnvelope"
```

### Layer 1 — Entity
The unified content model — every feat, spell, class feature, item, and condition is one of these.

```ts
type EntityRef = string // id reference

interface Entity {
  id: string
  name: string
  tags: string[]                 // flavor + provenance, e.g. "source:dnd5e-barbarian", "house:slytherin"
  prerequisites: Prerequisite[]
  conflicts: EntityRef[]
  cost: ActionCost
  wraps?: EntityRef              // e.g. Power Attack wraps Strike
  trigger?: TriggerSpec
  condition?: ConditionSpec[]
  effects: Effect[]
  hooks?: Hook[]
  scaling?: ScalingRule[]        // numeric-only; shape changes go through Effect variants
}

type ActionCost =
  | { type: "actions"; count: 0 | 1 | 2 | 3 }
  | { type: "reaction" }
  | { type: "free" }
  | { type: "inherit" }          // inherits cost from `wraps` target
```

### Layer 2 — Effect (tagged union)

```ts
type Effect =
  | { kind: "value"; target: string; op: "+" | "-" | "×" | "set"; amount: number | ScalingRule }
  | { kind: "applyEntity"; entityId: EntityRef; duration?: DurationSpec }
  | { kind: "variant"; selectBy: "castLevel" | "degreeOfSuccess"; variants: Effect[] }
  | { kind: "conditionalDuration"; check: CheckSpec; onFail: "remove" }
```

### Layer 3 — Hook
Intercepts *how* another computation resolves, rather than adding a value.

```ts
interface Hook {
  appliesTo: string   // e.g. "attackRoll.abilityScoreSource", "multipleAttackPenalty.curve", "incomingDamage.byTag"
  operation: "override" | "replaceCurve" | "negateIfTagged"
  value: unknown
}
```

### Layer 4 — Character + event bus

```ts
interface Character {
  attributes: Record<string, number>
  level: number
  proficiencies: Map<string, ProficiencyRank>
  resources: Map<string, { current: number; max: number }>
  activeEntities: EntityInstance[]
}
```

Trigger-based Entities (Sneak Attack, Reactive Strike, persistent damage ticks) all subscribe to a shared event bus rather than being special-cased:

```
On any game event (e.g. "strike.hit", "turn.start", "enemy.moveInReach"):
  → find all activeEntities whose trigger matches the event
  → check each one's condition[]
  → if satisfied, resolve its effects[] (which may post new events)
```

### Layer 5 — Provenance & Balance
Not needed for Phase 0's engine test, but the `tags` field on Entity should already support a `source:` prefix convention so this layer can be added later without a schema migration.

---

## Phase 0 deliverables

1. **Set up a plain TypeScript package** (pnpm, no framework) with the type definitions above.
2. **Generate draft Entity data** for these 15 mechanics — draft them against the schema, then flag anything that doesn't fit cleanly rather than forcing it:
   - Strike, Power Attack, Reactive Strike, Rage, Sneak Attack, Proficiency (this one is Layer 0, not an Entity — confirm it's modeled correctly as *not* an Entity), Armor, Conditions, Spellcasting, Spell Slots, Healing, Persistent Damage, Weapon Traits, Monster Abilities, Skill Feats.
3. **Generate signature Entities for 3 small archetype packages** (not full classes, just enough to exercise the schema):
   - A martial `wraps`-heavy package (something like a Fighter's Strike variants).
   - A caster package using `variant` effects (something with heightening-style scaling).
   - A Hook-heavy package (a weapon trait like Finesse that overrides which ability score an attack uses).
4. **Write a minimal resolution engine** — just enough to run a console test proving the trigger bus works end-to-end: a Strike resolves, fires `strike.hit`, and a Sneak Attack Entity subscribed to that event correctly checks its condition and applies its effect.
5. **Report back** anything where the schema had to be stretched, worked around, or where the same kind of fix was needed repeatedly across generated Entities — that's a signal for a human decision, not something to silently patch around.

## Explicitly out of scope for this phase (human design decisions, not coding tasks)

- The parts of Layer 0's scaling curves not covered by `pf2e-math-reference.md` (notably expected damage-per-round by level, and wealth/treasure by level — neither exists as structured data in the source repo) — these still need playtesting judgment or a manual pull from rulebook guidance, not invention. Use clearly-marked placeholder values for these specifically.
- Flavor/creative decisions about what makes a given class/concept feel right — draft reasonably, but treat these as drafts for human review, not final content.
- Layer 5's balance-budget thresholds (how much deviation from the envelope is acceptable) — not needed yet, just don't block Layer 5's future addition with schema choices made now.

## Reference for later phases (not this task)

Phase 1: Core Math + Dexie storage. Phase 2: minimal Entity editor with a generate-then-review authoring flow (not manual-only forms). Phase 3: character builder (prerequisites, conflicts, resources). Phase 4: prerequisite graph visualization. Phase 5: provenance/balance tooling. Phase 6: port one non-PF2e concept end-to-end as the real test of the "mix and match different sources" premise.
