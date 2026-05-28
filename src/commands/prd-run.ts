import type { CommandContext, CommandResult } from "./types.js";
import { booleanFlag, numberFlag, parseCommandArgs, stringFlag } from "./args.js";
import { runPrdQueue, type RunOptions, type RunResult } from "../core/runner.js";
import type { RunMode } from "../types/config.js";

export function parseRunOptions(args: string[]): RunOptions {
  const parsed = parseCommandArgs(args);
  const mode = stringFlag(parsed, "mode");
  if (mode && mode !== "auto" && mode !== "supervised") {
    throw new Error("--mode must be 'auto' or 'supervised'.");
  }

  return {
    mode: mode as RunMode | undefined,
    from: stringFlag(parsed, "from"),
    only: stringFlag(parsed, "only"),
    maxReviewCycles: numberFlag(parsed, "max-review-cycles"),
    noAutoMerge: booleanFlag(parsed, "no-auto-merge")
  };
}

export async function prdRun(context: CommandContext, args: string[] = []): Promise<CommandResult<RunResult>> {
  const options = parseRunOptions(args);
  context.host.log(`Starting PRD runner in ${options.mode ?? "configured"} mode.`);
  const result = await runPrdQueue(context.cwd, context.host, options);
  const message = `PRD run ${result.runId} ${result.status}; processed ${result.processed.length} PRD(s).`;
  context.host.log(message);
  return { ok: result.status !== "stuck", message, data: result };
}
