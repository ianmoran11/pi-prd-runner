import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";

export interface GitRunOptions {
  cwd: string;
  timeoutMs?: number;
}

export interface GitResult {
  command: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  ok: boolean;
}

export class GitError extends Error {
  constructor(readonly result: GitResult) {
    super(`Git command failed (${result.command.join(" ")}): ${result.stderr || result.stdout}`);
    this.name = "GitError";
  }
}

export async function runGit(args: string[], options: GitRunOptions): Promise<GitResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        command: ["git", ...args],
        cwd: options.cwd,
        exitCode,
        stdout,
        stderr,
        timedOut,
        ok: exitCode === 0 && !timedOut
      });
    });
  });
}

export async function git(args: string[], options: GitRunOptions): Promise<GitResult> {
  const result = await runGit(args, options);
  if (!result.ok) {
    throw new GitError(result);
  }
  return result;
}

export async function getRepoRoot(cwd: string): Promise<string> {
  const result = await git(["rev-parse", "--show-toplevel"], { cwd });
  return realpath(result.stdout.trim());
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = await git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return result.stdout.trim();
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  const result = await runGit(["rev-parse", "--verify", "--quiet", branch], { cwd });
  return result.ok;
}

export async function getBranchCommit(cwd: string, branch: string): Promise<string> {
  const result = await git(["rev-parse", branch], { cwd });
  return result.stdout.trim();
}

export interface CleanWorkingTreeOptions {
  allowPiGenerated?: boolean;
}

export async function isWorkingTreeClean(cwd: string, options: CleanWorkingTreeOptions = {}): Promise<boolean> {
  const result = await git(["status", "--porcelain"], { cwd });
  const dirtyLines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!options.allowPiGenerated) {
    return dirtyLines.length === 0;
  }

  return dirtyLines.every((line) => {
    const file = line.slice(3);
    return file.startsWith(".pi/prd-runner/");
  });
}
