import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttemptArtifactPaths, AttemptMetadata } from "../types/artifact.js";
import type { ParsedPrd } from "../types/prd.js";
import { metadataPath } from "./config.js";
import { getDiffSummary } from "../git/diff.js";

function attemptName(attempt: number): string {
  return `attempt-${String(attempt).padStart(3, "0")}`;
}

export function runDirectory(cwd: string, runId: string): string {
  return metadataPath(cwd, "runs", runId);
}

export function prdRunDirectory(cwd: string, runId: string, prdId: string): string {
  return path.join(runDirectory(cwd, runId), prdId);
}

export function attemptDirectory(cwd: string, runId: string, prdId: string, attempt: number): string {
  return path.join(prdRunDirectory(cwd, runId, prdId), attemptName(attempt));
}

export function attemptArtifactPaths(cwd: string, runId: string, prdId: string, attempt: number): AttemptArtifactPaths {
  const runDir = runDirectory(cwd, runId);
  const prdDir = prdRunDirectory(cwd, runId, prdId);
  const attemptDir = attemptDirectory(cwd, runId, prdId, attempt);
  return {
    runDirectory: runDir,
    prdDirectory: prdDir,
    attemptDirectory: attemptDir,
    implementationSummary: path.join(attemptDir, "implementation-summary.md"),
    reviewReport: path.join(attemptDir, "review-report.md"),
    reviewResult: path.join(attemptDir, "review-result.json"),
    testResults: path.join(attemptDir, "test-results.md"),
    changedFiles: path.join(attemptDir, "changed-files.md"),
    diffPatch: path.join(attemptDir, "diff.patch"),
    metadata: path.join(attemptDir, "metadata.json"),
    stuckReport: path.join(attemptDir, "stuck-report.md")
  };
}

export async function ensureAttemptDirectory(cwd: string, runId: string, prdId: string, attempt: number): Promise<AttemptArtifactPaths> {
  const paths = attemptArtifactPaths(cwd, runId, prdId, attempt);
  await mkdir(paths.attemptDirectory, { recursive: true });
  return paths;
}

export async function writeTextArtifact(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function writeJsonArtifact(filePath: string, value: unknown): Promise<void> {
  await writeTextArtifact(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writePlaceholderImplementationSummary(paths: AttemptArtifactPaths, prd: ParsedPrd): Promise<void> {
  await writeTextArtifact(
    paths.implementationSummary,
    `# Implementation Summary: ${prd.id}\n\n## Status\n\nPending implementation summary.\n\n## Known limitations\n\nNot yet provided.\n`
  );
}

export async function writePlaceholderReviewReport(paths: AttemptArtifactPaths, prd: ParsedPrd): Promise<void> {
  await writeTextArtifact(paths.reviewReport, `# Review Report: ${prd.id}\n\n## Decision\n\nPending review.\n`);
}

export async function writeStuckReport(paths: AttemptArtifactPaths, prdId: string, reason: string, attempts: number, lastFailure = ""): Promise<void> {
  await writeTextArtifact(
    paths.stuckReport,
    `# Stuck Report: ${prdId}\n\n## Reason\n\n${reason}\n\n## Attempts\n\n${attempts}\n\n## Last failure\n\n${lastFailure || "Unknown."}\n\n## Suggested next action\n\nInspect the latest artifacts and resume manually.\n`
  );
}

export async function writeDiffArtifacts(worktreePath: string, paths: AttemptArtifactPaths, base = "main"): Promise<void> {
  const summary = await getDiffSummary(worktreePath, base);
  await writeTextArtifact(paths.diffPatch, summary.diff);
  await writeTextArtifact(
    paths.changedFiles,
    [`# Changed Files`, "", ...summary.changedFiles.map((file) => `- \`${file}\``), ""].join("\n")
  );
}

export async function writeAttemptMetadata(paths: AttemptArtifactPaths, metadata: AttemptMetadata): Promise<void> {
  await writeJsonArtifact(paths.metadata, metadata);
}

export async function writeRunSummary(cwd: string, runId: string, content: string): Promise<void> {
  await writeTextArtifact(path.join(runDirectory(cwd, runId), "run-summary.md"), content);
}
