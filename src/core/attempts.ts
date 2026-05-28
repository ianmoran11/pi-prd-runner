import type { PrdState } from "../types/state.js";

export function nextAttemptNumber(prd: PrdState): number {
  return prd.attempt + 1;
}

export function attemptsRemaining(prd: PrdState): number {
  return Math.max(prd.maxReviewCycles - prd.attempt, 0);
}

