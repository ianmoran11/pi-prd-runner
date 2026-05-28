import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePrdBranch } from "../src/git/branches.js";
import { getCurrentBranch, git } from "../src/git/git.js";
import { DirtyWorktreeError, ensurePrdWorktree, worktreePathForPrd, WrongBranchWorktreeError } from "../src/git/worktrees.js";

let repoDir: string;

async function commitFile(relativePath: string, content: string, message: string): Promise<void> {
  await writeFile(path.join(repoDir, relativePath), content, "utf8");
  await git(["add", relativePath], { cwd: repoDir });
  await git(["commit", "-m", message], { cwd: repoDir });
}

beforeEach(async () => {
  repoDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-worktree-"));
  await git(["init", "-b", "main"], { cwd: repoDir });
  await git(["config", "user.email", "test@example.com"], { cwd: repoDir });
  await git(["config", "user.name", "Test User"], { cwd: repoDir });
  await commitFile("README.md", "# test\n", "initial");
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("worktree helpers", () => {
  it("creates one worktree per PRD under .pi/prd-runner/worktrees", async () => {
    const branch = await ensurePrdBranch(repoDir, { prdId: "prd-001" });

    const result = await ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch });

    expect(result).toMatchObject({ created: true, reused: false, branch: "pi/prd-001" });
    expect(result.path).toBe(worktreePathForPrd(repoDir, "prd-001"));
    await expect(getCurrentBranch(result.path)).resolves.toBe("pi/prd-001");
  });

  it("reuses a clean worktree on the expected branch", async () => {
    const branch = await ensurePrdBranch(repoDir, { prdId: "prd-001" });
    const first = await ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch });

    const second = await ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch });

    expect(second).toEqual({ ...first, created: false, reused: true });
  });

  it("rejects dirty worktree reuse", async () => {
    const branch = await ensurePrdBranch(repoDir, { prdId: "prd-001" });
    const worktree = await ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch });
    await writeFile(path.join(worktree.path, "dirty.txt"), "dirty\n", "utf8");

    await expect(ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch })).rejects.toBeInstanceOf(
      DirtyWorktreeError
    );
  });

  it("rejects worktree reuse on the wrong branch", async () => {
    const branch = await ensurePrdBranch(repoDir, { prdId: "prd-001" });
    const worktree = await ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch });
    await git(["branch", "wrong-branch", "main"], { cwd: repoDir });
    await git(["checkout", "wrong-branch"], { cwd: worktree.path });

    await expect(ensurePrdWorktree(repoDir, { prdId: "prd-001", branch: branch.branch })).rejects.toBeInstanceOf(
      WrongBranchWorktreeError
    );
  });
});
