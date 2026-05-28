import { appendEvent } from "../core/events.js";
import { loadState, writeState } from "../core/state.js";
import type { PrdStatus } from "../types/prd.js";
import type { RunnerState } from "../types/state.js";

export async function updatePrdStatusDirect(
  cwd: string,
  state: RunnerState,
  prdId: string,
  status: PrdStatus,
  reason?: string
): Promise<RunnerState> {
  const prd = state.prds[prdId];
  if (!prd) {
    throw new Error(`Unknown PRD '${prdId}'.`);
  }

  const now = new Date().toISOString();
  const nextState: RunnerState = {
    ...state,
    prds: {
      ...state.prds,
      [prdId]: {
        ...prd,
        status,
        lastUpdated: now
      }
    },
    currentPrd: state.currentPrd ?? prdId,
    lastUpdated: now
  };
  await writeState(cwd, nextState);
  await appendEvent(cwd, {
    type: "prd.status_changed",
    runId: state.activeRunId ?? undefined,
    prd: prdId,
    from: prd.status,
    to: status,
    reason
  });
  return nextState;
}

export async function loadStateForCommand(cwd: string): Promise<RunnerState> {
  return loadState(cwd);
}

