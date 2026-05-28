import type { RunnerConfig } from "../types/config.js";
import type { ParsedPrd } from "../types/prd.js";
import type { RunnerState } from "../types/state.js";
import { getCurrentBranch, branchExists } from "../git/git.js";
import { worktreeExists } from "../git/worktrees.js";

export interface ReconciliationIssue {
  level: "warning" | "error";
  prd: string;
  message: string;
}

export interface ReconciliationResult {
  state: RunnerState;
  issues: ReconciliationIssue[];
  unsafe: boolean;
}

export async function reconcileState(
  cwd: string,
  state: RunnerState,
  _config: RunnerConfig,
  prds: ParsedPrd[]
): Promise<ReconciliationResult> {
  const issues: ReconciliationIssue[] = [];
  const parsedById = new Map(prds.map((prd) => [prd.id, prd]));
  let nextState = state;

  for (const [prdId, prdState] of Object.entries(state.prds)) {
    const parsed = parsedById.get(prdId);
    if (!parsed) {
      issues.push({ level: "warning", prd: prdId, message: "PRD exists in state but no matching PRD file was loaded." });
      continue;
    }

    if (prdState.path !== parsed.relativePath || prdState.title !== (parsed.title ?? parsed.id)) {
      nextState = {
        ...nextState,
        prds: {
          ...nextState.prds,
          [prdId]: {
            ...nextState.prds[prdId],
            path: parsed.relativePath,
            title: parsed.title ?? parsed.id
          }
        }
      };
      issues.push({ level: "warning", prd: prdId, message: "Repaired PRD path/title from current PRD file." });
    }

    if (prdState.branch && !(await branchExists(cwd, prdState.branch))) {
      issues.push({ level: "error", prd: prdId, message: `Branch '${prdState.branch}' is missing.` });
    }

    if (prdState.worktree) {
      const worktreePath = new URL(prdState.worktree, `file://${cwd}/`).pathname;
      if (!(await worktreeExists(worktreePath))) {
        issues.push({ level: "error", prd: prdId, message: `Worktree '${prdState.worktree}' is missing.` });
      } else if (prdState.branch) {
        const actualBranch = await getCurrentBranch(worktreePath);
        if (actualBranch !== prdState.branch) {
          issues.push({
            level: "error",
            prd: prdId,
            message: `Worktree '${prdState.worktree}' is on '${actualBranch}', expected '${prdState.branch}'.`
          });
        }
      }
    }
  }

  return {
    state: nextState,
    issues,
    unsafe: issues.some((issue) => issue.level === "error")
  };
}

