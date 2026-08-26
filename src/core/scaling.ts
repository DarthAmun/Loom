// Layer 0 — Core Math: level scaling curves.
// Shape and constants seeded from pf2e-math-reference.md. Treat the numbers
// as a tunable starting envelope, not a locked target — see that file's
// closing note.

/** DC by level, levels -1..25. Not a clean linear formula in the source data
 * (some steps are +1, some +2), so this is a lookup table rather than a
 * derived function, extended flat past the ends for out-of-range levels. */
const DC_BY_LEVEL: Record<number, number> = {
  [-1]: 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22, 7: 23,
  8: 24, 9: 26, 10: 27, 11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35,
  17: 36, 18: 38, 19: 39, 20: 40, 21: 42, 22: 44, 23: 46, 24: 48, 25: 50,
}

function dcByLevel(level: number): number {
  const clamped = Math.max(-1, Math.min(25, Math.round(level)))
  return DC_BY_LEVEL[clamped] ?? 15
}

/** HP/level by class durability tier — PF2e groups every class into one of
 * three tiers (6/8/10-12); we fold 10 and 12 together as "martial" since
 * Phase 0 doesn't need a 4th tier just for Barbarian/Guardian. Callers still
 * add ancestry HP + key-ability modifier on top; this curve is class HP only. */
export type DurabilityTier = "caster" | "hybrid" | "martial"

const HP_PER_LEVEL_BY_TIER: Record<DurabilityTier, number> = {
  caster: 6,
  hybrid: 8,
  martial: 10,
}

export function classHpForTier(tier: DurabilityTier, level: number): number {
  return HP_PER_LEVEL_BY_TIER[tier] * level
}

/** PLACEHOLDER — not derivable from foundryvtt/pf2e (GM-guidance only, not
 * structured data). Naive flat-ish curve so downstream code has *something*
 * to call; needs a real playtesting pass before it means anything. */
function placeholderExpectedDamagePerRound(level: number): number {
  return 4 + level * 2
}

/** PLACEHOLDER — same caveat as above; wealth-by-level is GM guidance in
 * PF2e, not structured data, so this is an invented placeholder curve only. */
function placeholderWealthByLevel(level: number): number {
  return level * 150
}

/** Both "how hard is the check" and "what AC should a level-N thing have" —
 * PF2e uses one progression for both, per pf2e-math-reference.md. */
export const acEnvelope = dcByLevel

export const LevelScalingCurve: Record<string, (level: number) => number> = {
  dcByLevel,
  acEnvelope,
  expectedDamage: placeholderExpectedDamagePerRound,
  wealthByLevel: placeholderWealthByLevel,
}
