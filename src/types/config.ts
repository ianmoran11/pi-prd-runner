export type RunMode = "supervised" | "auto";
export type MergeStrategy = "squash";
export type BranchStrategy = "one-branch-per-prd";
export type PermissionLevel = "full";

export interface CheckCommandConfig {
  name: string;
  command: string;
}

export interface RunnerConfig {
  schemaVersion: 1;
  project: {
    prdDirectory: string;
    prdPattern: string;
    baseBranch: string;
  };
  worktrees: {
    enabled: boolean;
    directory: string;
    cleanAfterMerge: boolean;
  };
  branches: {
    prefix: string;
    strategy: BranchStrategy;
  };
  run: {
    defaultMode: RunMode;
    serial: boolean;
    maxReviewCycles: number;
    immediateRevisionOnFailedChecks: boolean;
  };
  supervised: {
    autoMerge: boolean;
    pauseBeforePrd: boolean;
    pauseAfterImplementation: boolean;
    pauseBeforeReview: boolean;
    pauseBeforeMerge: boolean;
    pauseOnFailedChecks: boolean;
    pauseOnChangesRequested: boolean;
  };
  auto: {
    autoMerge: boolean;
    continueToNextPrd: boolean;
    stopOnMaxReviewCycles: boolean;
    stopOnMergeConflict: boolean;
    stopOnStuck: boolean;
  };
  permissions: {
    agentPermissions: PermissionLevel;
  };
  checks: {
    default: CheckCommandConfig[];
  };
  review: {
    approvalAuthority: "reviewer";
    requireFreshReviewSession: boolean;
    requireStructuredDecision: boolean;
  };
  merge: {
    targetBranch: string;
    strategy: MergeStrategy;
    deleteBranchAfterMerge: boolean;
    requireCleanWorkingTree: boolean;
  };
  artifacts: {
    writeImplementationSummary: boolean;
    writeReviewReport: boolean;
    writeReviewJson: boolean;
    writeTestResults: boolean;
    writeDiffPatch: boolean;
    writeChangedFiles: boolean;
    writeRunSummary: boolean;
  };
}

