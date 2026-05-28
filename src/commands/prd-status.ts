import type { CommandContext, CommandResult } from "./types.js";
import { booleanFlag, parseCommandArgs } from "./args.js";
import { readEvents } from "../core/events.js";
import { loadState } from "../core/state.js";
import type { RunnerState } from "../types/state.js";

function formatStatus(state: RunnerState, latestEvent: unknown, verbose: boolean): string {
  const current = state.currentPrd ? state.prds[state.currentPrd] : undefined;
  const completed = Object.values(state.prds)
    .filter((prd) => prd.status === "merged")
    .map((prd) => prd.id);
  const stuck = Object.values(state.prds)
    .filter((prd) => prd.status === "stuck")
    .map((prd) => prd.id);
  const lines = [
    `Current run ID: ${state.activeRunId ?? "none"}`,
    `Mode: ${state.mode}`,
    `Current PRD: ${state.currentPrd ?? "none"}`,
    `Current branch: ${current?.branch ?? "none"}`,
    `Current worktree: ${current?.worktree ?? "none"}`,
    `Current stage: ${current?.status ?? "idle"}`,
    `Attempt count: ${current?.attempt ?? 0}`,
    `Completed PRDs: ${completed.join(", ") || "none"}`,
    `Stuck PRDs: ${stuck.join(", ") || "none"}`,
    `Latest event: ${latestEvent ? JSON.stringify(latestEvent) : "none"}`
  ];

  if (verbose) {
    lines.push(`Tracked PRDs: ${Object.keys(state.prds).join(", ") || "none"}`);
  }

  return lines.join("\n");
}

export async function prdStatus(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const json = booleanFlag(parsed, "json");
  const verbose = booleanFlag(parsed, "verbose");

  try {
    const state = await loadState(context.cwd);
    const latestEvent = (await readEvents(context.cwd)).at(-1) ?? null;
    const data = { state, latestEvent };
    const message = json ? JSON.stringify(data, null, 2) : formatStatus(state, latestEvent, verbose);
    context.host.log(message);
    return { ok: true, message, data };
  } catch {
    const message = "pi-prd-runner is not initialized.";
    context.host.warn(message);
    return { ok: false, message };
  }
}
