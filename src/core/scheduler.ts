import type { ParsedPrd } from "../types/prd.js";
import type { RunnerState } from "../types/state.js";

export interface SchedulerOptions {
  from?: string;
  only?: string;
}

export interface SchedulerResult {
  prd: ParsedPrd | null;
  reason: "selected" | "no_prds" | "only_not_found" | "from_not_found" | "dependencies_pending";
}

const terminalStatuses = new Set(["merged", "skipped", "stuck", "failed"]);

function currentStatus(prd: ParsedPrd, state: RunnerState): string {
  return state.prds[prd.id]?.status ?? prd.status ?? "pending";
}

function dependencySatisfied(dependency: string, prdsById: Map<string, ParsedPrd>, state: RunnerState): boolean {
  const dependencyPrd = prdsById.get(dependency);
  if (!dependencyPrd) {
    return false;
  }

  return currentStatus(dependencyPrd, state) === "merged";
}

function isEligible(prd: ParsedPrd, state: RunnerState): boolean {
  const status = currentStatus(prd, state);
  return !terminalStatuses.has(status) && ["pending", "ready", "changes_requested"].includes(status);
}

export function selectNextPrd(prds: ParsedPrd[], state: RunnerState, options: SchedulerOptions = {}): SchedulerResult {
  if (prds.length === 0) {
    return { prd: null, reason: "no_prds" };
  }

  const prdsById = new Map(prds.map((prd) => [prd.id, prd]));

  if (options.only && !prdsById.has(options.only)) {
    return { prd: null, reason: "only_not_found" };
  }

  let candidates = options.only ? prds.filter((prd) => prd.id === options.only) : prds;

  if (options.from) {
    const fromIndex = candidates.findIndex((prd) => prd.id === options.from);
    if (fromIndex === -1) {
      return { prd: null, reason: "from_not_found" };
    }
    candidates = candidates.slice(fromIndex);
  }

  let blockedByDependency = false;
  for (const prd of candidates) {
    if (!isEligible(prd, state)) {
      continue;
    }

    const dependenciesReady = prd.dependsOn.every((dependency) => dependencySatisfied(dependency, prdsById, state));
    if (!dependenciesReady) {
      blockedByDependency = true;
      continue;
    }

    return { prd, reason: "selected" };
  }

  return { prd: null, reason: blockedByDependency ? "dependencies_pending" : "no_prds" };
}

