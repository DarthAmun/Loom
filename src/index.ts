// Public API surface for consumers outside this package (currently:
// apps/web). Re-exports rather than deep-importing src/**/*.js paths keeps
// the UI decoupled from the engine's internal file layout.
export * from "./entities/types.js"
export { EntityRegistry } from "./entities/registry.js"
export { safeParseEntity, type EntityParseResult } from "./entities/schema.js"
export { GameEngine } from "./engine/engine.js"
export { evaluateScalingRule } from "./engine/scalingRule.js"
export { expectedDiceValue } from "./engine/dice.js"
export { evaluatePrerequisite, evaluatePrerequisites, type PrerequisiteEvalContext, type PrerequisiteResult } from "./engine/prerequisites.js"
export { resolveChoiceOptions, firstOptionChooser, type Chooser } from "./engine/choice.js"

export type { Character, EntityInstance, GameEvent } from "./character/types.js"

export { entityStore, loadRegistryFromDb } from "./storage/entityStore.js"
export { characterStore, type NewCharacterParams } from "./storage/characterStore.js"
export { type StoredCharacter } from "./storage/db.js"
export {
  buildExportBundle,
  parseExportBundle,
  importBundle,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  type ExportBundle,
  type ParseBundleResult,
  type ImportSelection,
  type ImportSummary,
} from "./storage/exportImport.js"
export { type CharacterExport } from "./character/schema.js"

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
