import type { CommandContext, CommandResult } from "./types.js";
import { parseCommandArgs, stringFlag } from "./args.js";
import { appendEvent } from "../core/events.js";
import { loadState, writeState } from "../core/state.js";

export async function prdRetry(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const state = await loadState(context.cwd);
  const prdId = parsed.positionals[0] ?? state.currentPrd;
  if (!prdId || !state.prds[prdId]) {
    throw new Error("A current or explicit PRD is required for /prd-retry.");
  }

  const reason = stringFlag(parsed, "reason");
  const prd = state.prds[prdId];
  const now = new Date().toISOString();
  const nextState = {
    ...state,
    currentPrd: prdId,
    prds: {
      ...state.prds,
      [prdId]: {
        ...prd,
        attempt: prd.attempt + 1,
        status: "changes_requested" as const,
        lastUpdated: now
      }
    },
    lastUpdated: now
  };
  await writeState(context.cwd, nextState);
  await appendEvent(context.cwd, { type: "prd.status_changed", runId: state.activeRunId ?? undefined, prd: prdId, from: prd.status, to: "changes_requested", reason });
  const message = `Retry scheduled for ${prdId}.`;
  context.host.log(message);
  return { ok: true, message, data: nextState.prds[prdId] };
}
