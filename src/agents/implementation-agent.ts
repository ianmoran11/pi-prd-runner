import type { AgentSessionResult, PiHost } from "../core/host.js";
import type { ParsedPrd } from "../types/prd.js";
import { renderImplementationPrompt, renderRevisionPrompt } from "./prompts.js";
import type { CheckRunResult } from "../checks/check-runner.js";

export interface ImplementationAgentOptions {
  host: PiHost;
  prd: ParsedPrd;
  attempt: number;
  branch: string;
  worktree: string;
  artifactDirectory: string;
  revisionNotes?: string[];
  checkResult?: CheckRunResult;
  requiredRevisions?: string[];
}

export class AgentRuntimeUnavailableError extends Error {
  constructor() {
    super("PiHost.runAgentSession is not available.");
    this.name = "AgentRuntimeUnavailableError";
  }
}

export async function runImplementationAgent(options: ImplementationAgentOptions): Promise<AgentSessionResult> {
  if (!options.host.runAgentSession) {
    throw new AgentRuntimeUnavailableError();
  }

  const prompt =
    options.checkResult || options.requiredRevisions?.length
      ? renderRevisionPrompt(options)
      : renderImplementationPrompt(options);

  return options.host.runAgentSession({
    kind: options.checkResult || options.requiredRevisions?.length ? "revision" : "implementation",
    prompt,
    cwd: options.worktree,
    metadata: {
      prd: options.prd.id,
      attempt: options.attempt,
      branch: options.branch,
      artifactDirectory: options.artifactDirectory
    }
  });
}

