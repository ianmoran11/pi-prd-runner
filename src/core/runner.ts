import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { PiHost } from "./host.js";
import type { RunnerConfig, RunMode } from "../types/config.js";
import type { ParsedPrd } from "../types/prd.js";
import type { RunnerState } from "../types/state.js";
import type { ReviewResult } from "../types/review.js";
import { runImplementationAgent } from "../agents/implementation-agent.js";
import { runReviewAgent } from "../agents/review-agent.js";
import { checksForPrd, runChecks, writeCheckResults, type CheckRunResult } from "../checks/check-runner.js";
import {
  ensureAttemptDirectory,
  writeAttemptMetadata,
  writeDiffArtifacts,
  writeJsonArtifact,
  writePlaceholderImplementationSummary,
  writePlaceholderReviewReport,
  writeRunSummary,
  writeStuckReport,
  writeTextArtifact
} from "./artifacts.js";
import { defaultInitialState, loadConfigOrDefault } from "./config.js";
import { statePath } from "./config.js";
import { appendEvent } from "./events.js";
import { initProject } from "./init.js";
import { acquireLock } from "./lock.js";
import { loadPrds } from "./prd-parser.js";
import { validatePrds } from "./prd-validator.js";
import { selectNextPrd } from "./scheduler.js";
import { createPrdState, transitionPrd } from "./state-machine.js";
import { loadState, writeState } from "./state.js";
import { ensurePrdBranch } from "../git/branches.js";
import { ensurePrdWorktree } from "../git/worktrees.js";

export interface RunOptions {
  mode?: RunMode;
  from?: string;
  only?: string;
  maxReviewCycles?: number;
  noAutoMerge?: boolean;
  stopAfterApproval?: boolean;
}

export interface RunResult {
  runId: string;
  status: "completed" | "stopped" | "stuck";
  processed: string[];
  stuck: string[];
}

function newRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(filePath: string): Promise<string> {
  return (await exists(filePath)) ? readFile(filePath, "utf8") : "";
}

async function loadOrCreateState(cwd: string, config: RunnerConfig): Promise<RunnerState> {
  try {
    return await loadState(cwd);
  } catch (error) {
    if (await exists(statePath(cwd))) {
      throw error;
    }
    await initProject(cwd);
    return { ...defaultInitialState(config.project.baseBranch), baseBranch: config.project.baseBranch };
  }
}

function ensurePrdState(state: RunnerState, prd: ParsedPrd, maxReviewCycles: number): RunnerState {
  if (state.prds[prd.id]) {
    return state;
  }

  return {
    ...state,
    prds: {
      ...state.prds,
      [prd.id]: createPrdState(prd, maxReviewCycles)
    }
  };
}

function checksByName(result: CheckRunResult): Record<string, string> {
  return Object.fromEntries(result.results.map((check) => [check.name, check.status]));
}

async function updatePrdFields(cwd: string, state: RunnerState, prdId: string, fields: Partial<RunnerState["prds"][string]>): Promise<RunnerState> {
  const now = new Date().toISOString();
  const nextState = {
    ...state,
    prds: {
      ...state.prds,
      [prdId]: {
        ...state.prds[prdId],
        ...fields,
        lastUpdated: now
      }
    },
    currentPrd: prdId,
    lastUpdated: now
  };
  await writeState(cwd, nextState);
  return nextState;
}

async function ensureReady(cwd: string, state: RunnerState, prdId: string, runId: string): Promise<RunnerState> {
  const status = state.prds[prdId].status;
  if (status === "pending") {
    return transitionPrd(cwd, state, prdId, "ready", { runId });
  }
  return state;
}

async function transitionToStuck(
  cwd: string,
  state: RunnerState,
  prd: ParsedPrd,
  runId: string,
  reason: string,
  attempt: number,
  lastFailure: string
): Promise<RunnerState> {
  const paths = await ensureAttemptDirectory(cwd, runId, prd.id, Math.max(attempt, 1));
  await writeStuckReport(paths, prd.id, reason, attempt, lastFailure);
  const next = await transitionPrd(cwd, state, prd.id, "stuck", { runId, message: reason });
  await appendEvent(cwd, { type: "prd.stuck", runId, prd: prd.id, attempt, reason });
  return next;
}

