import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prdMarkStuck } from "../src/commands/prd-mark-stuck.js";
import { prdRetry } from "../src/commands/prd-retry.js";
import { prdSkip } from "../src/commands/prd-skip.js";
import { prdStop } from "../src/commands/prd-stop.js";
import { defaultInitialState } from "../src/core/config.js";
import { readEvents } from "../src/core/events.js";
import { MockHost } from "../src/core/host.js";
import { initProject } from "../src/core/init.js";
import { loadState, writeState } from "../src/core/state.js";
import type { PrdState } from "../src/types/state.js";

let tempDir: string;

function prdState(overrides: Partial<PrdState> = {}): PrdState {
  return {
    id: "prd-001",
    path: "docs/prds/prd-001.md",
    title: "PRD 001",
    status: "reviewing",
    branch: "pi/prd-001",
    worktree: ".pi/prd-runner/worktrees/prd-001",
    attempt: 1,
    maxReviewCycles: 5,
    lastReviewDecision: "changes_requested",
    lastCheckStatus: "passed",
    mergeCommit: null,
    startedAt: null,
    lastUpdated: null,
    ...overrides
  };
}

async function setupState(): Promise<void> {
  await initProject(tempDir);
  const state = defaultInitialState();
  state.activeRunId = "run-1";
  state.currentPrd = "prd-001";
  state.prds["prd-001"] = prdState();
  await writeState(tempDir, state);
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-control-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("control commands", () => {
  it("/prd-stop requests a safe stop and appends an event", async () => {
    await setupState();
    const result = await prdStop({ cwd: tempDir, host: new MockHost() }, []);
    const state = await loadState(tempDir);

    expect(result.ok).toBe(true);
    expect(state.stopRequested).toBe(true);
    expect((await readEvents(tempDir)).map((event) => event.type)).toContain("run.stopped");
  });

  it("/prd-retry retries the current PRD and increments attempt", async () => {
    await setupState();
    const result = await prdRetry({ cwd: tempDir, host: new MockHost() }, ["--reason", "try again"]);

    expect(result.ok).toBe(true);
    const state = await loadState(tempDir);
    expect(state.prds["prd-001"].attempt).toBe(2);
    expect(state.prds["prd-001"].status).toBe("changes_requested");
  });

  it("/prd-skip marks a PRD skipped", async () => {
    await setupState();
    await prdSkip({ cwd: tempDir, host: new MockHost() }, ["prd-001", "--reason", "out of scope"]);
    const state = await loadState(tempDir);

    expect(state.prds["prd-001"].status).toBe("skipped");
    expect((await readEvents(tempDir)).map((event) => event.type)).toContain("prd.skipped");
  });

  it("/prd-mark-stuck marks a PRD stuck and writes a stuck report", async () => {
    await setupState();
    await prdMarkStuck({ cwd: tempDir, host: new MockHost() }, ["prd-001", "--reason", "blocked"]);
    const state = await loadState(tempDir);
    const report = await readFile(path.join(tempDir, ".pi/prd-runner/runs/run-1/prd-001/attempt-001/stuck-report.md"), "utf8");

    expect(state.prds["prd-001"].status).toBe("stuck");
    expect(report).toContain("blocked");
    expect((await readEvents(tempDir)).map((event) => event.type)).toContain("prd.stuck");
  });
});
