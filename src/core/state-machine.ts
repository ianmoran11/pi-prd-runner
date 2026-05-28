import type { NewRunnerEvent } from "../types/event.js";
import type { ParsedPrd, PrdStatus } from "../types/prd.js";
import type { PrdState, RunnerState } from "../types/state.js";
import { appendEvent } from "./events.js";
import { writeState } from "./state.js";

const allowedTransitions: Record<PrdStatus, PrdStatus[]> = {
  pending: ["ready", "skipped", "failed", "stuck"],
  ready: ["implementing", "skipped", "failed", "stuck"],
  implementing: ["implemented", "failed", "stuck"],
  implemented: ["checking", "failed", "stuck"],
  checking: ["reviewing", "changes_requested", "failed", "stuck"],
  reviewing: ["approved", "changes_requested", "stuck", "failed"],
  changes_requested: ["implementing", "failed", "stuck"],
  approved: ["merging", "failed", "stuck"],
  merging: ["merged", "failed", "stuck"],
  merged: ["failed", "stuck"],
  skipped: ["failed", "stuck"],
  stuck: ["failed", "stuck"],
  failed: ["stuck"]
};

export class InvalidTransitionError extends Error {
  constructor(from: PrdStatus, to: PrdStatus) {
    super(`Invalid PRD status transition: ${from} -> ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: PrdStatus, to: PrdStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function createPrdState(prd: ParsedPrd, maxReviewCycles: number, ts = new Date().toISOString()): PrdState {
  return {
    id: prd.id,
    path: prd.relativePath,
    title: prd.title ?? prd.id,
    status: (prd.status as PrdStatus | undefined) ?? "pending",
    branch: null,
    worktree: null,
    attempt: 0,
    maxReviewCycles: prd.maxReviewCycles ?? maxReviewCycles,
    lastReviewDecision: null,
    lastCheckStatus: null,
    mergeCommit: null,
    startedAt: null,
    lastUpdated: ts
  };
}

export interface TransitionOptions {
  runId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  now?: string;
}

export async function transitionPrd(
  cwd: string,
  state: RunnerState,
  prdId: string,
  to: PrdStatus,
  options: TransitionOptions = {}
): Promise<RunnerState> {
  const prdState = state.prds[prdId];
  if (!prdState) {
    throw new Error(`Cannot transition unknown PRD '${prdId}'.`);
  }

  const from = prdState.status;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }

  const now = options.now ?? new Date().toISOString();
  const nextPrdState: PrdState = {
    ...prdState,
    status: to,
    startedAt: prdState.startedAt ?? (to === "implementing" ? now : null),
    lastUpdated: now
  };
  const nextState: RunnerState = {
    ...state,
    currentPrd: prdId,
    prds: { ...state.prds, [prdId]: nextPrdState },
    lastUpdated: now
  };

  await writeState(cwd, nextState);
  const event: NewRunnerEvent = {
    type: "prd.status_changed",
    runId: options.runId ?? state.activeRunId ?? undefined,
    prd: prdId,
    from,
    to,
    message: options.message,
    metadata: options.metadata
  };
  await appendEvent(cwd, event);
  return nextState;
}

