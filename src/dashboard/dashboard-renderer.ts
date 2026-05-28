import type { RunnerDashboardModel } from "./dashboard-model.js";

export interface RenderDashboardOptions {
  compact?: boolean;
  verbose?: boolean;
}

function mark(status: "done" | "current" | "pending"): string {
  if (status === "done") {
    return "[x]";
  }
  if (status === "current") {
    return ">> ";
  }
  return "[ ]";
}

export function renderDashboard(model: RunnerDashboardModel, options: RenderDashboardOptions = {}): string {
  const current = model.currentPrd;
  const lines = [
    "pi-prd-runner",
    `mode: ${model.mode}    run: ${model.runId ?? "idle"}    base: ${model.baseBranch}`,
    `current PRD: ${current ? `${current.id} ${current.title}` : "none"}`,
    `stage: ${current?.status ?? "idle"}    attempt: ${current ? `${current.attempt}/${current.maxReviewCycles}` : "0/0"}`,
    `branch: ${current?.branch ?? "none"}`,
    `worktree: ${current?.worktree ?? "none"}`
  ];

  if (!options.compact) {
    lines.push("", "PRD Queue");
    for (const item of model.queue) {
      lines.push(`${item.current ? ">>" : "  "} ${item.id} ${item.status} ${item.title}`);
    }

    lines.push("", "Current Stage");
    for (const stage of model.stages) {
      lines.push(`${mark(stage.status)} ${stage.name}`);
    }
  }

  lines.push("", "Latest finding", model.latestFinding);
  lines.push("", `Checks: ${model.checks}    Review: ${model.reviewDecision}`);
  if (options.verbose) {
    lines.push(`Queue size: ${model.queue.length}`);
  }
  lines.push(`Controls: ${model.controls.join(" | ")}`);
  return lines.join("\n");
}

