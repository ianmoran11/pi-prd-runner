import type { CommandContext, CommandResult } from "./types.js";
import { booleanFlag, parseCommandArgs } from "./args.js";
import { appendEvent } from "../core/events.js";
import { loadState, writeState } from "../core/state.js";

export async function prdStop(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const now = booleanFlag(parsed, "now");
  const state = await loadState(context.cwd);
  if (!state.activeRunId) {
    const message = "No active PRD run to stop.";
    context.host.log(message);
    return { ok: true, message };
  }

  const nextState = { ...state, stopRequested: true, lastUpdated: new Date().toISOString() };
  await writeState(context.cwd, nextState);
  await appendEvent(context.cwd, { type: "run.stopped", runId: state.activeRunId, reason: now ? "Immediate stop requested." : "Graceful stop requested." });
  const message = now ? "Stop requested immediately." : "Graceful stop requested.";
  context.host.log(message);
  return { ok: true, message, data: nextState };
}
