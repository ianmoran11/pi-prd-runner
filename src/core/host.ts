export interface PromptChoice {
  key: string;
  label: string;
  description?: string;
}

export interface PromptSpec {
  message: string;
  choices?: PromptChoice[];
  defaultChoice?: string;
}

export interface PromptResult {
  choice?: string;
  value?: string;
}

export interface CommandSpec {
  name: string;
  description: string;
  run?: (args: string[]) => Promise<unknown> | unknown;
}

export interface DashboardModel {
  title: string;
  lines: string[];
}

export interface AgentSessionSpec {
  kind: "implementation" | "review" | "revision";
  prompt: string;
  cwd: string;
  freshContext?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionResult {
  ok: boolean;
  output: string;
  artifacts?: Record<string, string>;
  error?: string;
}

export interface PiHost {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  prompt?(prompt: PromptSpec): Promise<PromptResult>;
  registerCommand?(command: CommandSpec): void;
  renderDashboard?(model: DashboardModel): void;
  runAgentSession?(spec: AgentSessionSpec): Promise<AgentSessionResult>;
}

export class ConsoleHost implements PiHost {
  log(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  error(message: string): void {
    console.error(message);
  }

  async prompt(prompt: PromptSpec): Promise<PromptResult> {
    return { choice: prompt.defaultChoice ?? prompt.choices?.[0]?.key };
  }

  renderDashboard(model: DashboardModel): void {
    this.log([model.title, ...model.lines].join("\n"));
  }

  async runAgentSession(spec: AgentSessionSpec): Promise<AgentSessionResult> {
    return {
      ok: false,
      output: "",
      error: `No agent runtime is configured for ${spec.kind} sessions.`
    };
  }
}

export class MockHost implements PiHost {
  logs: string[] = [];
  warnings: string[] = [];
  errors: string[] = [];
  commands: CommandSpec[] = [];
  dashboards: DashboardModel[] = [];
  prompts: PromptSpec[] = [];
  promptResults: PromptResult[] = [];
  agentSessions: AgentSessionSpec[] = [];
  agentResults: AgentSessionResult[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }

  registerCommand(command: CommandSpec): void {
    this.commands.push(command);
  }

  renderDashboard(model: DashboardModel): void {
    this.dashboards.push(model);
  }

  async prompt(prompt: PromptSpec): Promise<PromptResult> {
    this.prompts.push(prompt);
    return this.promptResults.shift() ?? { choice: prompt.defaultChoice ?? prompt.choices?.[0]?.key };
  }

  async runAgentSession(spec: AgentSessionSpec): Promise<AgentSessionResult> {
    this.agentSessions.push(spec);
    return this.agentResults.shift() ?? { ok: true, output: "" };
  }
}

export class PiExtensionHost extends ConsoleHost {
  // TODO: Replace this thin fallback with Pi runtime command and dashboard APIs
  // once the concrete extension API is available in the target environment.
}

