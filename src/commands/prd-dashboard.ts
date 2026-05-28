import type { CommandContext, CommandResult } from "./types.js";
import { booleanFlag, parseCommandArgs } from "./args.js";
import { showDashboard } from "../dashboard/dashboard.js";

export async function prdDashboard(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const parsed = parseCommandArgs(args);
  const rendered = await showDashboard(context.cwd, context.host, {
    compact: booleanFlag(parsed, "compact"),
    verbose: booleanFlag(parsed, "verbose")
  });
  return { ok: true, message: rendered, data: { rendered } };
}
