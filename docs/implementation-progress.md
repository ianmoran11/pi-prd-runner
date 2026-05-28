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

## prd-008-diff-artifacts-checks

Status: complete

Summary:
- Added Git diff, changed-file, and diff-stat helpers.
- Added run/PRD/attempt artifact path helpers and writers for diff, changed files, metadata, placeholders, and stuck reports.
- Added structured local check execution with stdout/stderr, status, exit code, duration, and timeout tracking.
- Added check result Markdown artifact generation.

Files changed:
- `src/git/diff.ts`
- `src/types/artifact.ts`
- `src/core/artifacts.ts`
- `src/checks/check-runner.ts`
- `tests/diff-artifacts-checks.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/diff-artifacts-checks.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Check commands execute locally through the shell; no remote CI integration is implemented for v0.1.0.

Next PRD:
- `prd-009-agent-prompts-schemas.md`

## prd-009-agent-prompts-schemas

Status: complete

Summary:
- Added typed review and implementation result models.
- Added Zod schemas for review decisions, acceptance-criterion statuses, risks, and review JSON.
- Added review JSON extraction and validation helpers.
- Added implementation, review, and revision prompt rendering functions.
- Added prompt template files and PRD implementation/review skills.

Files changed:
- `src/types/review.ts`
- `src/agents/schemas.ts`
- `src/agents/prompts.ts`
- `prompts/*.md`
- `skills/prd-implementation/SKILL.md`
- `skills/prd-review/SKILL.md`
- `tests/agent-prompts-schemas.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/agent-prompts-schemas.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Prompt renderers are file-independent for local testability; template files remain packaged as host-facing reference prompts.

Next PRD:
- `prd-010-agent-orchestration.md`

## prd-010-agent-orchestration

Status: complete

Summary:
- Added implementation and revision agent session orchestration through `PiHost.runAgentSession`.
- Added review session orchestration with `freshContext: true`.
- Passed PRD, diff, changed files, summaries, and test results through rendered prompts.
- Added structured review JSON parsing and one repair attempt for malformed output.
- Covered implementation success, approved review, changes requested, blocked review, and malformed review repair with `MockHost`.

Files changed:
- `src/agents/implementation-agent.ts`
- `src/agents/review-agent.ts`
- `tests/agent-orchestration.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/agent-orchestration.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Real Pi agent execution remains behind the typed host adapter; local tests use `MockHost`.

Next PRD:
- `prd-011-core-runner-loop.md`

## prd-011-core-runner-loop

Status: complete

Summary:
- Added the serial core runner loop with config/state loading, lock handling, PRD validation, branch/worktree setup, attempts, artifacts, checks, review, revisions, and stuck handling.
- Implemented immediate revisions for failed checks and review changes.
- Enforced maximum review cycles.
- Added run summaries.
- Extended `MockHost` with an agent session handler for integration-style tests.

Files changed:
- `src/core/runner.ts`
- `src/core/host.ts`
- `src/core/artifacts.ts`
- `tests/core-runner-loop.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/core-runner-loop.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Approved PRDs stop at `approved`; merge behavior is implemented in the next PRD.

Next PRD:
- `prd-012-merge.md`

## prd-012-merge

Status: complete

Summary:
- Added squash merge helper with target checkout, clean-tree check, merge conflict detection, abort/reset fallback, commit creation, and merge commit recording.
- Integrated merge behavior into the runner after reviewer approval.
- Implemented auto-mode default merge, supervised prompt-before-merge, and `--no-auto-merge`.
- Added merge events and merge-conflict stuck handling.

Files changed:
- `src/git/merge.ts`
- `src/git/git.ts`
- `src/core/runner.ts`
- `tests/merge.test.ts`
- `tests/core-runner-loop.test.ts`
- `docs/implementation-progress.md`

Tests run:
- `npm test -- tests/merge.test.ts`
- `npm run typecheck`
- `npm test`

Known limitations:
- Supervised diff/report prompt choices are logged and deferred to the supervised controls PRD.

Next PRD:
- `prd-013-commands-run-resume-status.md`
