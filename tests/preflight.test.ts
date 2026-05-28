import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, writeConfig } from "../src/core/config.js";
import { readEvents } from "../src/core/events.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { runPrdQueue } from "../src/core/runner.js";
import { git } from "../src/git/git.js";

let repoDir: string;

const prd = `---
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
  repoDir = await realpath(await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-preflight-")));
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await mkdir(path.join(repoDir, "docs/prds"), { recursive: true });
  await writeFile(path.join(repoDir, "docs/prds/prd-001.md"), prd, "utf8");
  await git(["add", "docs/prds"], { cwd: repoDir });
  await git(["commit", "-m", "add prd"], { cwd: repoDir });
  await initProject(repoDir);
  await writeConfig(repoDir, { ...DEFAULT_CONFIG, checks: { default: [] } });
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("runner preflight", () => {
  it("stops auto mode on a dirty non-generated working tree", async () => {
    await writeFile(path.join(repoDir, "dirty.txt"), "dirty\n", "utf8");

    const result = await runPrdQueue(repoDir, new MockHost(), { mode: "auto" });
    const events = await readEvents(repoDir);

    expect(result.status).toBe("failed");
    expect(events.map((event) => event.type)).toContain("run.failed");
    expect(events.at(-1)?.reason).toBe("Dirty working tree.");
  });
});
