import type { CommandSpec, PiHost, PromptResult, PromptSpec } from "./core/host.js";
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

interface PiCommandContext {
  cwd: string;
  ui?: {
    notify(message: string, type?: "info" | "warning" | "error"): void;
    select(title: string, options: string[]): Promise<string | undefined>;
  };
}

interface PiExtensionApi {
  registerCommand(
    name: string,
    options: {
      description: string;
      handler: (args: string, context: PiCommandContext) => Promise<void> | void;
    }
  ): void;
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

function stripLeadingSlash(name: string): string {
  return name.startsWith("/") ? name.slice(1) : name;
}

function splitCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

class PiRuntimeHost extends ConsoleHost implements PiHost {
  constructor(private readonly context: PiCommandContext) {
    super();
  }

  override log(message: string): void {
    if (this.context.ui) {
      this.context.ui.notify(message, "info");
      return;
    }
    super.log(message);
  }

  override warn(message: string): void {
    if (this.context.ui) {
      this.context.ui.notify(message, "warning");
      return;
    }
    super.warn(message);
  }

  override error(message: string): void {
    if (this.context.ui) {
      this.context.ui.notify(message, "error");
      return;
    }
    super.error(message);
  }

  override async prompt(prompt: PromptSpec): Promise<PromptResult> {
    if (!prompt.choices?.length || !this.context.ui?.select) {
      return { choice: prompt.defaultChoice ?? prompt.choices?.[0]?.key };
    }

    const options = prompt.choices.map((choice) =>
      choice.description ? `${choice.key} - ${choice.label}: ${choice.description}` : `${choice.key} - ${choice.label}`
    );
    const selected = await this.context.ui.select(prompt.message, options);
    const selectedIndex = selected === undefined ? -1 : options.indexOf(selected);
    return { choice: selectedIndex >= 0 ? prompt.choices[selectedIndex]?.key : prompt.defaultChoice ?? prompt.choices[0]?.key };
  }

  override renderDashboard(model: { title: string; lines: string[] }): void {
    this.log([model.title, ...model.lines].join("\n"));
  }
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

export default function piPrdRunnerExtension(pi: PiExtensionApi): void {
  for (const command of getPublicCommands()) {
    pi.registerCommand(stripLeadingSlash(command.name), {
      description: command.description,
      handler: async (rawArgs, context) => {
        const host = new PiRuntimeHost(context);
        try {
          const result = await command.handler({ cwd: context.cwd, host }, splitCommandLine(rawArgs));
          if (!result.ok) {
            host.warn(result.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          host.error(message);
          throw error;
        }
      }
    });
  }
}
