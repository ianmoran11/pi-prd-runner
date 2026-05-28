export const REVIEW_DECISIONS = ["approved", "changes_requested", "blocked"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_CRITERION_STATUSES = ["passed", "failed", "unclear"] as const;
export type ReviewCriterionStatus = (typeof REVIEW_CRITERION_STATUSES)[number];

export const REVIEW_RISKS = ["low", "medium", "high"] as const;
export type ReviewRisk = (typeof REVIEW_RISKS)[number];

export interface ReviewAcceptanceCriterionResult {
  criterion: string;
  status: ReviewCriterionStatus;
  evidence: string;
}

export interface ReviewResult {
  decision: ReviewDecision;
  summary: string;
  acceptanceCriteria: ReviewAcceptanceCriterionResult[];
  requiredRevisions: string[];
  optionalSuggestions: string[];
  risk: ReviewRisk;
}

export interface ImplementationResult {
  summary: string;
  committed: boolean;
  artifactsWritten: string[];
  incompleteWork: string[];
}

