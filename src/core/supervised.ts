import type { PiHost, PromptChoice } from "./host.js";

export type SupervisedGate = "before_prd" | "after_implementation" | "failed_checks" | "changes_requested" | "before_merge" | "stuck";
export type SupervisedAction = "continue" | "merge" | "retry" | "skip" | "pause" | "stop";

export interface SupervisedControlContext {
  gate: SupervisedGate;
  prdId: string;
  diff?: string;
  report?: string;
}

function choicesForGate(gate: SupervisedGate): PromptChoice[] {
  const choices: PromptChoice[] = [{ key: "continue", label: "continue" }];
  if (gate === "before_merge") {
    choices.unshift({ key: "merge", label: "merge approved PRD" });
  }
  choices.push(
    { key: "diff", label: "view diff" },
    { key: "report", label: "view report" },
    { key: "retry", label: "retry" },
    { key: "skip", label: "skip PRD" },
    { key: "pause", label: "pause" },
    { key: "quit", label: "quit" }
  );
  return choices;
}

export async function promptSupervisedControl(host: PiHost, context: SupervisedControlContext): Promise<SupervisedAction> {
  const defaultChoice = context.gate === "before_merge" ? "merge" : "continue";
  const result = await host.prompt?.({
    message: `PRD ${context.prdId}: ${context.gate.replaceAll("_", " ")}.`,
    defaultChoice,
    choices: choicesForGate(context.gate)
  });
  const choice = result?.choice ?? defaultChoice;

  if (choice === "diff") {
    host.log(context.diff ?? "No diff artifact is available yet.");
    return "continue";
  }

  if (choice === "report") {
    host.log(context.report ?? "No report artifact is available yet.");
    return "continue";
  }

  if (choice === "quit") {
    return "stop";
  }

  if (choice === "merge" || choice === "retry" || choice === "skip" || choice === "pause" || choice === "continue") {
    return choice;
  }

  return "continue";
}