async function processPrd(
  cwd: string,
  host: PiHost,
  config: RunnerConfig,
  state: RunnerState,
  prd: ParsedPrd,
  runId: string,
  options: RunOptions
): Promise<{ state: RunnerState; status: "approved" | "stuck" }> {
  const maxReviewCycles = options.maxReviewCycles ?? prd.maxReviewCycles ?? config.run.maxReviewCycles;
  state = ensurePrdState(state, prd, maxReviewCycles);
  state = await writeState(cwd, state).then(() => state);
  state = await ensureReady(cwd, state, prd.id, runId);

  await appendEvent(cwd, { type: "prd.started", runId, prd: prd.id });

  const branchResult = await ensurePrdBranch(cwd, {
    prdId: prd.id,
    baseBranch: config.project.baseBranch,
    prefix: config.branches.prefix,
    allowExisting: state.prds[prd.id].branch !== null
  });
  const worktreeResult = await ensurePrdWorktree(cwd, { prdId: prd.id, branch: branchResult.branch }, config);
  state = await updatePrdFields(cwd, state, prd.id, {
    branch: branchResult.branch,
    worktree: path.relative(cwd, worktreeResult.path),
    maxReviewCycles
  });
  await appendEvent(cwd, {
    type: worktreeResult.reused ? "worktree.reused" : "worktree.created",
    runId,
    prd: prd.id,
    branch: branchResult.branch,
    worktree: worktreeResult.path
  });

  let lastCheckResult: CheckRunResult | undefined;
  let requiredRevisions: string[] | undefined;

  while (state.prds[prd.id].attempt < maxReviewCycles) {
    const attempt = state.prds[prd.id].attempt + 1;
    const paths = await ensureAttemptDirectory(cwd, runId, prd.id, attempt);
    state = await updatePrdFields(cwd, state, prd.id, { attempt });
    state = await transitionPrd(cwd, state, prd.id, "implementing", { runId });
    await appendEvent(cwd, { type: "implementation.started", runId, prd: prd.id, attempt });

    const implementationResult = await runImplementationAgent({
      host,
      prd,
      attempt,
      branch: branchResult.branch,
      worktree: worktreeResult.path,
      artifactDirectory: paths.attemptDirectory,
      checkResult: lastCheckResult,
      requiredRevisions
    });

    if (!implementationResult.ok) {
      state = await transitionToStuck(cwd, state, prd, runId, implementationResult.error ?? "Implementation failed.", attempt, implementationResult.output);
      return { state, status: "stuck" };
    }

    if (!(await exists(paths.implementationSummary))) {
      await writePlaceholderImplementationSummary(paths, prd);
    }
    await writeDiffArtifacts(worktreeResult.path, paths, config.merge.targetBranch);
    await appendEvent(cwd, { type: "implementation.completed", runId, prd: prd.id, attempt });

    state = await transitionPrd(cwd, state, prd.id, "implemented", { runId });
    state = await transitionPrd(cwd, state, prd.id, "checking", { runId });
    await appendEvent(cwd, { type: "checks.started", runId, prd: prd.id, attempt });

    const checkResult = await runChecks(worktreeResult.path, checksForPrd(config, prd));
    await writeCheckResults(paths, checkResult);
    await writeAttemptMetadata(paths, {
      prd: prd.id,
      attempt,
      branch: branchResult.branch,
      worktree: path.relative(cwd, worktreeResult.path),
      status: "checking",
      checks: checksByName(checkResult),
      reviewDecision: state.prds[prd.id].lastReviewDecision
    });

    if (checkResult.status === "failed") {
      lastCheckResult = checkResult;
      requiredRevisions = [`Fix failed checks: ${checkResult.results.filter((result) => result.status === "failed").map((result) => result.name).join(", ")}`];
      state = await updatePrdFields(cwd, state, prd.id, { lastCheckStatus: "failed" });
      await appendEvent(cwd, { type: "checks.failed", runId, prd: prd.id, attempt, status: "failed" });
      state = await transitionPrd(cwd, state, prd.id, "changes_requested", { runId, message: "Checks failed." });

      if (attempt >= maxReviewCycles) {
        state = await transitionToStuck(cwd, state, prd, runId, "Exceeded maximum review cycles.", attempt, "Checks failed.");
        return { state, status: "stuck" };
      }

      continue;
    }

    lastCheckResult = undefined;
    state = await updatePrdFields(cwd, state, prd.id, { lastCheckStatus: "passed" });
    await appendEvent(cwd, { type: "checks.passed", runId, prd: prd.id, attempt, status: "passed" });
    state = await transitionPrd(cwd, state, prd.id, "reviewing", { runId });
    await appendEvent(cwd, { type: "review.started", runId, prd: prd.id, attempt });

    const review = await runReviewAgent({
      host,
      prd,
      worktree: worktreeResult.path,
      diff: await readIfExists(paths.diffPatch),
      changedFiles: await readIfExists(paths.changedFiles),
      implementationSummary: await readIfExists(paths.implementationSummary),
      testResults: await readIfExists(paths.testResults)
    });
    await writeJsonArtifact(paths.reviewResult, review.review);
    await writeTextArtifact(paths.reviewReport, renderReviewReport(prd.id, review.review));

    state = await updatePrdFields(cwd, state, prd.id, { lastReviewDecision: review.review.decision });
    await appendEvent(cwd, { type: `review.${review.review.decision}` as "review.approved" | "review.changes_requested" | "review.blocked", runId, prd: prd.id, attempt });

    if (review.review.decision === "approved") {
      state = await transitionPrd(cwd, state, prd.id, "approved", { runId });
      return { state, status: "approved" };
    }

    if (review.review.decision === "blocked") {
      state = await transitionToStuck(cwd, state, prd, runId, "Review blocked.", attempt, review.review.summary);
      return { state, status: "stuck" };
    }

    requiredRevisions = review.review.requiredRevisions;
    state = await transitionPrd(cwd, state, prd.id, "changes_requested", { runId, message: "Review requested changes." });
    if (attempt >= maxReviewCycles) {
      state = await transitionToStuck(cwd, state, prd, runId, "Exceeded maximum review cycles.", attempt, review.review.summary);
      return { state, status: "stuck" };
    }
  }

  state = await transitionToStuck(cwd, state, prd, runId, "Exceeded maximum review cycles.", state.prds[prd.id].attempt, "Maximum attempts reached.");
  return { state, status: "stuck" };
}

