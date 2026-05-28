import type { PiHost } from "../core/host.js";

export interface CommandContext {
  cwd: string;
  host: PiHost;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
}

export function placeholderResult(command: string): CommandResult {
  return {
    ok: false,
    message: `${command} is not implemented yet.`
  };
}

