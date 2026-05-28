# pi-prd-runner

`pi-prd-runner` is a local-first Pi package for executing a project from Markdown PRDs. It reads PRDs from `docs/prds`, creates one Git branch and one Git worktree per PRD, runs implementation/check/review cycles through a host agent adapter, and merges approved work into `main`.

The v0.1.0 implementation is intentionally local-only and serial. There is no GitHub PR creation, remote CI integration, parallel scheduler, or hosted dashboard.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js prd-init --with-example
node dist/cli.js prd-validate
node dist/cli.js prd-run --mode supervised
```

For auto mode:

```bash
node dist/cli.js prd-run --mode auto
```

Auto mode merges approved PRD branches into `main` by default. Use `--no-auto-merge` to leave approved branches unmerged.

## Commands

- `/prd-init [--force] [--with-example]`
- `/prd-run [--mode supervised|auto] [--from prd-id] [--only prd-id] [--max-review-cycles n] [--no-auto-merge]`
- `/prd-resume [--mode supervised|auto]`
- `/prd-status [--json] [--verbose]`
- `/prd-dashboard [--compact] [--verbose]`
- `/prd-validate [--fix] [--strict]`
- `/prd-stop [--now]`
- `/prd-retry [prd-id] [--reason "..."]`
- `/prd-skip prd-id [--reason "..."]`
- `/prd-mark-stuck prd-id [--reason "..."]`

The package also provides a local CLI. Slash names can be passed with or without the leading slash, for example `pi-prd-runner prd-status`.

## PRD Format

PRDs live in `docs/prds` and match `prd-*.md` by default. Each PRD must include YAML frontmatter and required sections:

```markdown
---
id: prd-001-auth
title: Email/password authentication
status: pending
depends_on: []
risk: medium
max_review_cycles: 5
---

## Goal

## Scope

Included:
- ...

Excluded:
- ...

## Acceptance criteria

- [ ] ...
```

`/prd-validate` checks required frontmatter, supported statuses, required sections, acceptance criteria, clear included/excluded scope, dependency existence, and dependency cycles.

## Configuration

`/prd-init` writes `.pi/prd-runner/config.yml`. Defaults include:

- PRD directory: `docs/prds`
- base branch: `main`
- branch prefix: `pi/`
- worktree directory: `.pi/prd-runner/worktrees`
- mode: `supervised`
- max review cycles: `5`
- merge strategy: squash
- auto mode auto-merge: `true`
- supervised mode auto-merge: `false`

## Workflow

1. Load and validate PRDs.
2. Select the next eligible PRD serially.
3. Create or reuse branch `pi/<prd-id>`.
4. Create or reuse worktree `.pi/prd-runner/worktrees/<prd-id>`.
5. Run the implementation agent through `PiHost.runAgentSession`.
6. Write attempt artifacts under `.pi/prd-runner/runs/<run-id>/<prd-id>/attempt-###`.
7. Run configured checks locally.
8. Run a fresh review agent session.
9. Revise immediately on failed checks or review changes.
10. Mark stuck after the maximum attempts.
11. Merge approved PRDs into `main` when mode/config says to merge.

## Supervised Mode

Supervised mode pauses at configured gates such as before a PRD, after implementation, after failed checks, and before merge. Controls include continue, merge, view diff, view report, retry, skip, pause, and quit. View actions go through the host abstraction so Pi can render them in its UI while local use falls back to console output.

## Auto Mode

Auto mode continues through eligible PRDs serially. It automatically revises after failed checks or review changes, automatically merges approved branches into `main` by default, and stops safely on invalid PRDs, stuck PRDs, merge conflicts, or max review cycles.

## Worktrees And Merge

Each PRD uses exactly one branch and one worktree. Branches are created from `main` using the default prefix `pi/`. Worktrees are kept after merge by default.

Approved PRDs are merged with:

```bash
git checkout main
git merge --squash pi/<prd-id>
git commit -m "<PRD title>"
```

Merge conflicts are aborted when possible, the PRD is marked stuck, and a stuck report is written.

## Artifacts

Runtime metadata is stored in `.pi/prd-runner`:

- `state.json`
- `events.ndjson`
- `lock`
- `runs/<run-id>/run-summary.md`
- `runs/<run-id>/<prd-id>/attempt-###/implementation-summary.md`
- `runs/<run-id>/<prd-id>/attempt-###/review-report.md`
- `runs/<run-id>/<prd-id>/attempt-###/review-result.json`
- `runs/<run-id>/<prd-id>/attempt-###/test-results.md`
- `runs/<run-id>/<prd-id>/attempt-###/changed-files.md`
- `runs/<run-id>/<prd-id>/attempt-###/diff.patch`
- `runs/<run-id>/<prd-id>/attempt-###/metadata.json`
- `runs/<run-id>/<prd-id>/attempt-###/stuck-report.md`

## Recovery

Use `/prd-status` to inspect current state and `/prd-resume` to reconcile state against PRD files, branches, and worktrees before continuing. State writes are atomic and preserve backups. Corrupted state files are copied aside before reporting an error.

## Host Adapter

Core orchestration is independent from Pi runtime APIs. `ConsoleHost` and `MockHost` run locally; `PiExtensionHost` is a thin adapter boundary with a TODO for concrete Pi command/dashboard APIs once available. Agent execution is isolated behind `PiHost.runAgentSession`.

## Known Limitations

- Local-only execution; no GitHub PRs or remote CI.
- Serial scheduling only.
- No protected-path policy enforcement beyond local checks.
- No cloud state sync or multi-repository orchestration.
- Pi runtime command/dashboard integration awaits the concrete host API; core logic and tests are complete without it.

