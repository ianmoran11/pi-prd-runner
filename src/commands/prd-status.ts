import type { CommandContext, CommandResult } from "./types.js";
import { placeholderResult } from "./types.js";

export async function prdStatus(_context: CommandContext, _args: string[] = []): Promise<CommandResult> {
  return placeholderResult("/prd-status");
}

