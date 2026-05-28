import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { RunnerState } from "../types/state.js";
import { statePath } from "./config.js";

export class StateCorruptionError extends Error {
  constructor(
    message: string,
    readonly backupPath: string,
    readonly causeError: unknown
  ) {
    super(message);
    this.name = "StateCorruptionError";
  }
}

const prdStateSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  status: z.string(),
  branch: z.string().nullable(),
  worktree: z.string().nullable(),
  attempt: z.number().int().nonnegative(),
  maxReviewCycles: z.number().int().positive(),
  lastReviewDecision: z.enum(["approved", "changes_requested", "blocked"]).nullable(),
  lastCheckStatus: z.enum(["pending", "passed", "failed"]).nullable(),
  mergeCommit: z.string().nullable(),
  startedAt: z.string().nullable(),
  lastUpdated: z.string().nullable()
});

const runnerStateSchema: z.ZodType<RunnerState> = z.object({
  schemaVersion: z.literal(1),
  initialized: z.boolean(),
  activeRunId: z.string().nullable(),
  mode: z.enum(["supervised", "auto"]),
  baseBranch: z.string(),
  currentPrd: z.string().nullable(),
  prds: z.record(prdStateSchema),
  lastUpdated: z.string().nullable(),
  stopRequested: z.boolean().optional()
}) as z.ZodType<RunnerState>;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function migrateState(value: unknown): RunnerState {
  return runnerStateSchema.parse(value);
}

export async function loadState(cwd: string): Promise<RunnerState> {
  const filePath = statePath(cwd);
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
    return migrateState(JSON.parse(raw));
  } catch (error) {
    if (!(await pathExists(filePath))) {
      throw error;
    }

    const backupPath = `${filePath}.corrupt-${Date.now()}.bak`;
    await copyFile(filePath, backupPath);
    throw new StateCorruptionError(`State file is corrupted; preserved backup at ${backupPath}.`, backupPath, error);
  }
}

export async function writeState(cwd: string, state: RunnerState): Promise<void> {
  const filePath = statePath(cwd);
  await mkdir(path.dirname(filePath), { recursive: true });
  const nextState = migrateState(state);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  if (await pathExists(filePath)) {
    await copyFile(filePath, `${filePath}.bak`);
  }

  await rename(tempPath, filePath);
}

export async function listStateBackups(cwd: string): Promise<string[]> {
  const directory = path.dirname(statePath(cwd));
  if (!(await pathExists(directory))) {
    return [];
  }

  const files = await readdir(directory);
  return files.filter((file) => file.startsWith("state.json.") || file === "state.json.bak").sort();
}

export function touchState(state: RunnerState, ts = new Date().toISOString()): RunnerState {
  return { ...state, lastUpdated: ts };
}

