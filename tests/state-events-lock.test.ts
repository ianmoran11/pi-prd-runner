import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, defaultInitialState, eventsPath, metadataPath, statePath } from "../src/core/config.js";
import { appendEvent, readEvents } from "../src/core/events.js";
import { acquireLock, LockConflictError } from "../src/core/lock.js";
import { listStateBackups, loadState, StateCorruptionError, writeState } from "../src/core/state.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-state-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("state persistence", () => {
  it("writes and loads state atomically with a backup", async () => {
    const state = defaultInitialState(DEFAULT_CONFIG.project.baseBranch);
    await writeState(tempDir, state);

    const nextState = { ...state, activeRunId: "run-1", lastUpdated: "2026-05-28T10:00:00.000Z" };
    await writeState(tempDir, nextState);

    await expect(loadState(tempDir)).resolves.toEqual(nextState);
    expect(await readFile(`${statePath(tempDir)}.bak`, "utf8")).toContain('"activeRunId": null');
    await expect(listStateBackups(tempDir)).resolves.toContain("state.json.bak");
  });

  it("preserves corrupted state as a backup and reports a structured error", async () => {
    await mkdir(path.dirname(statePath(tempDir)), { recursive: true });
    await writeFile(statePath(tempDir), "{not json", "utf8");

    await expect(loadState(tempDir)).rejects.toBeInstanceOf(StateCorruptionError);
    const backups = await listStateBackups(tempDir);
    expect(backups.some((backup) => backup.startsWith("state.json.corrupt-"))).toBe(true);
  });
});

describe("events", () => {
  it("appends and filters NDJSON events", async () => {
    await appendEvent(tempDir, { type: "run.started", runId: "run-1", mode: "auto" });
    await appendEvent(tempDir, { type: "prd.started", runId: "run-1", prd: "prd-001" });
    await appendEvent(tempDir, { type: "prd.started", runId: "run-2", prd: "prd-002" });

    const raw = await readFile(eventsPath(tempDir), "utf8");
    expect(raw.trim().split(/\r?\n/)).toHaveLength(3);
    await expect(readEvents(tempDir, { runId: "run-1" })).resolves.toHaveLength(2);
    await expect(readEvents(tempDir, { prd: "prd-001" })).resolves.toHaveLength(1);
  });
});

describe("lock", () => {
  it("prevents concurrent lock acquisition and releases cleanly", async () => {
    const lock = await acquireLock(tempDir);

    await expect(acquireLock(tempDir)).rejects.toBeInstanceOf(LockConflictError);
    await lock.release();
    await expect(acquireLock(tempDir)).resolves.toMatchObject({ staleLockReplaced: false });
  });

  it("replaces stale locks", async () => {
    const stale = {
      pid: 999999,
      acquiredAt: new Date(Date.now() - 10_000).toISOString(),
      token: "stale"
    };
    await mkdir(path.dirname(metadataPath(tempDir, "lock")), { recursive: true });
    await writeFile(metadataPath(tempDir, "lock"), `${JSON.stringify(stale)}\n`, "utf8");

    const lock = await acquireLock(tempDir, { staleMs: 1 });

    expect(lock.staleLockReplaced).toBe(true);
    await lock.release();
  });
});
