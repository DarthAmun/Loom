export type DegreeOfSuccess = "criticalFailure" | "failure" | "success" | "criticalSuccess"

/** Order convention used everywhere a `variant` Effect is keyed by degree of
 * success. Not specified by the brief's Effect type (variants is just
 * Effect[], no per-entry tag) — this fixed index order is the convention
 * Phase 0 assumes. See README's report section. */
export const DEGREE_ORDER: readonly DegreeOfSuccess[] = [
  "criticalFailure",
  "failure",
  "success",
  "criticalSuccess",
]

function stepUp(degree: DegreeOfSuccess): DegreeOfSuccess {
  const i = DEGREE_ORDER.indexOf(degree)
  return DEGREE_ORDER[Math.min(i + 1, DEGREE_ORDER.length - 1)] as DegreeOfSuccess
}

function stepDown(degree: DegreeOfSuccess): DegreeOfSuccess {
  const i = DEGREE_ORDER.indexOf(degree)
  return DEGREE_ORDER[Math.max(i - 1, 0)] as DegreeOfSuccess
}

/** Standard PF2e-style degree-of-success math: compare total to DC in steps
 * of 10, then step by one degree (capped) on a natural 20 or natural 1. */
export function degreeOfSuccess(total: number, dc: number, natural: number): DegreeOfSuccess {
  let degree: DegreeOfSuccess
  if (total >= dc + 10) degree = "criticalSuccess"
  else if (total >= dc) degree = "success"
  else if (total <= dc - 10) degree = "criticalFailure"
  else degree = "failure"

  if (natural === 20) degree = stepUp(degree)
  if (natural === 1) degree = stepDown(degree)
  return degree
}

/** Injectable so demo/tests can be deterministic instead of actually random. */
export type D20Roller = () => number

export const randomD20: D20Roller = () => 1 + Math.floor(Math.random() * 20)
