import type { CommandSpec, PiHost } from "./core/host.js";
import { ConsoleHost } from "./core/host.js";
import { prdDashboard } from "./commands/prd-dashboard.js";
import { prdInit } from "./commands/prd-init.js";
import { prdMarkStuck } from "./commands/prd-mark-stuck.js";
import { prdResume } from "./commands/prd-resume.js";
import { prdRetry } from "./commands/prd-retry.js";
import { prdRun } from "./commands/prd-run.js";
import { prdSkip } from "./commands/prd-skip.js";
import { prdStatus } from "./commands/prd-status.js";
import { prdStop } from "./commands/prd-stop.js";
import { prdValidate } from "./commands/prd-validate.js";
import type { CommandContext, CommandResult } from "./commands/types.js";

export interface RegisteredCommand {
  name: string;
  description: string;
  handler: (context: CommandContext, args: string[]) => Promise<CommandResult>;
}

export function getPublicCommands(): RegisteredCommand[] {
  return [
    { name: "/prd-init", description: "Initialize pi-prd-runner metadata.", handler: prdInit },
    { name: "/prd-run", description: "Run the PRD queue.", handler: prdRun },
    { name: "/prd-resume", description: "Resume an interrupted PRD run.", handler: prdResume },
    { name: "/prd-status", description: "Show current PRD runner state.", handler: prdStatus },
    { name: "/prd-dashboard", description: "Render the PRD runner dashboard.", handler: prdDashboard },
    { name: "/prd-validate", description: "Validate PRD files.", handler: prdValidate },
    { name: "/prd-stop", description: "Stop the active PRD run.", handler: prdStop },
    { name: "/prd-retry", description: "Retry a PRD.", handler: prdRetry },
    { name: "/prd-skip", description: "Skip a PRD.", handler: prdSkip },
    { name: "/prd-mark-stuck", description: "Mark a PRD stuck.", handler: prdMarkStuck }
  ];
}

export function activate(host: PiHost = new ConsoleHost(), cwd = process.cwd()): CommandSpec[] {
  const commands = getPublicCommands().map((command): CommandSpec => ({
    name: command.name,
    description: command.description,
    run: (args: string[] = []) => command.handler({ cwd, host }, args)
  }));

  for (const command of commands) {
    host.registerCommand?.(command);
  }

  return commands;
}

