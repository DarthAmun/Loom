// Public API surface for consumers outside this package (currently:
// apps/web). Re-exports rather than deep-importing src/**/*.js paths keeps
// the UI decoupled from the engine's internal file layout.
export * from "./entities/types.js"
export { EntityRegistry } from "./entities/registry.js"
export { safeParseEntity, type EntityParseResult } from "./entities/schema.js"
export { GameEngine } from "./engine/engine.js"
export { evaluateScalingRule } from "./engine/scalingRule.js"
export { evaluatePrerequisite, evaluatePrerequisites, type PrerequisiteEvalContext, type PrerequisiteResult } from "./engine/prerequisites.js"

export type { Character, EntityInstance, GameEvent } from "./character/types.js"

export { entityStore, loadRegistryFromDb } from "./storage/entityStore.js"
export { characterStore, type NewCharacterParams } from "./storage/characterStore.js"
export { type StoredCharacter } from "./storage/db.js"

export { allMechanics } from "./data/mechanics/index.js"
export { allPackageEntities } from "./data/packages/index.js"

export { ProficiencyBonus, rankAtLeast, PROFICIENCY_RANK_ORDER, type ProficiencyRank } from "./core/proficiency.js"
export { classHpForTier, type DurabilityTier } from "./core/scaling.js"

export {
  allBalanceReports,
  balanceReportFor,
  BALANCE_LEVELS,
  BALANCE_THRESHOLDS,
  type BalanceReport,
  type BalanceStatus,
  type ComparableRow,
  type ComparablePoint,
  type FlatRow,
  type NoEnvelopeRow,
} from "./entities/balance.js"
