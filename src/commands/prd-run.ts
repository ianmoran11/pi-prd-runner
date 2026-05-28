import type { CommandContext, CommandResult } from "./types.js";
import { placeholderResult } from "./types.js";

export async function prdRun(_context: CommandContext, _args: string[] = []): Promise<CommandResult> {
  return placeholderResult("/prd-run");
}

