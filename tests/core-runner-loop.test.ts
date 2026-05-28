import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentSessionSpec } from "../src/core/host.js";
import { DEFAULT_CONFIG, writeConfig } from "../src/core/config.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { runPrdQueue } from "../src/core/runner.js";
import { loadState } from "../src/core/state.js";
import { git } from "../src/git/git.js";

let repoDir: string;

function reviewOutput(decision: "approved" | "changes_requested" | "blocked", revisions: string[] = []): string {
  return JSON.stringify({
    decision,
    summary: `${decision} summary`,
    acceptanceCriteria: [{ criterion: "The feature works.", status: decision === "approved" ? "passed" : "failed", evidence: "Observed in test." }],
    requiredRevisions: revisions,
    optionalSuggestions: [],
    risk: decision === "approved" ? "low" : "medium"
  });
}

function prdMarkdown(id: string, check = ""): string {
  const checks = check
    ? `## Required checks

\`\`\`bash
${check}
\`\`\`
`
    : "";

  return `---
id: ${id}
title: ${id}
status: pending
depends_on: []
---

# ${id}

## Goal

Deliver the feature.

## Scope

Included:
- One scoped feature.

Excluded:
- Future work.

## Acceptance criteria

- [ ] The feature works.

${checks}
## Reviewer checklist

- The implementation stays in scope.
`;
}

async function setupRepo(prds: Record<string, string>): Promise<void> {
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await mkdir(path.join(repoDir, "docs/prds"), { recursive: true });
  for (const [file, content] of Object.entries(prds)) {
    await writeFile(path.join(repoDir, "docs/prds", file), content, "utf8");
  }
  await git(["add", "docs/prds"], { cwd: repoDir });
  await git(["commit", "-m", "add prds"], { cwd: repoDir });
  await initProject(repoDir);
  await writeConfig(repoDir, {
    ...DEFAULT_CONFIG,
    checks: { default: [] }
  });
}

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-loop-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("core runner loop", () => {
  it("moves one PRD through implementation, checks, review, and approval", async () => {
    await setupRepo({ "prd-001.md": prdMarkdown("prd-001") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) =>
      spec.kind === "review" ? { ok: true, output: reviewOutput("approved") } : { ok: true, output: "implemented" };

    const result = await runPrdQueue(repoDir, host, { mode: "auto" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("approved");
    expect(state.prds["prd-001"].attempt).toBe(1);
    expect(host.agentSessions.map((session) => session.kind)).toEqual(["implementation", "review"]);
  });

  it("immediately revises after failed checks and then approves", async () => {
    await setupRepo({ "prd-001.md": prdMarkdown("prd-001", "node check.js") });
    const host = new MockHost();
    let implementationCount = 0;
    host.agentSessionHandler = async (spec: AgentSessionSpec) => {
      if (spec.kind === "review") {
        return { ok: true, output: reviewOutput("approved") };
      }

      implementationCount += 1;
      await writeFile(path.join(spec.cwd, "check.js"), implementationCount === 1 ? "process.exit(1)\n" : "process.exit(0)\n", "utf8");
      return { ok: true, output: "implemented" };
    };

    const result = await runPrdQueue(repoDir, host, { mode: "auto", maxReviewCycles: 3 });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("approved");
    expect(state.prds["prd-001"].attempt).toBe(2);
    expect(host.agentSessions.map((session) => session.kind)).toEqual(["implementation", "revision", "review"]);
  });

  it("immediately revises after review changes and then approves", async () => {
    await setupRepo({ "prd-001.md": prdMarkdown("prd-001") });
    const host = new MockHost();
    const reviews = [reviewOutput("changes_requested", ["Fix the behavior."]), reviewOutput("approved")];
    host.agentSessionHandler = async (spec: AgentSessionSpec) =>
      spec.kind === "review" ? { ok: true, output: reviews.shift() ?? reviewOutput("approved") } : { ok: true, output: "implemented" };

    const result = await runPrdQueue(repoDir, host, { mode: "auto", maxReviewCycles: 3 });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("approved");
    expect(state.prds["prd-001"].attempt).toBe(2);
  });

  it("marks a PRD stuck after max attempts", async () => {
    await setupRepo({ "prd-001.md": prdMarkdown("prd-001") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) =>
      spec.kind === "review" ? { ok: true, output: reviewOutput("changes_requested", ["Still broken."]) } : { ok: true, output: "implemented" };

    const result = await runPrdQueue(repoDir, host, { mode: "auto", maxReviewCycles: 2 });
    const state = await loadState(repoDir);
    const runSummary = await readFile(path.join(repoDir, ".pi/prd-runner/runs", result.runId, "run-summary.md"), "utf8");

    expect(result.status).toBe("stuck");
    expect(result.stuck).toEqual(["prd-001"]);
    expect(state.prds["prd-001"].status).toBe("stuck");
    expect(state.prds["prd-001"].attempt).toBe(2);
    expect(runSummary).toContain("Status: stuck");
  });
});
