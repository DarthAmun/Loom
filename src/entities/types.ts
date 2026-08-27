import type { ProficiencyRank } from "../core/proficiency.js"

export type EntityRef = string // id reference

// ---------------------------------------------------------------------------
// Supporting types
//
// The brief's schema *references* Prerequisite, TriggerSpec, ConditionSpec,
// CheckSpec, DurationSpec and ScalingRule but doesn't define their shape.
// Drafted below from context while building the 15 mechanics + 3 packages —
// flagged in README.md's report section as things a human should sanity-check,
// since they were invented rather than specified.
// ---------------------------------------------------------------------------

export type Prerequisite =
  | { kind: "entity"; entityId: EntityRef }
  | { kind: "attribute"; attribute: string; minValue: number }
  | { kind: "proficiency"; proficiencyKey: string; minRank: ProficiencyRank }
  | { kind: "level"; minLevel: number }

export interface TriggerSpec {
  /** Event name on the shared bus, e.g. "strike.hit", "turn.start". */
  event: string
}

export type ConditionSpec =
  | { kind: "attribute"; attribute: string; op: "gte" | "lte" | "eq"; value: number }
  | { kind: "proficiency"; proficiencyKey: string; minRank: ProficiencyRank }
  | { kind: "hasTag"; tag: string; on: "self" | "event.target" | "event.attacker" }
  | { kind: "eventField"; field: string; equals: unknown }
  | { kind: "resource"; resourceKey: string; op: "gte" | "lte" | "eq"; value: number }

export interface CheckSpec {
  /** What the roll is measured against, e.g. "ac", "fortitudeDC", flat DC. */
  against: { kind: "defense"; key: string } | { kind: "flatDC"; dc: number }
  proficiencyKey?: string
  attribute?: string
}

export interface DurationSpec {
  unit: "rounds" | "minutes" | "hours" | "encounter" | "permanent"
  value?: number
}

export type ScalingRule =
  | { by: "level"; base: number; perStep: number; stepSize?: number }
  | { by: "castLevel"; base: number; perStep: number; stepSize?: number }
  | { by: "proficiencyRank"; amounts: Partial<Record<ProficiencyRank, number>> }

/** Dice notation (e.g. "2d6") for a value effect's amount — flat numbers and
 * ScalingRule can't express dice-based damage (Sneak Attack, most weapon/spell
 * damage). `count` can itself be a ScalingRule so a die count that scales with
 * level (Sneak Attack: 1d6 -> 4d6) doesn't need a separate mechanism.
 * `kind: "dice"` is the discriminant against ScalingRule (keyed by `by`),
 * matching every other tagged union in this file. */
export interface DiceExpression {
  kind: "dice"
  count: number | ScalingRule
  faces: number
}

export function isDiceExpression(amount: unknown): amount is DiceExpression {
  return typeof amount === "object" && amount !== null && (amount as { kind?: unknown }).kind === "dice"
}

/** The pool a "choice" Effect picks from — see the schema-fixes-plan's
 * Phase D design pass (ChoiceSet corpus survey). Three shapes surfaced,
 * each its own `kind` (rather than two variants sharing "entities") so this
 * discriminates the same clean way every other tagged union in this file
 * does — Prerequisite, ConditionSpec, Effect itself — and schema.ts can mirror
 * it with z.discriminatedUnion instead of falling back to z.union:
 *  - "entitiesByTag" / "entitiesByRefs": pick from other Entities, either
 *    every Entity carrying a tag (the dominant corpus pattern — Arcane
 *    School, Bloodline, Druidic Order, Instinct, Gunslinger's Way, a
 *    class-feat-tagged pool for Multifarious Muse's feat pick) or an
 *    explicit small list of refs. Picking from either pool both applies the
 *    chosen Entity/Entities AND records the pick — this is the common case
 *    where "pick" and "grant" are the same decision (PF2e's
 *    ChoiceSet+GrantItem pair, collapsed).
 *  - "literal": pick from plain string values that aren't Entities at all
 *    (Palatine Detective's skill choice: "occultism"/"religion"; Advanced
 *    Weapon Training's weapon-group enum). Nothing gets applied — the pick
 *    is only recorded, for something else to read back.
 * Deliberately NOT modeled here: PF2e uses the recorded pick to parameterize
 * a *target/predicate string* on another rule on the same item (e.g.
 * `system.skills.{choice}.rank`, or a MartialProficiency `definition`
 * referencing the chosen weapon group). That's real (3 of the 10 surveyed
 * examples need it) but is template-substitution machinery orthogonal to
 * the choice primitive itself — left as a follow-up once something actually
 * needs to read a recorded choice back out of runtimeState. */
export type ChoiceSource =
  | { kind: "entitiesByTag"; tag: string }
  | { kind: "entitiesByRefs"; refs: EntityRef[] }
  | { kind: "literal"; options: string[] }

// ---------------------------------------------------------------------------
// Layer 2 — Effect
// ---------------------------------------------------------------------------

export type Effect =
  | { kind: "value"; target: string; op: "+" | "-" | "×" | "set"; amount: number | ScalingRule | DiceExpression }
  | { kind: "applyEntity"; entityId: EntityRef; duration?: DurationSpec }
  | { kind: "variant"; selectBy: "castLevel" | "degreeOfSuccess"; variants: Effect[] }
  | { kind: "conditionalDuration"; check: CheckSpec; onFail: "remove" }
  | { kind: "choice"; bind: string; count: number; from: ChoiceSource }

// ---------------------------------------------------------------------------
// Layer 3 — Hook
// ---------------------------------------------------------------------------

export interface Hook {
  /** e.g. "attackRoll.abilityScoreSource", "multipleAttackPenalty.curve", "incomingDamage.byTag" */
  appliesTo: string
  operation: "override" | "replaceCurve" | "negateIfTagged" | "adjustIfTagged"
  value: unknown
}

/** `value` shapes the engine interprets for "incomingDamage.byTag" hooks —
 * the only appliesTo the engine actually resolves so far (see
 * engine/incomingDamage.ts). `negateIfTagged`'s value is just the matching
 * tag (a string, e.g. "fire" — full immunity). `adjustIfTagged`'s value
 * covers both Resistance (amount: -N) and Weakness (amount: +N) with one
 * operation, per the schema-fixes-plan's reasoning: simpler than two
 * separate operation names for a mirror-image reduce/increase. */
export interface AdjustIfTaggedValue {
  tag: string
  amount: number
}

// ---------------------------------------------------------------------------
// Layer 1 — Entity
// ---------------------------------------------------------------------------

export type ActionCost =
  | { type: "actions"; count: 0 | 1 | 2 | 3 }
  | { type: "reaction" }
  | { type: "free" }
  | { type: "inherit" } // inherits cost from `wraps` target

export interface Entity {
  id: string
  name: string
  description?: string
  tags: string[] // flavor + provenance, e.g. "source:dnd5e-barbarian", "house:slytherin"
  prerequisites: Prerequisite[]
  conflicts: EntityRef[]
  cost: ActionCost
  wraps?: EntityRef // e.g. Power Attack wraps Strike
  trigger?: TriggerSpec
  condition?: ConditionSpec[]
  effects: Effect[]
  hooks?: Hook[]
  scaling?: ScalingRule[] // numeric-only; shape changes go through Effect variants
}
