import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultInitialState } from "../src/core/config.js";
import { readEvents } from "../src/core/events.js";
import { parsePrd } from "../src/core/prd-parser.js";
import { selectNextPrd } from "../src/core/scheduler.js";
import { createPrdState, InvalidTransitionError, transitionPrd } from "../src/core/state-machine.js";
import type { ParsedPrd } from "../src/types/prd.js";
import type { RunnerState } from "../src/types/state.js";

let tempDir: string;

function prdMarkdown(id: string, dependsOn: string[] = []): string {
  return `---
id: ${id}
title: ${id}
status: pending
depends_on: [${dependsOn.join(", ")}]
---

# ${id}

## Goal

Deliver ${id}.

## Scope

Included:
- One scoped item.

Excluded:
- Future work.

## Acceptance criteria

- [ ] ${id} works.
`;
}

function parsedPrd(id: string, dependsOn: string[] = []): ParsedPrd {
  return parsePrd(prdMarkdown(id, dependsOn), path.join(tempDir, `docs/prds/${id}.md`), tempDir);
}

function stateWithPrds(prds: ParsedPrd[]): RunnerState {
  const state = defaultInitialState();
  for (const prd of prds) {
    state.prds[prd.id] = createPrdState(prd, 5);
  }
  return state;
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-machine-"));
  await mkdir(path.join(tempDir, ".pi/prd-runner"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("state machine", () => {
  it("updates state and emits an event for valid transitions", async () => {
    const prd = parsedPrd("prd-001");
    const state = stateWithPrds([prd]);
    state.prds[prd.id].status = "ready";

    const nextState = await transitionPrd(tempDir, state, prd.id, "implementing", {
      runId: "run-1",
      now: "2026-05-28T10:00:00.000Z"
    });

    expect(nextState.prds[prd.id].status).toBe("implementing");
    expect(nextState.prds[prd.id].startedAt).toBe("2026-05-28T10:00:00.000Z");
    const events = await readEvents(tempDir, { prd: prd.id });
    expect(events[0]).toMatchObject({
      type: "prd.status_changed",
      from: "ready",
      to: "implementing"
    });
  });

  it("rejects invalid transitions", async () => {
    const prd = parsedPrd("prd-001");
    const state = stateWithPrds([prd]);

    await expect(transitionPrd(tempDir, state, prd.id, "reviewing")).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

describe("scheduler", () => {
  it("selects the first eligible PRD", () => {
    const prds = [parsedPrd("prd-001"), parsedPrd("prd-002")];
    const result = selectNextPrd(prds, stateWithPrds(prds));

    expect(result.prd?.id).toBe("prd-001");
    expect(result.reason).toBe("selected");
  });

  it("respects dependency order", () => {
    const prds = [parsedPrd("prd-001"), parsedPrd("prd-002", ["prd-001"])];
    const state = stateWithPrds(prds);
    state.prds["prd-001"].status = "merged";

    expect(selectNextPrd(prds, state).prd?.id).toBe("prd-002");
  });

  it("skips PRDs with pending dependencies", () => {
    const prds = [parsedPrd("prd-002", ["prd-001"]), parsedPrd("prd-001")];
    const result = selectNextPrd(prds, stateWithPrds(prds));

    expect(result.prd?.id).toBe("prd-001");
  });

  it("supports from and only filters", () => {
    const prds = [parsedPrd("prd-001"), parsedPrd("prd-002"), parsedPrd("prd-003")];
    const state = stateWithPrds(prds);

    expect(selectNextPrd(prds, state, { from: "prd-002" }).prd?.id).toBe("prd-002");
    expect(selectNextPrd(prds, state, { only: "prd-003" }).prd?.id).toBe("prd-003");
  });
});
