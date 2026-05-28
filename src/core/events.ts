import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { NewRunnerEvent, RunnerEvent } from "../types/event.js";
import { eventsPath } from "./config.js";

export interface EventFilter {
  runId?: string;
  prd?: string;
}

export async function appendEvent(cwd: string, event: NewRunnerEvent): Promise<RunnerEvent> {
  const eventWithTimestamp: RunnerEvent = {
    ...event,
    ts: event.ts ?? new Date().toISOString()
  };
  const filePath = eventsPath(cwd);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(eventWithTimestamp)}\n`, "utf8");
  return eventWithTimestamp;
}

export async function readEvents(cwd: string, filter: EventFilter = {}): Promise<RunnerEvent[]> {
  let raw = "";
  try {
    raw = await readFile(eventsPath(cwd), "utf8");
  } catch {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunnerEvent)
    .filter((event) => (filter.runId ? event.runId === filter.runId : true))
    .filter((event) => (filter.prd ? event.prd === filter.prd : true));
}

