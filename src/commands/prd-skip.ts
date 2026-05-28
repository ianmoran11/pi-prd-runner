import type { CommandContext, CommandResult } from "./types.js";
import { parseCommandArgs, stringFlag } from "./args.js";
import { appendEvent } from "../core/events.js";
import { loadStateForCommand, updatePrdStatusDirect } from "./control-helpers.js";

export async function prdSkip(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const prdId = parsed.positionals[0];
  if (!prdId) {
    throw new Error("/prd-skip requires a PRD id.");
  }

  const reason = stringFlag(parsed, "reason");
  const state = await loadStateForCommand(context.cwd);
  const nextState = await updatePrdStatusDirect(context.cwd, state, prdId, "skipped", reason);
  await appendEvent(context.cwd, { type: "prd.skipped", runId: state.activeRunId ?? undefined, prd: prdId, reason });
  const message = `Skipped ${prdId}.`;
  context.host.log(message);
  return { ok: true, message, data: nextState.prds[prdId] };
}
