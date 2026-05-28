import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, writeConfig } from "../src/core/config.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { runPrdQueue } from "../src/core/runner.js";
import { promptSupervisedControl } from "../src/core/supervised.js";
import { loadState } from "../src/core/state.js";
import { git } from "../src/git/git.js";

let repoDir: string;

const prdText = `---
id: prd-001
title: prd-001
status: pending
depends_on: []
---

# prd-001

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

beforeEach(async () => {
  repoDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-supervised-"));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

async function setupRepo(): Promise<void> {
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await mkdir(path.join(repoDir, "docs/prds"), { recursive: true });
  await writeFile(path.join(repoDir, "docs/prds/prd-001.md"), prdText, "utf8");
  await git(["add", "docs/prds"], { cwd: repoDir });
  await git(["commit", "-m", "add prd"], { cwd: repoDir });
  await initProject(repoDir);
  await writeConfig(repoDir, { ...DEFAULT_CONFIG, checks: { default: [] } });
}

describe("supervised controls", () => {
  it("views diff and report through the host abstraction", async () => {
    const host = new MockHost();
    host.promptResults.push({ choice: "diff" }, { choice: "report" });

    await expect(promptSupervisedControl(host, { gate: "after_implementation", prdId: "prd-001", diff: "diff text" })).resolves.toBe(
      "continue"
    );
    await expect(promptSupervisedControl(host, { gate: "after_implementation", prdId: "prd-001", report: "report text" })).resolves.toBe(
      "continue"
    );

    expect(host.logs).toEqual(["diff text", "report text"]);
  });

  it("can skip a PRD at the supervised before-PRD gate", async () => {
    await setupRepo();
    const host = new MockHost();
    host.promptResults.push({ choice: "skip" });

    const result = await runPrdQueue(repoDir, host, { mode: "supervised" });
    const state = await loadState(repoDir);

    expect(result.status).toBe("stopped");
    expect(state.prds["prd-001"].status).toBe("skipped");
    expect(host.agentSessions).toHaveLength(0);
  });
});
