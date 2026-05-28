import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptArtifactPaths, ensureAttemptDirectory, writeAttemptMetadata, writeDiffArtifacts } from "../src/core/artifacts.js";
import { getDiffSummary } from "../src/git/diff.js";
import { git } from "../src/git/git.js";
import { runChecks, writeCheckResults } from "../src/checks/check-runner.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-artifacts-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function initRepo(): Promise<void> {
  await git(["init", "-b", "main"], { cwd: tempDir });
  await git(["config", "user.email", "test@example.com"], { cwd: tempDir });
  await git(["config", "user.name", "Test User"], { cwd: tempDir });
  await writeFile(path.join(tempDir, "README.md"), "before\n", "utf8");
  await git(["add", "README.md"], { cwd: tempDir });
  await git(["commit", "-m", "initial"], { cwd: tempDir });
  await git(["checkout", "-b", "pi/prd-001"], { cwd: tempDir });
}

describe("diff and artifacts", () => {
  it("generates attempt artifact paths", () => {
    const paths = attemptArtifactPaths(tempDir, "run-1", "prd-001", 2);

    expect(paths.attemptDirectory).toBe(path.join(tempDir, ".pi/prd-runner/runs/run-1/prd-001/attempt-002"));
    expect(paths.diffPatch).toMatch(/diff\.patch$/);
  });

  it("writes diff, changed files, and metadata artifacts", async () => {
    await initRepo();
    await writeFile(path.join(tempDir, "README.md"), "after\n", "utf8");
    const paths = await ensureAttemptDirectory(tempDir, "run-1", "prd-001", 1);

    await writeDiffArtifacts(tempDir, paths, "main");
    await writeAttemptMetadata(paths, {
      prd: "prd-001",
      attempt: 1,
      branch: "pi/prd-001",
      worktree: tempDir,
      status: "checking"
    });

    expect(await readFile(paths.diffPatch, "utf8")).toContain("-before");
    expect(await readFile(paths.changedFiles, "utf8")).toContain("README.md");
    expect(JSON.parse(await readFile(paths.metadata, "utf8"))).toMatchObject({ prd: "prd-001", attempt: 1 });

    const summary = await getDiffSummary(tempDir, "main");
    expect(summary.changedFiles).toEqual(["README.md"]);
  });
});

describe("check runner", () => {
  it("runs passing and failing checks with structured results", async () => {
    await mkdir(tempDir, { recursive: true });
    const result = await runChecks(
      tempDir,
      [
        { name: "pass", command: "node -e \"console.log('ok')\"" },
        { name: "fail", command: "node -e \"console.error('bad'); process.exit(2)\"" }
      ],
      { timeoutMs: 5_000 }
    );

    expect(result.status).toBe("failed");
    expect(result.results.map((check) => check.status)).toEqual(["passed", "failed"]);
    expect(result.results[0].stdout).toContain("ok");
    expect(result.results[1].stderr).toContain("bad");
  });

  it("writes check output artifacts", async () => {
    const paths = await ensureAttemptDirectory(tempDir, "run-1", "prd-001", 1);
    const result = await runChecks(tempDir, [{ name: "pass", command: "node -e \"console.log('ok')\"" }]);

    await writeCheckResults(paths, result);

    expect(await readFile(paths.testResults, "utf8")).toContain("Overall: passed");
  });
});
