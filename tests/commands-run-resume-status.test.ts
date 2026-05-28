import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentSessionSpec } from "../src/core/host.js";
import { parseCommandArgs } from "../src/commands/args.js";
import { parseRunOptions, prdRun } from "../src/commands/prd-run.js";
import { prdResume } from "../src/commands/prd-resume.js";
import { prdStatus } from "../src/commands/prd-status.js";
import { DEFAULT_CONFIG, writeConfig } from "../src/core/config.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
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

function prdMarkdown(id: string): string {
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

async function setupRepo(): Promise<void> {
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await mkdir(path.join(repoDir, "docs/prds"), { recursive: true });
  await writeFile(path.join(repoDir, "docs/prds/prd-001.md"), prdMarkdown("prd-001"), "utf8");
  await git(["add", "docs/prds"], { cwd: repoDir });
  await git(["commit", "-m", "add prd"], { cwd: repoDir });
  await initProject(repoDir);
  await writeConfig(repoDir, { ...DEFAULT_CONFIG, checks: { default: [] } });
}

function hostThatCommits(fileName: string): MockHost {
  const host = new MockHost();
  host.agentSessionHandler = async (spec: AgentSessionSpec) => {
    if (spec.kind === "review") {
      return { ok: true, output: approvedReview() };
    }

    await writeFile(path.join(spec.cwd, fileName), "feature\n", "utf8");
    await git(["add", fileName], { cwd: spec.cwd });
    await git(["commit", "-m", "feature"], { cwd: spec.cwd });
    return { ok: true, output: "implemented" };
  };
  return host;
}

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-commands-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("command argument parsing", () => {
  it("parses flags and positionals", () => {
    expect(parseCommandArgs(["prd-003", "--reason", "because", "--now"])).toEqual({
      flags: { reason: "because", now: true },
      positionals: ["prd-003"]
    });
  });

  it("parses run options", () => {
    expect(parseRunOptions(["--mode", "auto", "--from", "prd-002", "--max-review-cycles", "3", "--no-auto-merge"])).toEqual({
      mode: "auto",
      from: "prd-002",
      only: undefined,
      maxReviewCycles: 3,
      noAutoMerge: true
    });
  });
});

describe("run, resume, and status commands", () => {
  it("/prd-run invokes the core runner", async () => {
    await setupRepo();
    const host = hostThatCommits("run.txt");

    const result = await prdRun({ cwd: repoDir, host }, ["--mode", "auto"]);
    const state = await loadState(repoDir);

    expect(result.ok).toBe(true);
    expect(state.prds["prd-001"].status).toBe("merged");
    expect(host.logs.at(-1)).toContain("processed 1 PRD");
  });

  it("/prd-status reports useful current state", async () => {
    await setupRepo();
    await prdRun({ cwd: repoDir, host: hostThatCommits("status.txt") }, ["--mode", "auto", "--no-auto-merge"]);
    const host = new MockHost();

    const result = await prdStatus({ cwd: repoDir, host }, ["--verbose"]);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Current run ID");
    expect(result.message).toContain("Current stage");
    expect(result.message).toContain("Tracked PRDs");
  });

  it("/prd-resume reports no active run cleanly", async () => {
    await setupRepo();
    const host = new MockHost();

    const result = await prdResume({ cwd: repoDir, host }, []);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("No active PRD run");
  });

  it("/prd-resume can merge an approved PRD after a supervised stop", async () => {
    await setupRepo();
    const firstHost = hostThatCommits("resume.txt");
    firstHost.promptResults.push({ choice: "continue" }, { choice: "continue" }, { choice: "skip" });
    await prdRun({ cwd: repoDir, host: firstHost }, ["--mode", "supervised"]);
    expect((await loadState(repoDir)).prds["prd-001"].status).toBe("approved");

    const resumeHost = new MockHost();
    resumeHost.promptResults.push({ choice: "merge" });
    const result = await prdResume({ cwd: repoDir, host: resumeHost }, ["--mode", "supervised"]);

    expect(result.ok).toBe(true);
    expect((await loadState(repoDir)).prds["prd-001"].status).toBe("merged");
    expect(await readFile(path.join(repoDir, "resume.txt"), "utf8")).toBe("feature\n");
  });
});
