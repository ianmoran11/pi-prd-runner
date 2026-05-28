import type { CommandContext, CommandResult } from "./types.js";
import { parseRunOptions } from "./prd-run.js";
import { loadConfigOrDefault } from "../core/config.js";
import { loadPrds } from "../core/prd-parser.js";
import { reconcileState } from "../core/reconciliation.js";
import { runPrdQueue, type RunResult } from "../core/runner.js";
import { loadState, writeState } from "../core/state.js";

export async function prdResume(context: CommandContext, args: string[] = []): Promise<CommandResult<RunResult | null>> {
  let state = await loadState(context.cwd);
  if (!state.activeRunId) {
    const message = "No active PRD run to resume.";
    context.host.log(message);
    return { ok: true, message, data: null };
  }

  const config = await loadConfigOrDefault(context.cwd);
  const prds = await loadPrds(context.cwd, config);
  const reconciliation = await reconcileState(context.cwd, state, config, prds);
  state = reconciliation.state;
  await writeState(context.cwd, state);
  for (const issue of reconciliation.issues) {
    context.host[issue.level === "error" ? "error" : "warn"](`${issue.prd}: ${issue.message}`);
  }
  if (reconciliation.unsafe) {
    return { ok: false, message: "Resume blocked by unsafe state/Git mismatch.", data: null };
  }

  const options = parseRunOptions(args);
  const result = await runPrdQueue(context.cwd, context.host, { ...options, mode: options.mode ?? state.mode });
  const message = `Resumed PRD run ${result.runId}; status ${result.status}.`;
  context.host.log(message);
  return { ok: result.status !== "stuck" && result.status !== "failed", message, data: result };
}
