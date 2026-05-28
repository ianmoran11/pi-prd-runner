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
import { MergeConflictError, squashMerge } from "../src/git/merge.js";

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

function prdMarkdown(id: string): string {
  return `---
id: ${id}
title: ${id} title
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

async function initGitRepo(): Promise<void> {
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
}

async function commitFile(relativePath: string, content: string, message: string, cwd = repoDir): Promise<void> {
  await mkdir(path.dirname(path.join(cwd, relativePath)), { recursive: true });
  await writeFile(path.join(cwd, relativePath), content, "utf8");
  await git(["add", relativePath], { cwd });
  await git(["commit", "-m", message], { cwd });
}

async function setupRunnerRepo(): Promise<void> {
  await initGitRepo();
  await mkdir(path.join(repoDir, "docs/prds"), { recursive: true });
  await writeFile(path.join(repoDir, "docs/prds/prd-001.md"), prdMarkdown("prd-001"), "utf8");
  await git(["add", "docs/prds"], { cwd: repoDir });
  await git(["commit", "-m", "add prd"], { cwd: repoDir });
  await initProject(repoDir);
  await writeConfig(repoDir, { ...DEFAULT_CONFIG, checks: { default: [] } });
}

function committingHost(fileName: string): MockHost {
  const host = new MockHost();
  host.agentSessionHandler = async (spec: AgentSessionSpec) => {
    if (spec.kind === "review") {
      return { ok: true, output: approvedReview() };
    }

    await commitFile(fileName, "feature\n", "implement feature", spec.cwd);
    return { ok: true, output: "implemented" };
  };
  return host;
}

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-merge-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("squash merge", () => {
  it("squash merges a branch into main and records the commit", async () => {
    await initGitRepo();
    await commitFile("README.md", "base\n", "initial");
    await git(["checkout", "-b", "pi/prd-001"], { cwd: repoDir });
    await commitFile("feature.txt", "feature\n", "feature");
    await git(["checkout", "main"], { cwd: repoDir });

    const result = await squashMerge(repoDir, { branch: "pi/prd-001", targetBranch: "main", message: "PRD feature" });

    expect(result.commit).toMatch(/[a-f0-9]{40}/);
    expect(await readFile(path.join(repoDir, "feature.txt"), "utf8")).toBe("feature\n");
    const log = await git(["log", "-1", "--pretty=%s"], { cwd: repoDir });
    expect(log.stdout.trim()).toBe("PRD feature");
  });

  it("detects merge conflicts and aborts when possible", async () => {
    await initGitRepo();
    await commitFile("conflict.txt", "base\n", "initial");
    await git(["checkout", "-b", "pi/prd-001"], { cwd: repoDir });
    await commitFile("conflict.txt", "branch\n", "branch change");
    await git(["checkout", "main"], { cwd: repoDir });
    await commitFile("conflict.txt", "main\n", "main change");

    await expect(squashMerge(repoDir, { branch: "pi/prd-001", targetBranch: "main", message: "conflict" })).rejects.toBeInstanceOf(
      MergeConflictError
    );
  });
});

describe("runner merge behavior", () => {
  it("auto mode merges approved PRDs into main by default", async () => {
    await setupRunnerRepo();
    const host = committingHost("feature.txt");

    const result = await runPrdQueue(repoDir, host, { mode: "auto" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("merged");
    expect(state.prds["prd-001"].mergeCommit).toMatch(/[a-f0-9]{40}/);
    expect(await readFile(path.join(repoDir, "feature.txt"), "utf8")).toBe("feature\n");
  });

  it("supervised mode prompts before merging", async () => {
    await setupRunnerRepo();
    const host = committingHost("supervised.txt");
    host.promptResults.push({ choice: "merge" });

    const result = await runPrdQueue(repoDir, host, { mode: "supervised" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("stopped");
    expect(host.prompts[0].message).toContain("approved");
    expect(state.prds["prd-001"].status).toBe("merged");
    expect(await readFile(path.join(repoDir, "supervised.txt"), "utf8")).toBe("feature\n");
  });

  it("--no-auto-merge leaves approved PRDs unmerged in auto mode", async () => {
    await setupRunnerRepo();
    const host = committingHost("unmerged.txt");

    const result = await runPrdQueue(repoDir, host, { mode: "auto", noAutoMerge: true });
    const state = await loadState(repoDir);

    expect(result.status).toBe("completed");
    expect(state.prds["prd-001"].status).toBe("approved");
    await expect(readFile(path.join(repoDir, "unmerged.txt"), "utf8")).rejects.toThrow();
  });
});
