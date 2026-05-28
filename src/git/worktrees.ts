import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import type { RunnerConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { sanitizePrdId } from "./branches.js";
import { getCurrentBranch, git, isWorkingTreeClean } from "./git.js";

export interface EnsureWorktreeOptions {
  prdId: string;
  branch: string;
  path?: string;
}

export interface WorktreeResult {
  path: string;
  branch: string;
  created: boolean;
  reused: boolean;
}

export class DirtyWorktreeError extends Error {
  constructor(readonly worktreePath: string) {
    super(`Worktree '${worktreePath}' has uncommitted changes.`);
    this.name = "DirtyWorktreeError";
  }
}

export class WrongBranchWorktreeError extends Error {
  constructor(
    readonly worktreePath: string,
    readonly expectedBranch: string,
    readonly actualBranch: string
  ) {
    super(`Worktree '${worktreePath}' is on '${actualBranch}', expected '${expectedBranch}'.`);
    this.name = "WrongBranchWorktreeError";
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function worktreePathForPrd(cwd: string, prdId: string, config: RunnerConfig = DEFAULT_CONFIG): string {
  return path.join(cwd, config.worktrees.directory, sanitizePrdId(prdId));
}

export async function worktreeExists(worktreePath: string): Promise<boolean> {
  return exists(path.join(worktreePath, ".git"));
}

export async function assertReusableWorktree(worktreePath: string, expectedBranch: string): Promise<void> {
  const actualBranch = await getCurrentBranch(worktreePath);
  if (actualBranch !== expectedBranch) {
    throw new WrongBranchWorktreeError(worktreePath, expectedBranch, actualBranch);
  }

  if (!(await isWorkingTreeClean(worktreePath))) {
    throw new DirtyWorktreeError(worktreePath);
  }
}

export async function ensurePrdWorktree(
  cwd: string,
  options: EnsureWorktreeOptions,
  config: RunnerConfig = DEFAULT_CONFIG
): Promise<WorktreeResult> {
  const targetPath = options.path ?? worktreePathForPrd(cwd, options.prdId, config);

  if (await worktreeExists(targetPath)) {
    await assertReusableWorktree(targetPath, options.branch);
    return {
      path: targetPath,
      branch: options.branch,
      created: false,
      reused: true
    };
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await git(["worktree", "add", targetPath, options.branch], { cwd });
  return {
    path: targetPath,
    branch: options.branch,
    created: true,
    reused: false
  };
}

export async function removeWorktree(cwd: string, worktreePath: string, force = false): Promise<void> {
  await git(["worktree", "remove", ...(force ? ["--force"] : []), worktreePath], { cwd });
}

