import type { RunMode } from "./config.js";

export interface InitialRunnerState {
  schemaVersion: 1;
  initialized: true;
  activeRunId: null;
  mode: RunMode;
  baseBranch: string;
  currentPrd: null;
  prds: Record<string, never>;
  lastUpdated: null;
}

