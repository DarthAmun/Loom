# Loom — design brief

Context document for design work on Loom's UI. Not a spec to build against —
[claude-code-brief.md](./claude-code-brief.md) is the technical brief for
that. This is "what is this thing, what exists today, what's the UI trying
to become."

## What Loom is

A personal pen-and-paper RPG system builder. It uses Pathfinder 2e's
mechanical chassis (three-action economy, degrees of success) as a
*reference* for tight math, but the actual goal is different: capture the
*flavor* of a class/subclass/setting concept — from an existing system, or
invented from scratch (e.g. a Harry-Potter-flavored wand wizard) — as a
small set of composable **Entities** that all share one schema, so content
from different sources can mix and match through a shared prerequisite
graph.

The author is the sole user for now: a GM building a homebrew system,
authoring content by having an LLM draft Entity JSON against the schema
(outside this app), then reviewing and saving it here.

## Current state

**Engine** (root package, plain TypeScript, no UI): a five-layer schema —
core math, Entity/Effect/Hook (the content model), Character + a
trigger-based event bus (the resolution engine) — plus 15 drafted example
mechanics (Strike, Rage, Sneak Attack, Spellcasting, Conditions, etc.) and
3 small archetype packages exercising different parts of the schema. Fully
tested; a console demo proves a Strike firing a `strike.hit` event that
Sneak Attack correctly reacts to.

**Storage**: Dexie/IndexedDB, offline-first (matching the author's prior
project, [DM's Tome](../DmsTome)) — Entities and Characters persist
locally in the browser, no backend.

**UI** (`apps/web`, Angular + signals via Analog.js) styled in **"Warp"**
— a dark-workbench theme imported from a Claude Design project (Spectral
serif for names, IBM Plex Sans/Mono for structure, hue-coded accents where
color carries meaning: blue-violet = trigger relationships, orange =
wraps/hard-warnings, magenta = hooks, green = success, gold = soft
notes). Tokens live in `apps/web/src/styles.css`; shared presentation
logic (readable one-line entity summaries, cost badges, relationship
detection) lives in `apps/web/src/app/utils/`.

- **Entity list** (`/`) — sidebar with source counts + nav (Entities /
  Characters / Graph / Provenance-not-yet-built), search, tag/synthetic
  filter pills (`has:trigger`, `has:hook`), and rows with a computed
  readable summary per entity ("wraps core.strike", "on strike.hit · if
  target has condition:flat-footed", "3 castLevel variants · 6/12/18
  damage") rather than just raw fields.
- **Entity editor** (`/entities/:id`, also `/entities/new`) — split view:
  a line-numbered JSON textarea on the left (paste/edit, still the only
  editing surface — see below for why), a live "reads as" panel on the
  right that renders the parsed Entity as prose (trigger + conditions as
  a sentence, effects described, a bar chart for level-scaled amounts)
  plus a "related" panel cross-referencing wraps/wrapped-by/applies.
- **Graph** (`/graph`, new) — computes real edges from entity data (wraps,
  strike-related triggers/hooks, applyEntity) and lays them out in three
  columns; flags unresolved references (an id that doesn't exist) if any
  exist.
- **Character builder** (`/characters`, `/characters/:id`, new) — create a
  character (name/level/durability tier, starting HP from Layer 0 math),
  inline-edit attributes/proficiencies, and add Entities from a picker
  that checks real prerequisites/conflicts against the character's actual
  state (eligible/blocked/conflict, with the specific unmet reason). Also
  flags live issues: an active entity whose prerequisites are no longer
  met, or two active entities hooking the same computation path with no
  defined resolution order.

**Deployment**: builds to a static site, deployed to GitHub Pages via
Actions on push to `main`.

### What the UI deliberately does *not* do (yet)

- No generation — Entity JSON is drafted elsewhere (an LLM session) and
  pasted in. The editor's job is review, not authoring from scratch. (This
  was an explicit scope decision, not an oversight.)
- No structured field-by-field form for Entity's nested shape (effects,
  hooks, prerequisites) — still one JSON blob, reviewed via the "reads as"
  panel rather than edited field-by-field. The schema itself is still
  evolving (see claude-code-brief.md's Phase 0 report on open questions
  like `variant` effect ordering and Hook value shapes), so a full
  generated form would be encoding conventions that might still change.
- The character builder doesn't execute the resolution engine — adding
  "Rage" adds Rage itself to the active list, but doesn't also apply its
  `applyEntity` effect (the "Raging" buff) the way actually running a
  turn would. Prerequisite/conflict checking is real; effect execution
  isn't wired in yet.
- Provenance/balance tooling has no page yet (nav item present, disabled).

## What's coming (later phases, not yet built)

Per claude-code-brief.md's roadmap:

- **Provenance/balance tooling** — Entities already carry `source:`-prefixed
  tags for where a mechanic came from (though every drafted Entity is
  currently tagged `source:core` — no package-level source tags exist yet
  in the actual data); this phase surfaces that and compares against the
  Layer 0 balance envelope.
- A test case porting one non-PF2e concept end-to-end, to prove the
  "mix sources" premise actually works in practice, not just in schema.
- Wiring the character builder's "add entity" flow to the real resolution
  engine, so applied effects (buffs, etc.) actually execute instead of
  just tracking the top-level active entity.

## Design considerations

- **Audience of one, for now** — this doesn't need onboarding flows,
  empty-state marketing copy, or broad accessibility work aimed at unknown
  users. It needs to be fast and pleasant for the author's own repeated
  use (author, review, tweak, repeat).
- **Content-dense, not decorative** — Entities carry a lot of small
  structured facts (tags, cost, prerequisites, nested effects). The
  editor's job is making that legible, not dressing it up.
- **Visual identity: "Warp"** — resolved (was "not decided" as of Phase 2's
  first pass). Dark workbench, not DM's Tome's tome/parchment look; leans
  into the name's weaving/threads sense — relationships between Entities
  (wraps, triggers, hooks) are drawn as colored threads throughout (list
  row indicators, editor's "related" panel, the graph page). Deliberately
  distinct from DM's Tome rather than matching it.
- **The JSON-textarea editor is still the only *editing* surface**, but is
  now paired with a live "reads as" panel that renders the parsed Entity
  as prose + a scaling chart — reviewing no longer means reading raw
  JSON. Replacing the textarea itself with structured fields is still
  weighed against the schema-still-evolving reason it was avoided
  originally (see claude-code-brief.md's report section for what's still
  unsettled).
