// Layer 0 — Core Math: proficiency.
// Deliberately NOT an Entity — confirmed per brief. It's a pure lookup used
// wherever a check/DC needs "how good is this character at X", and Entities
// only ever *reference* a proficiency key (e.g. via Prerequisite or Hook),
// they never define one.

export type ProficiencyRank = "untrained" | "trained" | "expert" | "master" | "legendary"

export const PROFICIENCY_RANK_ORDER: readonly ProficiencyRank[] = [
  "untrained",
  "trained",
  "expert",
  "master",
  "legendary",
]

const RANK_BONUS: Record<ProficiencyRank, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
}

/** bonus(rank, level) = rankBonus[rank] + (rank > untrained ? level : 0) */
export const ProficiencyBonus: Record<ProficiencyRank, (level: number) => number> = {
  untrained: () => RANK_BONUS.untrained,
  trained: (level) => RANK_BONUS.trained + level,
  expert: (level) => RANK_BONUS.expert + level,
  master: (level) => RANK_BONUS.master + level,
  legendary: (level) => RANK_BONUS.legendary + level,
}

export function rankAtLeast(rank: ProficiencyRank, minimum: ProficiencyRank): boolean {
  return PROFICIENCY_RANK_ORDER.indexOf(rank) >= PROFICIENCY_RANK_ORDER.indexOf(minimum)
}

/** "Simple DCs by rank" — untethered from level, e.g. generic Lore checks. */
export const SIMPLE_DC_BY_RANK: Record<ProficiencyRank, number> = {
  untrained: 10,
  trained: 15,
  expert: 20,
  master: 30,
  legendary: 40,
}

/** Proficiency Without Level variant — flatter master/legendary tier, noted as worth knowing about. */
export const SIMPLE_DC_BY_RANK_NO_LEVEL: Record<ProficiencyRank, number> = {
  ...SIMPLE_DC_BY_RANK,
  master: 25,
  legendary: 30,
}
