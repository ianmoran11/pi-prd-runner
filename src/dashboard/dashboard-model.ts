import type { RunnerEvent } from "../types/event.js";
import type { ParsedPrd } from "../types/prd.js";
import type { PrdState, RunnerState } from "../types/state.js";

export interface DashboardQueueItem {
  id: string;
  title: string;
  status: string;
  current: boolean;
}

export interface DashboardStageItem {
  name: string;
  status: "done" | "current" | "pending";
}

export interface RunnerDashboardModel {
  title: string;
  mode: string;
  runId: string | null;
  baseBranch: string;
  currentPrd: PrdState | null;
  queue: DashboardQueueItem[];
  stages: DashboardStageItem[];
  latestFinding: string;
  checks: string;
  reviewDecision: string;
  controls: string[];
}

function stageStatus(current: string | undefined, stage: string): DashboardStageItem["status"] {
  const order = ["ready", "implementing", "checking", "reviewing", "merging", "merged"];
  const normalizedCurrent = current === "implemented" ? "checking" : current;
  const currentIndex = order.indexOf(normalizedCurrent ?? "ready");
  const stageIndex = order.indexOf(stage);
  if (currentIndex === stageIndex) {
    return "current";
  }
  if (currentIndex > stageIndex || normalizedCurrent === "approved") {
    return "done";
  }
  return "pending";
}

function latestFinding(events: RunnerEvent[]): string {
  const event = [...events].reverse().find((candidate) => candidate.message || candidate.reason || candidate.type.startsWith("review."));
  if (!event) {
    return "No findings yet.";
  }
  return event.message ?? event.reason ?? event.type;
}

export function buildDashboardModel(state: RunnerState, prds: ParsedPrd[], events: RunnerEvent[] = []): RunnerDashboardModel {
  const currentPrd = state.currentPrd ? state.prds[state.currentPrd] ?? null : null;
  const queue = prds.map((prd) => ({
    id: prd.id,
    title: prd.title ?? prd.id,
    status: state.prds[prd.id]?.status ?? prd.status ?? "pending",
    current: prd.id === state.currentPrd
  }));

  const currentStatus = currentPrd?.status;
  return {
    title: "pi-prd-runner",
    mode: state.mode,
    runId: state.activeRunId,
    baseBranch: state.baseBranch,
    currentPrd,
    queue,
    stages: [
      { name: "Preflight", status: stageStatus(currentStatus, "ready") },
      { name: "Implementation", status: stageStatus(currentStatus, "implementing") },
      { name: "Checks", status: stageStatus(currentStatus, "checking") },
      { name: "Review", status: stageStatus(currentStatus, "reviewing") },
      { name: "Merge", status: stageStatus(currentStatus, "merging") }
    ],
    latestFinding: latestFinding(events),
    checks: currentPrd?.lastCheckStatus ?? "none",
    reviewDecision: currentPrd?.lastReviewDecision ?? "none",
    controls: ["Enter continue", "d diff", "r report", "p pause", "q quit"]
  };
}

