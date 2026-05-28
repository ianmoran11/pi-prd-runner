export const SUPPORTED_PRD_STATUSES = [
  "pending",
  "ready",
  "implementing",
  "implemented",
  "checking",
  "reviewing",
  "changes_requested",
  "approved",
  "merging",
  "merged",
  "skipped",
  "stuck",
  "failed"
] as const;

export type PrdStatus = (typeof SUPPORTED_PRD_STATUSES)[number];

export interface PrdFrontmatter {
  id?: string;
  title?: string;
  status?: string;
  depends_on?: unknown;
  risk?: string;
  max_review_cycles?: number;
}

export interface AcceptanceCriterion {
  text: string;
  checked: boolean;
}

export interface ParsedPrd {
  id: string;
  rawId?: string;
  title?: string;
  status?: string;
  dependsOn: string[];
  risk?: string;
  maxReviewCycles?: number;
  path: string;
  relativePath: string;
  hasFrontmatter: boolean;
  frontmatter: PrdFrontmatter;
  body: string;
  sections: Record<string, string>;
  goal?: string;
  scope?: string;
  acceptanceCriteria: AcceptanceCriterion[];
  requiredChecks: string[];
  reviewerChecklist: string[];
  raw: string;
}

export interface PrdValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  prdId?: string;
  file?: string;
}

export interface PrdValidationResult {
  valid: boolean;
  errors: PrdValidationIssue[];
  warnings: PrdValidationIssue[];
}

