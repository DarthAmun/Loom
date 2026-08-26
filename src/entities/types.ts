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

// ---------------------------------------------------------------------------
// Layer 2 — Effect
// ---------------------------------------------------------------------------

export type Effect =
  | { kind: "value"; target: string; op: "+" | "-" | "×" | "set"; amount: number | ScalingRule }
  | { kind: "applyEntity"; entityId: EntityRef; duration?: DurationSpec }
  | { kind: "variant"; selectBy: "castLevel" | "degreeOfSuccess"; variants: Effect[] }
  | { kind: "conditionalDuration"; check: CheckSpec; onFail: "remove" }

// ---------------------------------------------------------------------------
// Layer 3 — Hook
// ---------------------------------------------------------------------------

export interface Hook {
  /** e.g. "attackRoll.abilityScoreSource", "multipleAttackPenalty.curve", "incomingDamage.byTag" */
  appliesTo: string
  operation: "override" | "replaceCurve" | "negateIfTagged"
  value: unknown
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
