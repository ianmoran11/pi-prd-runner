import type { CheckStatus, ReviewDecision } from "./state.js";

export const RUNNER_EVENT_TYPES = [
  "run.started",
  "run.stopped",
  "run.completed",
  "run.failed",
  "prd.started",
  "prd.status_changed",
  "worktree.created",
  "worktree.reused",
  "implementation.started",
  "implementation.completed",
  "checks.started",
  "checks.passed",
  "checks.failed",
  "review.started",
  "review.approved",
  "review.changes_requested",
  "review.blocked",
  "merge.started",
  "merge.completed",
  "merge.conflict",
  "prd.stuck",
  "prd.skipped"
] as const;

export type RunnerEventType = (typeof RUNNER_EVENT_TYPES)[number];

export interface RunnerEvent {
  ts: string;
  type: RunnerEventType;
  runId?: string;
  mode?: string;
  prd?: string;
  attempt?: number;
  from?: string;
  to?: string;
  branch?: string;
  worktree?: string;
  target?: string;
  status?: CheckStatus;
  decision?: ReviewDecision;
  message?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export type NewRunnerEvent = Omit<RunnerEvent, "ts"> & { ts?: string };
