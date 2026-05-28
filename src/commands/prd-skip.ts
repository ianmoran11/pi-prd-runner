import type { CommandContext, CommandResult } from "./types.js";
import { placeholderResult } from "./types.js";

export async function prdSkip(_context: CommandContext, _args: string[] = []): Promise<CommandResult> {
  return placeholderResult("/prd-skip");
}

