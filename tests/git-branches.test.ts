import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { branchNameForPrd, ensurePrdBranch, BranchConflictError } from "../src/git/branches.js";
import { branchExists, getCurrentBranch, getRepoRoot, isWorkingTreeClean, runGit, git } from "../src/git/git.js";

let repoDir: string;

beforeEach(async () => {
  repoDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-git-"));
  repoDir = await realpath(repoDir);
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await writeFile(path.join(repoDir, "README.md"), "# test\n", "utf8");
  await git(["add", "README.md"], { cwd: repoDir });
  await git(["commit", "-m", "initial"], { cwd: repoDir });
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("git wrapper", () => {
  it("returns structured results", async () => {
    const result = await runGit(["status", "--short"], { cwd: repoDir });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.command).toEqual(["git", "status", "--short"]);
  });

  it("reports repo root, current branch, and clean state", async () => {
    await expect(getRepoRoot(repoDir)).resolves.toBe(repoDir);
    await expect(getCurrentBranch(repoDir)).resolves.toBe("main");
    await expect(isWorkingTreeClean(repoDir)).resolves.toBe(true);

    await mkdir(path.join(repoDir, "src"));
    await writeFile(path.join(repoDir, "src/file.txt"), "dirty\n", "utf8");
    await expect(isWorkingTreeClean(repoDir)).resolves.toBe(false);
  });
});

describe("branch helpers", () => {
  it("generates deterministic branch names", () => {
    expect(branchNameForPrd("prd-001 auth")).toBe("pi/prd-001-auth");
  });

  it("creates a PRD branch from main", async () => {
    const result = await ensurePrdBranch(repoDir, { prdId: "prd-001-auth" });

    expect(result).toMatchObject({
      branch: "pi/prd-001-auth",
      created: true,
      reused: false
    });
    await expect(branchExists(repoDir, "pi/prd-001-auth")).resolves.toBe(true);
  });

  it("reuses an existing branch only when allowed", async () => {
    await ensurePrdBranch(repoDir, { prdId: "prd-001-auth" });
    await expect(ensurePrdBranch(repoDir, { prdId: "prd-001-auth" })).rejects.toBeInstanceOf(BranchConflictError);

    const result = await ensurePrdBranch(repoDir, { prdId: "prd-001-auth", allowExisting: true });
    expect(result.reused).toBe(true);
  });
});
