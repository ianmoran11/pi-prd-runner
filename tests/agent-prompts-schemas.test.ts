import { describe, expect, it } from "vitest";
import { parsePrd } from "../src/core/prd-parser.js";
import { parseReviewOutput, validateReviewResult } from "../src/agents/schemas.js";
import { renderImplementationPrompt, renderReviewPrompt, renderRevisionPrompt } from "../src/agents/prompts.js";

const prd = parsePrd(
  `---
id: prd-001-auth
title: Auth
status: pending
depends_on: []
---

# Auth

## Goal

Add auth.

## Scope

Included:
- Login

Excluded:
- OAuth

## Acceptance criteria

- [ ] Users can log in.
`,
  "docs/prds/prd-001-auth.md"
);

describe("review schemas", () => {
  it("validates structured review JSON", () => {
    expect(
      validateReviewResult({
        decision: "approved",
        summary: "Looks good.",
        acceptanceCriteria: [{ criterion: "Users can log in.", status: "passed", evidence: "Tested." }],
        requiredRevisions: [],
        optionalSuggestions: [],
        risk: "low"
      })
    ).toMatchObject({ decision: "approved" });
  });

  it("rejects malformed review output", () => {
    expect(() => validateReviewResult({ decision: "maybe" })).toThrow();
  });

  it("extracts fenced review JSON", () => {
    const parsed = parseReviewOutput(`\`\`\`json
{
  "decision": "changes_requested",
  "summary": "Needs tests.",
  "acceptanceCriteria": [{"criterion": "Users can log in.", "status": "unclear", "evidence": "No test evidence."}],
  "requiredRevisions": ["Add tests."],
  "optionalSuggestions": [],
  "risk": "medium"
}
\`\`\``);

    expect(parsed.requiredRevisions).toEqual(["Add tests."]);
  });
});

describe("prompt rendering", () => {
  it("renders implementation instructions with scope and artifacts", () => {
    const prompt = renderImplementationPrompt({
      prd,
      attempt: 1,
      branch: "pi/prd-001-auth",
      worktree: ".pi/prd-runner/worktrees/prd-001-auth",
      artifactDirectory: ".pi/prd-runner/runs/run/prd-001-auth/attempt-001"
    });

    expect(prompt).toContain("Implement the current PRD only.");
    expect(prompt).toContain("implementation-summary.md");
    expect(prompt).toContain("Users can log in.");
  });

  it("renders review instructions requiring fresh context and JSON", () => {
    const prompt = renderReviewPrompt({
      prd,
      diff: "diff --git a/file b/file",
      changedFiles: "- `file`",
      implementationSummary: "Ready.",
      testResults: "passed"
    });

    expect(prompt).toContain("fresh context");
    expect(prompt).toContain('"decision"');
    expect(prompt).toContain("diff --git");
  });

  it("renders revision instructions from failed checks and review revisions", () => {
    const prompt = renderRevisionPrompt({
      prd,
      attempt: 2,
      branch: "pi/prd-001-auth",
      worktree: "wt",
      artifactDirectory: "artifacts",
      checkResult: {
        status: "failed",
        results: [
          {
            name: "test",
            command: "npm test",
            status: "failed",
            exitCode: 1,
            stdout: "",
            stderr: "fail",
            durationMs: 1,
            timedOut: false
          }
        ]
      },
      requiredRevisions: ["Fix login test."]
    });

    expect(prompt).toContain("Failed checks");
    expect(prompt).toContain("Fix login test.");
  });
});
