import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, DEFAULT_CONFIG_YAML, defaultInitialState, eventsPath, metadataPath, statePath } from "./config.js";

export interface InitOptions {
  force?: boolean;
  withExample?: boolean;
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

export const EXAMPLE_PRD = `---
id: prd-001-example
title: Example PRD
status: pending
depends_on: []
risk: low
max_review_cycles: 5
---

# PRD-001: Example PRD

## Goal

Add a small example change.

## Scope

Included:
- Add the requested example behavior.

Excluded:
- Production integrations.
- Remote services.

## Acceptance criteria

- [ ] The example behavior is implemented.
- [ ] Tests cover the example behavior.

## Required checks

\`\`\`bash
npm test
\`\`\`

## Files likely to change

- \`src/example.ts\`
- \`tests/example.test.ts\`

## Reviewer checklist

- The implementation stays within the example scope.
`;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeIfNeeded(filePath: string, content: string, options: InitOptions, result: InitResult): Promise<void> {
  if ((await exists(filePath)) && !options.force) {
    result.skipped.push(path.relative(process.cwd(), filePath));
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  result.created.push(path.relative(process.cwd(), filePath));
}

export async function initProject(cwd: string, options: InitOptions = {}): Promise<InitResult> {
  const result: InitResult = { created: [], skipped: [] };
  const directories = [
    path.join(cwd, DEFAULT_CONFIG.project.prdDirectory),
    metadataPath(cwd),
    metadataPath(cwd, "runs"),
    metadataPath(cwd, "worktrees")
  ];

  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
    result.created.push(path.relative(process.cwd(), directory));
  }

  await writeIfNeeded(metadataPath(cwd, "config.yml"), DEFAULT_CONFIG_YAML, options, result);
  await writeIfNeeded(statePath(cwd), `${JSON.stringify(defaultInitialState(), null, 2)}\n`, options, result);
  await writeIfNeeded(eventsPath(cwd), "", options, result);

  if (options.withExample) {
    await writeIfNeeded(path.join(cwd, DEFAULT_CONFIG.project.prdDirectory, "prd-001-example.md"), EXAMPLE_PRD, options, result);
  }

  return result;
}

export async function readInitialState(cwd: string): Promise<unknown> {
  return JSON.parse(await readFile(statePath(cwd), "utf8"));
}

