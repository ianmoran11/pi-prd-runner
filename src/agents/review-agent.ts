import type { AgentSessionResult, PiHost } from "../core/host.js";
import type { ParsedPrd } from "../types/prd.js";
import type { ReviewResult } from "../types/review.js";
import { parseReviewOutput } from "./schemas.js";
import { renderReviewPrompt } from "./prompts.js";
import { AgentRuntimeUnavailableError } from "./implementation-agent.js";

export interface ReviewAgentOptions {
  host: PiHost;
  prd: ParsedPrd;
  worktree: string;
  diff: string;
  changedFiles: string;
  implementationSummary: string;
  testResults: string;
}

export interface ReviewAgentResult {
  session: AgentSessionResult;
  review: ReviewResult;
  repaired: boolean;
}

function repairPrompt(originalPrompt: string, badOutput: string, error: unknown): string {
  return `${originalPrompt}

The previous review output was malformed and could not be parsed as the required JSON.

Parse error:
${error instanceof Error ? error.message : String(error)}

Malformed output:
${badOutput}

Return only valid JSON matching the required schema.`;
}

export async function runReviewAgent(options: ReviewAgentOptions): Promise<ReviewAgentResult> {
  if (!options.host.runAgentSession) {
    throw new AgentRuntimeUnavailableError();
  }

  const prompt = renderReviewPrompt(options);
  const firstSession = await options.host.runAgentSession({
    kind: "review",
    prompt,
    cwd: options.worktree,
    freshContext: true,
    metadata: { prd: options.prd.id }
  });

  try {
    return {
      session: firstSession,
      review: parseReviewOutput(firstSession.output),
      repaired: false
    };
  } catch (error) {
    const repairSession = await options.host.runAgentSession({
      kind: "review",
      prompt: repairPrompt(prompt, firstSession.output, error),
      cwd: options.worktree,
      freshContext: true,
      metadata: { prd: options.prd.id, repair: true }
    });

    return {
      session: repairSession,
      review: parseReviewOutput(repairSession.output),
      repaired: true
    };
  }
}

