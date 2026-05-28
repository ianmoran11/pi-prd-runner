import type { CommandContext, CommandResult } from "./types.js";
import { placeholderResult } from "./types.js";

export async function prdStop(_context: CommandContext, _args: string[] = []): Promise<CommandResult> {
  return placeholderResult("/prd-stop");
}

