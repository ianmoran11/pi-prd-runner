import type { RunnerConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { branchExists, getBranchCommit, git } from "./git.js";

export interface EnsureBranchOptions {
  prdId: string;
  baseBranch?: string;
  prefix?: string;
  allowExisting?: boolean;
}

export interface EnsureBranchResult {
  branch: string;
  created: boolean;
  reused: boolean;
  baseCommit: string;
}

export class BranchConflictError extends Error {
  constructor(readonly branch: string) {
    super(`Branch '${branch}' already exists and cannot be reused safely.`);
    this.name = "BranchConflictError";
  }
}

export function sanitizePrdId(prdId: string): string {
  return prdId
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/^\.|\/|\.$/g, "");
}

export function branchNameForPrd(prdId: string, prefix = DEFAULT_CONFIG.branches.prefix): string {
  const sanitized = sanitizePrdId(prdId);
  if (!sanitized) {
    throw new Error(`Cannot derive a branch name from PRD id '${prdId}'.`);
  }
  return `${prefix}${sanitized}`;
}

export async function ensurePrdBranch(
  cwd: string,
  options: EnsureBranchOptions,
  config: RunnerConfig = DEFAULT_CONFIG
): Promise<EnsureBranchResult> {
  const baseBranch = options.baseBranch ?? config.project.baseBranch;
  const branch = branchNameForPrd(options.prdId, options.prefix ?? config.branches.prefix);
  const baseExists = await branchExists(cwd, baseBranch);
  if (!baseExists) {
    throw new Error(`Base branch '${baseBranch}' does not exist.`);
  }

  const baseCommit = await getBranchCommit(cwd, baseBranch);
  if (await branchExists(cwd, branch)) {
    if (!options.allowExisting) {
      throw new BranchConflictError(branch);
    }

    return {
      branch,
      created: false,
      reused: true,
      baseCommit
    };
  }

  await git(["branch", branch, baseBranch], { cwd });
  return {
    branch,
    created: true,
    reused: false,
    baseCommit
  };
}

