# Loom — Phase 0: core resolution engine

A plain TypeScript package (no framework) proving the resolution engine
described in [claude-code-brief.md](./claude-code-brief.md) works before
anything depends on it. No UI, no storage — that's Phase 1+.

## Stack

Per the brief: pnpm + TypeScript, matching [DM's Tome](../DmsTome)'s
tooling conventions. The brief's *original* choice of Vue/Nuxt for later
phases has been swapped for **Angular with signals** — [Analog.js](https://analogjs.org)
is the closest equivalent to Nuxt (file-based routing, SSR, Vite-based) and
is the natural pick once Phase 2's entity editor needs a UI. None of that
matters yet: Phase 0 has zero framework dependency either way.

## Running it

```bash
pnpm install
pnpm demo        # console demo: Strike -> strike.hit -> Sneak Attack
pnpm test        # vitest suite
pnpm typecheck
```

## Layout

```
src/core/           Layer 0 — proficiency formula, level-scaling curves
src/entities/        Layer 1/2/3 types — Entity, Effect, Hook + supporting types
src/character/        Layer 4 — Character, EntityInstance, GameEvent
src/engine/           the resolution engine: checks, conditions, effect resolution, trigger bus
src/data/mechanics/   the 15 mechanics from the brief, drafted as Entities
src/data/packages/    the 3 archetype packages (martial/wraps, caster/variant, hooks)
src/main.ts           deliverable-4 console demo
test/engine.test.ts   same scenarios, asserted
```

## Deliverable 4 — trigger bus proof

`pnpm demo` runs a Strike that resolves, fires `strike.hit`, and Sneak
Attack (subscribed to that event) checks its condition against the event's
*target* and adds its own damage into the same in-flight resolution — twice,
once with the target flat-footed (fires) and once without (correctly
doesn't). `test/engine.test.ts` asserts the same, plus a miss case and a
standalone proof that nested `variant` effects (castLevel → degreeOfSuccess)
resolve correctly.

## Deliverable 5 — report: where the schema had to be stretched

Per the brief, this is the important part — signals for a human decision,
not things silently patched around.

### Recurring pattern: four Effect kinds can't express "roll and branch"

Nothing in `value | applyEntity | variant | conditionalDuration` can express
"roll a d20, compare to a DC, branch by degree of success" — that's the
single most load-bearing computation in the whole system (every Strike,
save, and skill check does it) and it doesn't fit any of the four kinds. It
came up for **Strike, Reactive Strike, Power Attack, Certain Strike, Ember
Burst, Breath Weapon** — i.e. most of the drafted content.

Workaround taken: the roll-and-compare step is engine-native
(`GameEngine.resolveStrike`), and Entities only supply the *data-driven*
part — damage-by-degree via a `variant` effect. This works, but it means
"Strike" isn't actually a pure data-driven Entity the way the schema implies
— there's a hardcoded engine function backing every combat action. Worth
deciding deliberately: either accept an engine-native check step as
permanent (add a real `CheckSpec`-driven "resolve a check" primitive so
*any* Entity, not just Strike, can trigger one), or treat this as a hole to
fill with a 5th Effect kind.

### `variant`'s `variants: Effect[]` has no per-entry key

Both `selectBy` modes need an index convention invented, not specified:
- `degreeOfSuccess`: assumed fixed order `[criticalFailure, failure,
  success, criticalSuccess]` (see `engine/check.ts`'s `DEGREE_ORDER`).
- `castLevel`: assumed `variants[0]` = base cast level, each next index =
  **+1** spell level. PF2e itself routinely heightens every 2 or 3 levels,
  which this can't represent — Ember Burst (`data/packages/casterVariants.ts`)
  had to fudge its heightening interval to fit the convention rather than
  model PF2e's actual heighten cadence.

If `variant` gets used for real, each entry probably wants an explicit key
(`{ when: "success"; effect: Effect }` or `{ heightenLevel: 2; effect:
Effect }`) instead of relying on array position.

### `ScalingRule` can't hit uneven thresholds

`{ by: "level"; base; perStep; stepSize }` only produces evenly-spaced
steps. PF2e's actual Sneak Attack progression (1d6 at 1st, 2d6 at 5th, 3d6
at 11th, 4d6 at 17th) is *not* evenly spaced — `sneakAttack.ts`'s scaling is
a fudged approximation, not the real curve. A threshold-table shape (like
`DC_BY_LEVEL` in `core/scaling.ts`) would fit this better than a formula.

### No dice-expression type

`amount: number | ScalingRule` only supports flat numbers — there's no way
to say "1d6" or "2d8+4". Every damage number in the drafted data (Strike,
Sneak Attack, spells, healing) is a flat placeholder standing in for a dice
average. Fine for Phase 0's plumbing test; a real damage-dice type is needed
before this data means anything for actual play.

### `Hook.value: unknown` means hooks aren't actually declarative

The type is honest about needing different shapes per `appliesTo`, but the
practical effect is that every new hook target needs bespoke interpreter
code in the engine — there's no way to write a generic "apply this hook"
function. Phase 0's engine doesn't consume hooks at all yet (drafted for
shape in `weaponTraits.ts` / `hookHeavy.ts` / `conditions.ts`'s `frightened`,
never executed) specifically because each one would need its own case. Also:
`negateIfTagged` reads as "cancel something when a tag is present"
everywhere it shows up except `pkg.hooks.versatileS`, where the closest fit
is "swap the damage type unless a tag says otherwise" — same operation name,
different meaning. Worth either a 4th operation or renaming what
`negateIfTagged` covers.

### `conditionalDuration.onFail` is backwards for Persistent Damage

PF2e persistent damage is removed on a **successful** flat check; the
schema only has `onFail: "remove"`. Modeled as an inverted check ("does it
keep going" rather than "is it cured") in `persistentDamage.ts` so the type
still technically applies — but that's a workaround, and anyone reading the
data cold will assume `check` means the recovery check the PF2e way. Needs
an `onSuccess` variant, or `onFail` renamed to something outcome-neutral.

### Passive value effects have nowhere to be read from

Armor's `{ kind: "value"; target: "ac"; op: "+" }` and a passive Rage buff's
"add damage every Strike" both assume some aggregation step turns "all
active Entities' value effects targeting X" into "this character's current
X". Phase 0's engine doesn't have that step — AC is just a number passed
into `resolveStrike` by the caller, not computed from activeEntities. Not
wrong, just unbuilt; the trigger-bus path (Sneak Attack) proves the
triggered half of resolution works, but the "always-on passive" half is a
separate mechanism this phase didn't need to build to satisfy deliverable 4.

### Types invented outright, not specified by the brief

`Prerequisite`, `TriggerSpec`, `ConditionSpec`, `CheckSpec`, `DurationSpec`,
`ScalingRule` are referenced in the brief's schema but never defined. Drafts
live in `src/entities/types.ts`; worth a deliberate look since Phase 3
(prerequisites/conflicts) and Phase 4 (prerequisite graph) both build
directly on `Prerequisite`'s shape.

### Minor: `wraps` doesn't say override-vs-combine

Power Attack, Reactive Strike, and Certain Strike all "wrap" Strike, but the
schema doesn't say whether a wrapper's `effects` *replace* the wrapped
Entity's or run *alongside* them. Phase 0 assumed full replacement (the
wrapper restates its own complete `variant` block rather than layering on
top of Strike's) — reads fine for these three examples, but worth
confirming that's the intended model before more wrapping Entities are
drafted on top of an assumption that might be wrong.

### Things that fit cleanly, no notes needed

Skill Feats, Monster Abilities, Armor-as-data (modulo the aggregation gap
above), and Conditions-as-Entities all mapped onto the schema without
friction across every example drafted.
