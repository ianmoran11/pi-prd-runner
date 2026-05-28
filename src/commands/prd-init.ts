import type { CommandContext, CommandResult } from "./types.js";
import { initProject } from "../core/init.js";

export interface PrdInitResult {
  created: string[];
  skipped: string[];
}

export async function prdInit(context: CommandContext, args: string[] = []): Promise<CommandResult<PrdInitResult>> {
  const force = args.includes("--force");
  const withExample = args.includes("--with-example");
  const result = await initProject(context.cwd, { force, withExample });
  const message = `Initialized pi-prd-runner metadata (${result.created.length} created, ${result.skipped.length} skipped).`;
  context.host.log(message);
  return { ok: true, message, data: result };
}
