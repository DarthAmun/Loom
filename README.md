# Loom — a custom d20 RPG engine

A plain TypeScript package (no framework yet) implementing the layered
schema and resolution engine described in
[claude-code-brief.md](./claude-code-brief.md).

- **Phase 0** (done): core resolution engine — Layer 0–4 types, 15 drafted
  mechanics, 3 archetype packages, the trigger-bus engine, a console demo.
- **Phase 1** (done): Dexie/IndexedDB storage for Entities and Characters,
  wired to Layer 0's core math.
- **Phase 2** (done): a minimal Entity editor UI — Angular + signals, via
  Analog.js (apps/web).
- **Phase 3** (done): character builder — prerequisites, conflicts,
  resources.
- **Phase 4** (done): prerequisite graph visualization.
- **Phase 5** (done): provenance & balance tooling.
- Phase 6+ (not started): porting one non-PF2e concept end-to-end. See the
  brief.

## Stack

Per the brief: pnpm + TypeScript, matching [DM's Tome](../DmsTome)'s
tooling conventions. The brief's *original* choice of Vue/Nuxt for the UI
has been swapped for **Angular with signals** — [Analog.js](https://analogjs.org)
is the closest equivalent to Nuxt (file-based routing, SSR, Vite-based).

The repo is a pnpm workspace: `.` (root) is the engine package (Layers
0–4, storage — everything below), `apps/web` is the Analog.js UI, which
depends on the engine package by its workspace name (`loom`), resolved
straight from TypeScript source (no build step) via
`package.json`'s `"exports": { ".": "./src/index.ts" }`.

## Running it

```bash
pnpm install
pnpm demo               # Phase 0 console demo: Strike -> strike.hit -> Sneak Attack
pnpm demo:storage       # Phase 1 console demo: same, but sourced from Dexie/IndexedDB
pnpm test               # vitest suite (engine + storage + schema)
pnpm typecheck
pnpm --filter web dev   # Phase 2 UI, http://localhost:5173
```

## Layout

```
src/core/            Layer 0 — proficiency formula, level-scaling curves
src/entities/         Layer 1/2/3 types — Entity, Effect, Hook + supporting types; schema.ts (zod validation);
                        balance.ts (Phase 5 — Layer 5 balance comparison against Layer 0's envelope)
src/character/         Layer 4 — Character, EntityInstance, GameEvent; fixtures.ts, factory.ts
src/engine/            the resolution engine: checks, conditions, effect resolution, trigger bus
src/data/mechanics/    the 15 mechanics from the brief, drafted as Entities
src/data/packages/     the 3 archetype packages (martial/wraps, caster/variant, hooks)
src/storage/           Phase 1 — Dexie db, entityStore, characterStore
src/index.ts           Phase 2 — public API surface consumed by apps/web
src/main.ts            Phase 0 deliverable-4 console demo
src/main-storage.ts     Phase 1 console demo (seed -> load -> resolve, all through storage)
test/engine.test.ts    Phase 0 scenarios, asserted
test/storage.test.ts   Phase 1: entity/character CRUD, Map round-trips, registry bridging
test/schema.test.ts    Phase 2: zod validation of real (and broken) Entity JSON
apps/web/              Analog.js UI: entity list/editor (Phase 2), character
                        builder (Phase 3), prerequisite graph (Phase 4),
                        provenance & balance (Phase 5)
```

## Phase 2 — entity editor UI

Scope, per the user: generation happens *outside* the app (an LLM drafts
Entity JSON elsewhere); the editor's job is to let that JSON be pasted in,
validated, reviewed, edited, and saved — not to generate it. So the UI is
deliberately just:

- `apps/web/src/app/pages/index.page.ts` — list of stored Entities (name,
  id, tags, cost), a "Load draft data" button (seeds Phase 0's drafted
  mechanics), a "New Entity" link.
- `apps/web/src/app/pages/entities/[id].page.ts` — the whole editor: a
  JSON textarea, live validation (JSON syntax + `src/entities/schema.ts`'s
  zod schema) shown as a green "Valid" summary or a red error list, and
  Save/Delete. Editing an existing entity's `id` field and saving performs
  a rename (the old row is deleted, not left as an orphaned duplicate).
- `apps/web/src/app/services/entity-store.service.ts` — a signals-based
  wrapper around `entityStore` from the engine package.

`src/entities/schema.ts` is a zod mirror of `src/entities/types.ts`,
needed because pasted JSON has no compile-time guarantee of matching the
schema — `types.ts`'s interfaces only check shape for code written *in*
this package. It's the recursive-`variant`-effect case (see Phase 0's
report) that makes this worth a real schema library rather than hand-rolled
checks: `z.lazy` handles the self-reference cleanly.

### Debugging note: Vite pulling engine source into Angular's compiler

Getting `apps/web` to import the engine package's plain TypeScript
directly (no build step) surfaced a real bug worth recording. Requests for
`src/index.ts` (and anything it transitively imported) were silently
returning **empty** module bodies — no error, no console output — which
then surfaced downstream as `SyntaxError: does not provide an export named
'allMechanics'`, pointing at the wrong file entirely.

Root cause: `@analogjs/vite-plugin-angular` runs Angular's TypeScript
compiler over every `.ts` module Vite transforms, excluding anything whose
path contains `node_modules`. The `loom` workspace package is a pnpm
symlink (`apps/web/node_modules/loom -> ../../..`); Vite's default
`resolve.preserveSymlinks: false` resolves that symlink to its **realpath**
before handing the id to plugins, which no longer contains `node_modules`
— so the exclude never matched, and the engine package's plain TS (zero
Angular decorators) got compiled under `apps/web`'s stricter tsconfig
(`noPropertyAccessFromIndexSignature`, which the engine package doesn't
opt into). `engine.ts`'s `ctx.event?.payload.degree`-style index-signature
access failed that check, and — because Angular's compiler emits per
*program*, not per-file the way esbuild does — one file's hard error
silently emptied every other file's output in the same compilation too.