function renderReviewReport(prdId: string, review: ReviewResult): string {
  return `# Review Report: ${prdId}

## Decision

${review.decision}

## Summary

${review.summary}

## Acceptance criteria

${review.acceptanceCriteria.map((criterion) => `- [${criterion.status === "passed" ? "x" : " "}] ${criterion.criterion} (${criterion.status}) - ${criterion.evidence}`).join("\n")}

## Required revisions

${review.requiredRevisions.length ? review.requiredRevisions.map((revision, index) => `${index + 1}. ${revision}`).join("\n") : "None."}

## Optional suggestions

${review.optionalSuggestions.length ? review.optionalSuggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join("\n") : "None."}

## Risk

${review.risk}
`;
}

export async function runPrdQueue(cwd: string, host: PiHost, options: RunOptions = {}): Promise<RunResult> {
  const config = await loadConfigOrDefault(cwd);
  const lock = await acquireLock(cwd);
  const processed: string[] = [];
  const stuck: string[] = [];

  try {
    let state = await loadOrCreateState(cwd, config);
    const mode = options.mode ?? config.run.defaultMode;
    const runId = state.activeRunId ?? newRunId();
    state = {
      ...state,
      activeRunId: runId,
      mode,
      baseBranch: config.project.baseBranch,
      lastUpdated: new Date().toISOString(),
      stopRequested: false
    };
    await writeState(cwd, state);
    await appendEvent(cwd, { type: "run.started", runId, mode });

    const prds = await loadPrds(cwd, config);
    const validation = validatePrds(prds);
    if (!validation.valid) {
      await appendEvent(cwd, { type: "run.failed", runId, reason: "Invalid PRDs.", metadata: { errors: validation.errors } });
      throw new Error(`Invalid PRDs:\n${validation.errors.map((error) => error.message).join("\n")}`);
    }

    while (true) {
      const selection = selectNextPrd(prds, state, { from: options.from, only: options.only });
      if (!selection.prd) {
        state = { ...state, activeRunId: null, currentPrd: null, lastUpdated: new Date().toISOString() };
        await writeState(cwd, state);
        await appendEvent(cwd, { type: "run.completed", runId });
        await writeRunSummary(cwd, runId, `# Run Summary\n\nStatus: completed\n\nProcessed PRDs: ${processed.join(", ") || "None"}\n`);
        return { runId, status: "completed", processed, stuck };
      }

      const result = await processPrd(cwd, host, config, state, selection.prd, runId, options);
      state = result.state;
      processed.push(selection.prd.id);
      if (result.status === "stuck") {
        stuck.push(selection.prd.id);
        await appendEvent(cwd, { type: "run.stopped", runId, reason: "PRD stuck." });
        await writeRunSummary(cwd, runId, `# Run Summary\n\nStatus: stuck\n\nProcessed PRDs: ${processed.join(", ")}\nStuck PRDs: ${stuck.join(", ")}\n`);
        return { runId, status: "stuck", processed, stuck };
      }

      if (mode === "supervised" || options.only || options.stopAfterApproval) {
        await writeRunSummary(cwd, runId, `# Run Summary\n\nStatus: stopped\n\nProcessed PRDs: ${processed.join(", ")}\n`);
        return { runId, status: "stopped", processed, stuck };
      }
    }
  } finally {
    await lock.release();
  }
}
