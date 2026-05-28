export interface AttemptArtifactPaths {
  runDirectory: string;
  prdDirectory: string;
  attemptDirectory: string;
  implementationSummary: string;
  reviewReport: string;
  reviewResult: string;
  testResults: string;
  changedFiles: string;
  diffPatch: string;
  metadata: string;
  stuckReport: string;
}

export interface AttemptMetadata {
  prd: string;
  attempt: number;
  branch: string | null;
  worktree: string | null;
  status: string;
  checks?: Record<string, string>;
  reviewDecision?: string | null;
}

