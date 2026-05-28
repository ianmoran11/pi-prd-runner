import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentSessionSpec } from "../src/core/host.js";
import { DEFAULT_CONFIG, writeConfig } from "../src/core/config.js";
import { readEvents } from "../src/core/events.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { runPrdQueue } from "../src/core/runner.js";
import { loadState } from "../src/core/state.js";
import { git } from "../src/git/git.js";

let repoDir: string;

function approvedReview(): string {
  return JSON.stringify({
    decision: "approved",
    summary: "Approved.",
    acceptanceCriteria: [{ criterion: "The feature works.", status: "passed", evidence: "Implemented." }],
    requiredRevisions: [],
    optionalSuggestions: [],
    risk: "low"
  });
}

function changesReview(): string {
  return JSON.stringify({
    decision: "changes_requested",
    summary: "Still wrong.",
    acceptanceCriteria: [{ criterion: "The feature works.", status: "failed", evidence: "Missing." }],
    requiredRevisions: ["Fix it."],
    optionalSuggestions: [],
    risk: "medium"
  });
}

function validPrd(id: string): string {
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
  await writeConfig(repoDir, { ...DEFAULT_CONFIG, checks: { default: [] } });
}

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-auto-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("auto mode", () => {
  it("processes multiple PRDs serially and auto-merges by default", async () => {
    await setupRepo({ "prd-001.md": validPrd("prd-001"), "prd-002.md": validPrd("prd-002") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) => {
      if (spec.kind === "review") {
        return { ok: true, output: approvedReview() };
      }

      const prd = String(spec.metadata?.prd);
      await writeFile(path.join(spec.cwd, `${prd}.txt`), `${prd}\n`, "utf8");
      await git(["add", `${prd}.txt`], { cwd: spec.cwd });
      await git(["commit", "-m", `implement ${prd}`], { cwd: spec.cwd });
      return { ok: true, output: "implemented" };
    };

    const result = await runPrdQueue(repoDir, host, { mode: "auto" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(result.processed).toEqual(["prd-001", "prd-002"]);
    expect(state.prds["prd-001"].status).toBe("merged");
    expect(state.prds["prd-002"].status).toBe("merged");
    expect(await readFile(path.join(repoDir, "prd-001.txt"), "utf8")).toBe("prd-001\n");
    expect(await readFile(path.join(repoDir, "prd-002.txt"), "utf8")).toBe("prd-002\n");
  });

  it("stops safely when a PRD becomes stuck", async () => {
    await setupRepo({ "prd-001.md": validPrd("prd-001"), "prd-002.md": validPrd("prd-002") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) =>
      spec.kind === "review" ? { ok: true, output: changesReview() } : { ok: true, output: "implemented" };

    const result = await runPrdQueue(repoDir, host, { mode: "auto", maxReviewCycles: 1 });
    const state = await loadState(repoDir);

    expect(result.status).toBe("stuck");
    expect(result.processed).toEqual(["prd-001"]);
    expect(state.prds["prd-001"].status).toBe("stuck");
    expect(state.prds["prd-002"]).toBeUndefined();
  });

  it("uses the default maximum of 5 review cycles", async () => {
    await setupRepo({ "prd-001.md": validPrd("prd-001") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) =>
      spec.kind === "review" ? { ok: true, output: changesReview() } : { ok: true, output: "implemented" };

    const result = await runPrdQueue(repoDir, host, { mode: "auto" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("stuck");
    expect(state.prds["prd-001"].attempt).toBe(5);
    expect(state.prds["prd-001"].maxReviewCycles).toBe(5);
  });

  it("stops safely on invalid PRDs", async () => {
    await setupRepo({
      "prd-001.md": `---
id: prd-001
title: Bad
status: pending
depends_on: []
---

# Bad
`
    });
    const host = new MockHost();

    const result = await runPrdQueue(repoDir, host, { mode: "auto" });
    const events = await readEvents(repoDir);

    expect(result.status).toBe("failed");
    expect(events.map((event) => event.type)).toContain("run.failed");
  });

  it("respects --no-auto-merge", async () => {
    await setupRepo({ "prd-001.md": validPrd("prd-001") });
    const host = new MockHost();
    host.agentSessionHandler = async (spec: AgentSessionSpec) => {
      if (spec.kind === "review") {
        return { ok: true, output: approvedReview() };
      }
      await writeFile(path.join(spec.cwd, "feature.txt"), "feature\n", "utf8");
      await git(["add", "feature.txt"], { cwd: spec.cwd });
      await git(["commit", "-m", "feature"], { cwd: spec.cwd });
      return { ok: true, output: "implemented" };
    };

    const result = await runPrdQueue(repoDir, host, { mode: "auto", noAutoMerge: true });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("approved");
    await expect(readFile(path.join(repoDir, "feature.txt"), "utf8")).rejects.toThrow();
  });
});