Fix: `resolve.preserveSymlinks: true` in `apps/web/vite.config.ts` keeps
the symlinked path intact, so the Angular plugin's `node_modules` exclude
matches correctly and the engine package gets handled by Vite's default
(non-Angular) TS transform instead. Documented in that file and here in
case a similar silent-empty-module symptom shows up again when this
workspace grows more linked packages.

## Phase 5 — provenance & balance

`/provenance` — two things, per the brief and design-brief's "what's
coming" list.

**Provenance**: groups every stored Entity by its `source:` tag. Every
drafted Entity, including the 3 archetype packages, was still tagged
`source:core` going into this phase — `entity-summary.ts`'s `SOURCE_COLORS`
already anticipated `pkg-martial` / `pkg-caster` / `pkg-hooks` as real
source values (and `styles.css`'s theme comment already ties `--caster` to
"pkg-caster source", `--gold` to "pkg-hooks source"), so this phase retags
the package-original entities in `src/data/packages/*.ts` to match — the
color system was built for this, it just hadn't landed yet.

**Balance**: compares numeric `value` effects against Layer 0's envelope
curves (`LevelScalingCurve`). The target→envelope mapping, deviation
thresholds, and the actual comparison live in `src/entities/balance.ts` —
engine-side, not in `apps/web` — since that's domain knowledge about the
schema and Layer 0, the same split `eligibility.ts` uses over
`engine/prerequisites.ts`: the engine decides what's comparable and what
the numbers are, `apps/web/src/app/utils/balance.ts` only adds a display
label on top. This only means something for effects that are actually
level-scaled — and grep across the drafted data shows almost none are:
every `damage`/`ac` effect except `core.sneakAttack` is a flat placeholder
number with no level basis at all (matches Phase 0's own report: "every
damage number... is a flat placeholder... a real damage-dice type is
needed before this data means anything"). Rather than fake a per-level
comparison for those, `balanceReportFor` buckets every entity's value
effects into three groups and the page shows all three: **comparable**
(level/castLevel-scaled, target has an envelope — currently just Sneak
Attack vs. `expectedDamage`), **unscaled** (flat number, no level basis to
compare), and **not level-comparable** (`by: "proficiencyRank"`, or a
target like `hp` with no per-Entity envelope — `classHpForTier` needs a
durability tier, which isn't a per-Entity concept). Making the gap visible
in the UI, rather than forcing a fake comparison, follows the same pattern
as Phase 0's report.

The brief explicitly left "how much deviation from the envelope is
acceptable" as an undecided human call. This phase makes a starting-default
choice — `BALANCE_THRESHOLDS` in `src/entities/balance.ts`: ±20% = watch,
±50% = off envelope — as one named, commented constant, not tuned or
load-bearing anywhere else. Easy to retune once the envelope curves
themselves (and the damage-dice type Phase 0 flagged as missing) are less
placeholder.

## Phase 4 — prerequisite graph

Extends `/graph` (built in Phase 3 as the general entity-relationship view —
wraps, strike-related triggers/hooks, applyEntity) with the two edge kinds
that make it an actual *prerequisite* graph: entity-kind `Prerequisite`s
(`prereq.kind === 'entity'`) and `conflicts`. Both are literal id
references in the schema, same as `wraps`/`applyEntity`, so they're drawn
as solid structural edges — except `conflict`, drawn dashed like `trigger`
since it's a mutual-exclusion marker rather than a flow. Conflicts are
deduped by unordered id pair (`apps/web/src/app/utils/graph.ts`'s
`conflictPairsSeen`) since the schema doesn't guarantee a conflict is
declared on only one side — same both-ways check `eligibility.ts` already
does for the character builder's picker.

`EdgeKind` (`wraps | trigger | hook | applies | prerequisite | conflict`)
is its own type in `graph.ts`, not derived from `entity-summary.ts`'s
`RelationshipKind` — that type picks one *primary* label per entity for
list-row/stripe coloring, but an entity can carry several prerequisites
and several conflicts at once, so edges need their own union and their own
color map (`EDGE_COLOR`, also in `graph.ts`).

## Phase 3 — character builder

`apps/web/src/app/pages/characters/` — create a character (name, level,
durability tier; starting HP from Layer 0 math via
`characterStore.create`), inline-edit attributes/proficiencies/resources,
and add Entities from a picker backed by real prerequisite/conflict
checking (`apps/web/src/app/utils/eligibility.ts`) against
`src/engine/prerequisites.ts`'s `evaluatePrerequisites` (mirrors
`engine/conditions.ts`'s `evaluateConditions` shape, evaluated against a
Character's own state rather than a live event). The builder's footer also
surfaces live warnings: an active entity whose prerequisites are no longer
met (state can change after a pick — e.g. a conflicting choice came
later), and two active entities hooking the same `appliesTo` with no
defined resolution order. Doesn't execute the resolution engine — adding
an entity tracks it as active but doesn't run its effects (e.g. Rage's
`applyEntity` buff isn't actually applied); real effect execution is still
open per the design brief's "what's coming" list.

## Phase 1 — storage

`src/storage/db.ts` follows [DM's Tome](../DmsTome)'s `useDb.ts` conventions:
a `Dexie` subclass with versioned `.stores()`, a lazy `getDb()` singleton,
a `now()` timestamp helper, and store modules grouping CRUD by table
(`entityStore`, `characterStore`). One deliberate difference: DM's Tome
JSON-stringifies nested columns because its schema mirrors a prior SQLite
layout — Loom has no legacy schema to mirror, so `Entity`'s nested fields
and `Character`'s `Map`-typed fields (`proficiencies`, `resources`) are
stored as native objects/Maps; IndexedDB's structured-clone storage handles
both without a serialization step (verified in `storage.test.ts`).

There's no browser yet (Phase 2 brings the UI), so `pnpm demo:storage` and
the storage tests run against [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)
in Node. That's a Phase 1 stand-in, not a real dependency — Dexie talks to
whatever `indexedDB` global is present, and a browser's native
implementation will replace this without any code change once there's a UI.

`characterStore.create` ties Layer 0 to Layer 4 directly: starting HP comes
from `classHpForTier(tier, level)` rather than being typed in by hand, so
"Core Math + Dexie storage" (the brief's Phase 1 line) is one connected
piece of work, not two unrelated ones sharing a folder.

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
