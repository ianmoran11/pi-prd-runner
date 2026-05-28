import type { CommandContext, CommandResult } from "./types.js";
import { placeholderResult } from "./types.js";

export async function prdRetry(_context: CommandContext, _args: string[] = []): Promise<CommandResult> {
  return placeholderResult("/prd-retry");
}

