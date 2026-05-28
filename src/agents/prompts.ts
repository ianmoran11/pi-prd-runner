import type { ParsedPrd } from "../types/prd.js";
import type { CheckRunResult } from "../checks/check-runner.js";

export interface ImplementationPromptContext {
  prd: ParsedPrd;
  attempt: number;
  branch: string;
  worktree: string;
  artifactDirectory: string;
  revisionNotes?: string[];
}

export interface ReviewPromptContext {
  prd: ParsedPrd;
  diff: string;
  changedFiles: string;
  implementationSummary: string;
  testResults: string;
}

export interface RevisionPromptContext extends ImplementationPromptContext {
  checkResult?: CheckRunResult;
  requiredRevisions?: string[];
}

function acceptanceCriteria(prd: ParsedPrd): string {
  return prd.acceptanceCriteria.map((criterion) => `- ${criterion.text}`).join("\n");
}

export function renderImplementationPrompt(context: ImplementationPromptContext): string {
  const revisionNotes = context.revisionNotes?.length ? `\nRevision notes:\n${context.revisionNotes.map((note) => `- ${note}`).join("\n")}\n` : "";
  return `Implement the current PRD only.

PRD: ${context.prd.id}
Title: ${context.prd.title ?? context.prd.id}
Attempt: ${context.attempt}
Branch: ${context.branch}
Worktree: ${context.worktree}
Artifact directory: ${context.artifactDirectory}

Scope rules:
- Read the PRD carefully and implement only this PRD.
- Do not implement future PRDs or excluded scope.
- Be honest about incomplete work.
${revisionNotes}
Acceptance criteria:
${acceptanceCriteria(context.prd)}

Required artifacts:
- implementation-summary.md
- test-results.md
- changed-files.md
- diff.patch
- metadata.json

Run required checks when possible and commit the implementation to the PRD branch when committing is available.

PRD body:
${context.prd.body}
`;
}

export function renderReviewPrompt(context: ReviewPromptContext): string {
  return `Review this PRD implementation in a fresh context.

PRD: ${context.prd.id}
Title: ${context.prd.title ?? context.prd.id}

Review requirements:
- Assess the diff against the PRD only.
- Check every acceptance criterion.
- Do not modify implementation files.
- Decide exactly one of: approved, changes_requested, blocked.
- Return structured JSON matching the required schema.

Acceptance criteria:
${acceptanceCriteria(context.prd)}

Changed files:
${context.changedFiles}

Implementation summary:
${context.implementationSummary}

Test results:
${context.testResults}

Diff:
${context.diff}

Required JSON shape:
{
  "decision": "approved | changes_requested | blocked",
  "summary": "...",
  "acceptanceCriteria": [{"criterion": "...", "status": "passed | failed | unclear", "evidence": "..."}],
  "requiredRevisions": [],
  "optionalSuggestions": [],
  "risk": "low | medium | high"
}
`;
}

export function renderRevisionPrompt(context: RevisionPromptContext): string {
  const failedChecks = context.checkResult?.results
    .filter((result) => result.status === "failed")
    .map((result) => `- ${result.name}: ${result.command}`)
    .join("\n");
  const revisions = context.requiredRevisions?.map((revision) => `- ${revision}`).join("\n");

  return renderImplementationPrompt({
    ...context,
    revisionNotes: [
      ...(failedChecks ? [`Failed checks:\n${failedChecks}`] : []),
      ...(revisions ? [`Required review revisions:\n${revisions}`] : [])
    ]
  });
}

