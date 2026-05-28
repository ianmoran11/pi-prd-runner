import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prdDashboard } from "../src/commands/prd-dashboard.js";
import { defaultInitialState } from "../src/core/config.js";
import { appendEvent } from "../src/core/events.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { parsePrd } from "../src/core/prd-parser.js";
import { buildDashboardModel } from "../src/dashboard/dashboard-model.js";
import { renderDashboard } from "../src/dashboard/dashboard-renderer.js";

let tempDir: string;

const prdText = `---
id: prd-001
title: First PRD
status: pending
depends_on: []
---

# First PRD

## Goal

Deliver it.

## Scope

Included:
- One item.

Excluded:
- Future work.

## Acceptance criteria

- [ ] It works.
`;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-dashboard-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("dashboard model and renderer", () => {
  it("shows queue, stage, attempts, checks, review decision, and controls", () => {
    const prd = parsePrd(prdText, path.join(tempDir, "docs/prds/prd-001.md"), tempDir);
    const state = defaultInitialState();
    state.activeRunId = "run-1";
    state.currentPrd = "prd-001";
    state.prds["prd-001"] = {
      id: "prd-001",
      path: "docs/prds/prd-001.md",
      title: "First PRD",
      status: "reviewing",
      branch: "pi/prd-001",
      worktree: ".pi/prd-runner/worktrees/prd-001",
      attempt: 2,
      maxReviewCycles: 5,
      lastReviewDecision: "changes_requested",
      lastCheckStatus: "passed",
      mergeCommit: null,
      startedAt: null,
      lastUpdated: null
    };

    const model = buildDashboardModel(state, [prd], [{ ts: "now", type: "review.changes_requested", prd: "prd-001", message: "Need tests." }]);
    const rendered = renderDashboard(model, { verbose: true });

    expect(model.queue[0]).toMatchObject({ id: "prd-001", current: true });
    expect(rendered).toContain("PRD Queue");
    expect(rendered).toContain("Current Stage");
    expect(rendered).toContain("attempt: 2/5");
    expect(rendered).toContain("Checks: passed");
    expect(rendered).toContain("Review: changes_requested");
    expect(rendered).toContain("Controls:");
  });
});

describe("/prd-dashboard", () => {
  it("renders idle status without an active run", async () => {
    await initProject(tempDir);
    await mkdir(path.join(tempDir, "docs/prds"), { recursive: true });
    await writeFile(path.join(tempDir, "docs/prds/prd-001.md"), prdText, "utf8");
    await appendEvent(tempDir, { type: "run.completed", runId: "run-1" });
    const host = new MockHost();

    const result = await prdDashboard({ cwd: tempDir, host }, ["--compact"]);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("run: idle");
    expect(host.dashboards).toHaveLength(1);
  });
});
