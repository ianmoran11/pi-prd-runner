import type { ParsedPrd } from "../types/prd.js";
import { git, isWorkingTreeClean, runGit } from "./git.js";

export interface SquashMergeOptions {
  branch: string;
  targetBranch: string;
  message: string;
  requireCleanWorkingTree?: boolean;
}

export interface MergeResult {
  targetBranch: string;
  branch: string;
  commit: string;
  message: string;
}

export class MergeConflictError extends Error {
  constructor(
    readonly branch: string,
    readonly targetBranch: string,
    readonly stderr: string
  ) {
    super(`Merge conflict while merging '${branch}' into '${targetBranch}'.`);
    this.name = "MergeConflictError";
  }
}

export function mergeCommitMessage(prd: ParsedPrd): string {
  return prd.title ?? prd.id;
}

async function abortMerge(cwd: string): Promise<void> {
  const abort = await runGit(["merge", "--abort"], { cwd });
  if (!abort.ok) {
    await runGit(["reset", "--merge"], { cwd });
  }
}

export async function squashMerge(cwd: string, options: SquashMergeOptions): Promise<MergeResult> {
  if (options.requireCleanWorkingTree ?? true) {
    const clean = await isWorkingTreeClean(cwd, { allowPiGenerated: true });
    if (!clean) {
      throw new Error("Cannot merge with a dirty working tree.");
    }
  }

  await git(["checkout", options.targetBranch], { cwd });
  const merge = await runGit(["merge", "--squash", options.branch], { cwd });
  if (!merge.ok) {
    await abortMerge(cwd);
    throw new MergeConflictError(options.branch, options.targetBranch, merge.stderr || merge.stdout);
  }

  await git(["commit", "-m", options.message], { cwd });
  const commit = await git(["rev-parse", "HEAD"], { cwd });
  return {
    targetBranch: options.targetBranch,
    branch: options.branch,
    commit: commit.stdout.trim(),
    message: options.message
  };
}

