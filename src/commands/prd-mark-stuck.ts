import type { CommandContext, CommandResult } from "./types.js";
import { parseCommandArgs, stringFlag } from "./args.js";
import { ensureAttemptDirectory, writeStuckReport } from "../core/artifacts.js";
import { appendEvent } from "../core/events.js";
import { loadStateForCommand, updatePrdStatusDirect } from "./control-helpers.js";

export async function prdMarkStuck(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const prdId = parsed.positionals[0];
  if (!prdId) {
    throw new Error("/prd-mark-stuck requires a PRD id.");
  }

  const reason = stringFlag(parsed, "reason") ?? "Marked stuck by user.";
  const state = await loadStateForCommand(context.cwd);
  const prd = state.prds[prdId];
  if (!prd) {
    throw new Error(`Unknown PRD '${prdId}'.`);
  }

  const runId = state.activeRunId ?? `manual-${Date.now()}`;
  const attempt = Math.max(prd.attempt, 1);
  const paths = await ensureAttemptDirectory(context.cwd, runId, prdId, attempt);
  await writeStuckReport(paths, prdId, reason, attempt, reason);
  const nextState = await updatePrdStatusDirect(context.cwd, state, prdId, "stuck", reason);
  await appendEvent(context.cwd, { type: "prd.stuck", runId, prd: prdId, attempt, reason });
  const message = `Marked ${prdId} stuck.`;
  context.host.log(message);
  return { ok: true, message, data: nextState.prds[prdId] };
}
