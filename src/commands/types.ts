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
