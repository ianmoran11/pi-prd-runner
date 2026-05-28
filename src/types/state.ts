import type { RunMode } from "./config.js";
import type { PrdStatus } from "./prd.js";

export type CheckStatus = "pending" | "passed" | "failed";
export type ReviewDecision = "approved" | "changes_requested" | "blocked";

export interface PrdState {
  id: string;
  path: string;
  title: string;
  status: PrdStatus;
  branch: string | null;
  worktree: string | null;
  attempt: number;
  maxReviewCycles: number;
  lastReviewDecision: ReviewDecision | null;
  lastCheckStatus: CheckStatus | null;
  mergeCommit: string | null;
  startedAt: string | null;
  lastUpdated: string | null;
}

export interface RunnerState {
  schemaVersion: 1;
  initialized: boolean;
  activeRunId: string | null;
  mode: RunMode;
  baseBranch: string;
  currentPrd: string | null;
  prds: Record<string, PrdState>;
  lastUpdated: string | null;
  stopRequested?: boolean;
}

export type InitialRunnerState = RunnerState;
