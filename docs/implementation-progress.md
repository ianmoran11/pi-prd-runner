# Implementation Progress

## prd-001-package-skeleton

Status: complete

Summary:
- Created the initial TypeScript package scaffold.
- Added command module placeholders for all public commands.
- Added Pi host abstractions plus console and mock host implementations.
- Added a smoke test covering package imports and command module presence.

Files changed:
- `package.json`
- `tsconfig.json`
- `src/extension.ts`
- `src/index.ts`
- `src/core/host.ts`
- `src/commands/*.ts`
- `tests/smoke.test.ts`
- `README.md`
- `docs/implementation-progress.md`

Tests run:
- `npm test`
- `npm run typecheck`

Known limitations:
- Command handlers are placeholders until their corresponding PRDs are implemented.

Next PRD:
- `prd-002-config-init.md`

## prd-002-config-init

Status: complete

Summary:
- Added typed runner configuration and default YAML matching the spec.
- Implemented config validation, load, and write helpers.
- Implemented `/prd-init` with idempotent initialization, `--force`, and `--with-example`.
- Added config and PRD templates.
- Added tests for fresh init, idempotency, force overwrite, and example PRD creation.

Files changed:
- `src/types/config.ts`
- `src/types/state.ts`
- `src/core/config.ts`
- `src/core/init.ts`
- `src/commands/prd-init.ts`
- `templates/config.yml`
- `templates/prd-template.md`
- `tests/init.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/init.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Runtime state operations are still limited to initial state creation until the state/events PRD.

Next PRD:
- `prd-003-prd-parser-validator.md`

## prd-003-prd-parser-validator

Status: complete

Summary:
- Added PRD domain types and supported status definitions.
- Implemented Markdown frontmatter parsing, section extraction, acceptance criteria extraction, required checks, and reviewer checklist parsing.
- Implemented PRD loading from the configured `docs/prds` directory and filename pattern.
- Added validation for required fields, statuses, sections, scope lists, duplicate IDs, dependency existence, and dependency cycles.
- Implemented `/prd-validate`, including `--strict` and safe status normalization with `--fix`.

Files changed:
- `src/types/prd.ts`
- `src/core/prd-parser.ts`
- `src/core/prd-validator.ts`
- `src/core/config.ts`
- `src/commands/prd-validate.ts`
- `tests/prd-parser-validator.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/prd-parser-validator.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- `--fix` intentionally performs only safe status normalization.

Next PRD:
- `prd-004-state-events-locking.md`

## prd-004-state-events-locking

Status: complete

Summary:
- Expanded the durable state model for runner and per-PRD state.
- Added atomic state writes, backup creation, schema migration placeholder, and corrupted-state preservation.
- Added append-only NDJSON event writing, reading, and filtering.
- Added lock acquisition, release, conflict detection, and stale-lock replacement.

Files changed:
- `src/types/state.ts`
- `src/types/event.ts`
- `src/core/state.ts`
- `src/core/events.ts`
- `src/core/lock.ts`
- `tests/state-events-lock.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/state-events-lock.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Corrupted state is preserved and reported; full event-based recovery will be handled by reconciliation/resume work.

Next PRD:
- `prd-005-state-machine-scheduler.md`

## prd-005-state-machine-scheduler

Status: complete

Summary:
- Added explicit PRD status transitions from the spec.
- Implemented transition validation, timestamp updates, state writes, and `prd.status_changed` events.
- Added PRD state initialization from parsed PRDs.
- Implemented the serial scheduler with dependency ordering and `--from`/`--only` filters.

Files changed:
- `src/core/state-machine.ts`
- `src/core/scheduler.ts`
- `tests/state-machine-scheduler.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/state-machine-scheduler.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Scheduler intentionally remains serial for v0.1.0.

Next PRD:
- `prd-006-git-wrapper-branches.md`

## prd-006-git-wrapper-branches

Status: complete

Summary:
- Added a structured Git command runner with stdout, stderr, exit code, cwd, and timeout handling.
- Added helpers for repository root, current branch, clean working tree, branch existence, and branch commits.
- Added deterministic PRD branch naming and branch creation from `main`.
- Added safe branch reuse and conflict detection.
- Covered behavior with temporary Git repository tests.

Files changed:
- `src/git/git.ts`
- `src/git/branches.ts`
- `tests/git-branches.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/git-branches.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Existing branch reuse is controlled by caller intent; runner state ownership checks will be enforced in the runner/reconciliation layer.

Next PRD:
- `prd-007-worktrees.md`

## prd-007-worktrees

Status: complete

Summary:
- Added deterministic worktree paths under `.pi/prd-runner/worktrees`.
- Implemented PRD worktree creation and clean reuse.
- Added dirty worktree and wrong-branch detection.
- Added optional worktree removal helper.
- Covered worktree behavior with temporary Git repository tests.

Files changed:
- `src/git/worktrees.ts`
- `tests/worktrees.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/worktrees.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Worktree cleanup remains opt-in, matching the v0.1.0 default to keep worktrees after merge.

Next PRD:
- `prd-008-diff-artifacts-checks.md`
