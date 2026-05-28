import { describe, expect, it } from "vitest";
import { runImplementationAgent } from "../src/agents/implementation-agent.js";
import { runReviewAgent } from "../src/agents/review-agent.js";
import { MockHost } from "../src/core/host.js";
import { parsePrd } from "../src/core/prd-parser.js";

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

const approvedReview = JSON.stringify({
  decision: "approved",
  summary: "Meets the PRD.",
  acceptanceCriteria: [{ criterion: "Users can log in.", status: "passed", evidence: "Tests pass." }],
  requiredRevisions: [],
  optionalSuggestions: [],
  risk: "low"
});

function reviewOutput(decision: "approved" | "changes_requested" | "blocked"): string {
  return JSON.stringify({
    decision,
    summary: `${decision} summary`,
    acceptanceCriteria: [{ criterion: "Users can log in.", status: decision === "approved" ? "passed" : "failed", evidence: "Evidence." }],
    requiredRevisions: decision === "changes_requested" ? ["Fix login."] : [],
    optionalSuggestions: [],
    risk: decision === "blocked" ? "high" : "medium"
  });
}

describe("implementation agent orchestration", () => {
  it("runs implementation sessions through the host", async () => {
    const host = new MockHost();
    host.agentResults.push({ ok: true, output: "done" });

    const result = await runImplementationAgent({
      host,
      prd,
      attempt: 1,
      branch: "pi/prd-001-auth",
      worktree: "/tmp/worktree",
      artifactDirectory: "/tmp/artifacts"
    });

    expect(result.ok).toBe(true);
    expect(host.agentSessions[0]).toMatchObject({
      kind: "implementation",
      cwd: "/tmp/worktree",
      metadata: { prd: "prd-001-auth", attempt: 1 }
    });
    expect(host.agentSessions[0].prompt).toContain("Implement the current PRD only");
  });
});

describe("review agent orchestration", () => {
  it("runs approved reviews in a fresh session", async () => {
    const host = new MockHost();
    host.agentResults.push({ ok: true, output: approvedReview });

    const result = await runReviewAgent({
      host,
      prd,
      worktree: "/tmp/worktree",
      diff: "diff",
      changedFiles: "- file",
      implementationSummary: "summary",
      testResults: "passed"
    });

    expect(result.review.decision).toBe("approved");
    expect(result.repaired).toBe(false);
    expect(host.agentSessions[0].freshContext).toBe(true);
  });

  it("surfaces changes requested and blocked decisions", async () => {
    const changesHost = new MockHost();
    changesHost.agentResults.push({ ok: true, output: reviewOutput("changes_requested") });
    const blockedHost = new MockHost();
    blockedHost.agentResults.push({ ok: true, output: reviewOutput("blocked") });

    const common = { prd, worktree: "/tmp/worktree", diff: "diff", changedFiles: "- file", implementationSummary: "summary", testResults: "passed" };

    await expect(runReviewAgent({ host: changesHost, ...common })).resolves.toMatchObject({
      review: { decision: "changes_requested", requiredRevisions: ["Fix login."] }
    });
    await expect(runReviewAgent({ host: blockedHost, ...common })).resolves.toMatchObject({
      review: { decision: "blocked" }
    });
  });

  it("repairs malformed review JSON once", async () => {
    const host = new MockHost();
    host.agentResults.push({ ok: true, output: "not json" }, { ok: true, output: approvedReview });

    const result = await runReviewAgent({
      host,
      prd,
      worktree: "/tmp/worktree",
      diff: "diff",
      changedFiles: "- file",
      implementationSummary: "summary",
      testResults: "passed"
    });

    expect(result.repaired).toBe(true);
    expect(result.review.decision).toBe("approved");
    expect(host.agentSessions).toHaveLength(2);
    expect(host.agentSessions[1].prompt).toContain("malformed");
  });
});
