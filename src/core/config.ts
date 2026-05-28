import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { RunnerConfig } from "../types/config.js";
import type { InitialRunnerState } from "../types/state.js";

export const PRD_RUNNER_DIR = ".pi/prd-runner";

export const DEFAULT_CONFIG_YAML = `schemaVersion: 1

project:
  prdDirectory: docs/prds
  prdPattern: "prd-*.md"
  baseBranch: main

worktrees:
  enabled: true
  directory: .pi/prd-runner/worktrees
  cleanAfterMerge: false

branches:
  prefix: "pi/"
  strategy: one-branch-per-prd

run:
  defaultMode: supervised
  serial: true
  maxReviewCycles: 5
  immediateRevisionOnFailedChecks: true

supervised:
  autoMerge: false
  pauseBeforePrd: true
  pauseAfterImplementation: true
  pauseBeforeReview: false
  pauseBeforeMerge: true
  pauseOnFailedChecks: true
  pauseOnChangesRequested: false

auto:
  autoMerge: true
  continueToNextPrd: true
  stopOnMaxReviewCycles: true
  stopOnMergeConflict: true
  stopOnStuck: true

permissions:
  agentPermissions: full

checks:
  default:
    - name: test
      command: "npm test"
    - name: lint
      command: "npm run lint"

review:
  approvalAuthority: reviewer
  requireFreshReviewSession: true
  requireStructuredDecision: true

merge:
  targetBranch: main
  strategy: squash
  deleteBranchAfterMerge: false
  requireCleanWorkingTree: true

artifacts:
  writeImplementationSummary: true
  writeReviewReport: true
  writeReviewJson: true
  writeTestResults: true
  writeDiffPatch: true
  writeChangedFiles: true
  writeRunSummary: true
`;

const checkCommandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1)
});

const configSchema: z.ZodType<RunnerConfig> = z.object({
  schemaVersion: z.literal(1),
  project: z.object({
    prdDirectory: z.string().min(1),
    prdPattern: z.string().min(1),
    baseBranch: z.string().min(1)
  }),
  worktrees: z.object({
    enabled: z.boolean(),
    directory: z.string().min(1),
    cleanAfterMerge: z.boolean()
  }),
  branches: z.object({
    prefix: z.string(),
    strategy: z.literal("one-branch-per-prd")
  }),
  run: z.object({
    defaultMode: z.enum(["supervised", "auto"]),
    serial: z.literal(true),
    maxReviewCycles: z.number().int().positive(),
    immediateRevisionOnFailedChecks: z.boolean()
  }),
  supervised: z.object({
    autoMerge: z.boolean(),
    pauseBeforePrd: z.boolean(),
    pauseAfterImplementation: z.boolean(),
    pauseBeforeReview: z.boolean(),
    pauseBeforeMerge: z.boolean(),
    pauseOnFailedChecks: z.boolean(),
    pauseOnChangesRequested: z.boolean()
  }),
  auto: z.object({
    autoMerge: z.boolean(),
    continueToNextPrd: z.boolean(),
    stopOnMaxReviewCycles: z.boolean(),
    stopOnMergeConflict: z.boolean(),
    stopOnStuck: z.boolean()
  }),
  permissions: z.object({
    agentPermissions: z.literal("full")
  }),
  checks: z.object({
    default: z.array(checkCommandSchema)
  }),
  review: z.object({
    approvalAuthority: z.literal("reviewer"),
    requireFreshReviewSession: z.boolean(),
    requireStructuredDecision: z.boolean()
  }),
  merge: z.object({
    targetBranch: z.string().min(1),
    strategy: z.literal("squash"),
    deleteBranchAfterMerge: z.boolean(),
    requireCleanWorkingTree: z.boolean()
  }),
  artifacts: z.object({
    writeImplementationSummary: z.boolean(),
    writeReviewReport: z.boolean(),
    writeReviewJson: z.boolean(),
    writeTestResults: z.boolean(),
    writeDiffPatch: z.boolean(),
    writeChangedFiles: z.boolean(),
    writeRunSummary: z.boolean()
  })
});

export const DEFAULT_CONFIG = validateConfig(YAML.parse(DEFAULT_CONFIG_YAML));

export function defaultInitialState(baseBranch = DEFAULT_CONFIG.project.baseBranch): InitialRunnerState {
  return {
    schemaVersion: 1,
    initialized: true,
    activeRunId: null,
    mode: DEFAULT_CONFIG.run.defaultMode,
    baseBranch,
    currentPrd: null,
    prds: {},
    lastUpdated: null
  };
}

export function metadataPath(cwd: string, ...segments: string[]): string {
  return path.join(cwd, PRD_RUNNER_DIR, ...segments);
}

export function configPath(cwd: string): string {
  return metadataPath(cwd, "config.yml");
}

export function statePath(cwd: string): string {
  return metadataPath(cwd, "state.json");
}

export function eventsPath(cwd: string): string {
  return metadataPath(cwd, "events.ndjson");
}

export function validateConfig(value: unknown): RunnerConfig {
  return configSchema.parse(value);
}

export function stringifyConfig(config: RunnerConfig = DEFAULT_CONFIG): string {
  return YAML.stringify(config, { lineWidth: 0 });
}

export async function loadConfig(cwd: string): Promise<RunnerConfig> {
  const raw = await readFile(configPath(cwd), "utf8");
  return validateConfig(YAML.parse(raw));
}

export async function loadConfigOrDefault(cwd: string): Promise<RunnerConfig> {
  try {
    return await loadConfig(cwd);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(cwd: string, config: RunnerConfig = DEFAULT_CONFIG): Promise<void> {
  await mkdir(path.dirname(configPath(cwd)), { recursive: true });
  await writeFile(configPath(cwd), stringifyConfig(config), "utf8");
}
