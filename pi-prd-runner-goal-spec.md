# `/goal` Implementation Spec: `pi-prd-runner`

This file is optimized to be used as the source-of-truth document for a Pi `/goal` session that implements the full `pi-prd-runner` project.

The intended outcome is a working Pi package that lets a coding agent execute a project by processing a serial queue of PRD files in `docs/prds`, using one Git worktree and one branch per PRD, with implementation/review loops, a TUI dashboard, durable `.pi` metadata, review artifacts, supervised mode, and auto mode.

---

## 0. Suggested `/goal` prompt

Use this prompt from the root of the repository where the package should be implemented:

```text
/goal Implement the complete `pi-prd-runner` package described in `pi-prd-runner-goal-spec.md`. Treat that file as the source of truth. Build the project incrementally, PRD by PRD, following the implementation backlog in Section 18. For each PRD: plan briefly, implement the smallest practical slice, add or update tests, run checks, commit or clearly stage the finished unit if committing is unavailable, and update `docs/implementation-progress.md`. Keep the core runner independent from Pi host APIs behind adapters so the package is testable locally. Use Git worktrees for the PRD-runner product behavior. Implement local-only serial execution for v0.1.0. Auto mode must auto-merge approved PRD branches into `main` by default. Stop only when the v0.1.0 acceptance criteria are met, or when blocked by a missing/unknown Pi API; if blocked, document the exact missing API, implement the closest typed adapter/mock, and leave a clear TODO.
```

If `/goal` opens a setup interview, answer with:

```text
Outcome: a working v0.1.0 implementation of `pi-prd-runner`.
Done criteria: all acceptance criteria in Section 17 pass; commands are implemented; tests pass; README and examples exist.
Decision style: make reasonable engineering decisions without asking unless a choice would invalidate the spec.
Ask-before boundaries: ask before deleting user files, force-resetting branches, or overwriting existing non-generated files. Otherwise proceed.
Execution style: serial, incremental, test-driven where practical, commit after each completed PRD-sized unit.
```

---

## 1. High-level objective

Build `pi-prd-runner`, a Pi package that orchestrates agentic implementation of a project from PRD files.

The package must support this workflow:

1. The implementing agent checks out or creates a PRD-specific branch in a PRD-specific Git worktree.
2. The implementing agent reads one PRD from `docs/prds`, implements only that PRD, writes implementation artifacts, and updates `.pi/prd-runner` metadata through the runner.
3. The runner executes configured checks.
4. The reviewing agent uses a fresh context to review the diff against the PRD.
5. If the reviewer approves, the runner merges the branch into `main` and updates metadata.
6. If the reviewer requests revisions, the runner immediately sends the required revisions back to the implementation agent.
7. The loop repeats until approved or until the PRD exceeds the maximum revision count.
8. A TUI dashboard shows queue status, current stage, attempts, checks, latest review decision, and controls.
9. In supervised mode, the user presses Enter or selects options at key gates.
10. In auto mode, the system progresses through PRDs until the project is finished or the current PRD is stuck.

---

## 2. Required product decisions

These are fixed decisions and must not be changed without updating this spec.

- PRDs live in `docs/prds`.
- Work must use Git worktrees.
- One branch per PRD.
- One worktree per PRD.
- v1 is local-only; no GitHub PRs or remote review integrations.
- v1 is serial; no parallel PRD execution.
- Reviewer approval alone is sufficient for approval.
- Failed checks trigger immediate revision, not review.
- Auto mode automatically merges approved PRD branches into `main` by default.
- Supervised mode asks before merging by default.
- Agents have full permissions by default.
- Default maximum revision/check-failure cycles is `5`.
- Default target branch is `main`.
- Default branch prefix is `pi/`.
- Default merge strategy is squash merge.
- Raw logs and run artifacts are stored under `.pi/prd-runner`.

---

## 3. Non-goals for v0.1.0

Do not implement these in v0.1.0 unless all required work is already complete:

- Parallel PRD execution.
- GitHub PR creation.
- Remote CI integration.
- Multi-reviewer approval.
- CODEOWNERS integration.
- Hosted dashboard.
- Cloud state sync.
- Multi-repository orchestration.
- Advanced protected-path policy enforcement.
- Dependency graph scheduler beyond simple dependency ordering.
- Complex permission sandboxing.

---

## 4. Package shape

Target package layout:

```text
pi-prd-runner/
  package.json
  tsconfig.json
  README.md

  src/
    extension.ts

    commands/
      prd-init.ts
      prd-run.ts
      prd-resume.ts
      prd-status.ts
      prd-dashboard.ts
      prd-validate.ts
      prd-stop.ts
      prd-retry.ts
      prd-skip.ts
      prd-mark-stuck.ts

    core/
      config.ts
      state.ts
      events.ts
      lock.ts
      prd-parser.ts
      prd-validator.ts
      scheduler.ts
      state-machine.ts
      runner.ts
      attempts.ts
      artifacts.ts
      reconciliation.ts
      host.ts

    git/
      git.ts
      branches.ts
      worktrees.ts
      merge.ts
      diff.ts

    checks/
      checks.ts
      check-runner.ts

    agents/
      implementation-agent.ts
      review-agent.ts
      prompts.ts
      schemas.ts

    dashboard/
      dashboard.ts
      dashboard-model.ts
      dashboard-renderer.ts

    types/
      config.ts
      state.ts
      prd.ts
      review.ts
      artifact.ts
      event.ts
      host.ts

  skills/
    prd-implementation/
      SKILL.md
    prd-review/
      SKILL.md

  prompts/
    implement-prd.md
    review-prd.md
    revise-prd.md
    summarize-implementation.md

  templates/
    config.yml
    prd-template.md
    implementation-summary.md
    review-report.md
    stuck-report.md

  docs/
    implementation-progress.md
    examples/
      prds/
        prd-001-example.md
        prd-002-example.md
      artifacts/
        implementation-summary.md
        review-report.md
        stuck-report.md
```

The exact test framework may be chosen by the implementer. Prefer Vitest for TypeScript unless the repository already has a standard test setup.

---

## 5. Host/API abstraction requirement

The implementation must keep the core runner independent from Pi-specific APIs.

Create a host abstraction such as:

```ts
export interface PiHost {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  prompt?(prompt: PromptSpec): Promise<PromptResult>;
  registerCommand?(command: CommandSpec): void;
  renderDashboard?(model: DashboardModel): void;
  runAgentSession?(spec: AgentSessionSpec): Promise<AgentSessionResult>;
}
```

Required host implementations:

- `ConsoleHost` for local tests and fallback behavior.
- `PiExtensionHost` or equivalent thin adapter for Pi runtime integration.
- `MockHost` for tests.

If the exact Pi API is unknown or unavailable, implement the typed adapter with clear TODOs and keep all business logic testable through `ConsoleHost` and `MockHost`.

---

## 6. Public commands

Implement these slash commands, using the exact command names below.

### 6.1 `/prd-init`

Initializes the project metadata.

Forms:

```text
/prd-init
/prd-init --force
/prd-init --with-example
```

Creates:

```text
docs/prds/
.pi/prd-runner/config.yml
.pi/prd-runner/state.json
.pi/prd-runner/events.ndjson
.pi/prd-runner/runs/
.pi/prd-runner/worktrees/
```

Rules:

- Do not overwrite existing files unless `--force` is supplied.
- `--with-example` writes `docs/prds/prd-001-example.md`.
- The command is idempotent.

### 6.2 `/prd-run`

Runs the PRD queue.

Forms:

```text
/prd-run
/prd-run --mode supervised
/prd-run --mode auto
/prd-run --from prd-003
/prd-run --only prd-003
/prd-run --max-review-cycles 5
/prd-run --no-auto-merge
```

Defaults:

```yaml
mode: supervised
maxReviewCycles: 5
autoMergeInAutoMode: true
autoMergeInSupervisedMode: false
```

### 6.3 `/prd-resume`

Resumes an interrupted run.

Forms:

```text
/prd-resume
/prd-resume --mode auto
/prd-resume --mode supervised
```

Behavior:

- Loads state.
- Reconciles state with Git.
- Reacquires lock.
- Continues from the last safe point.

### 6.4 `/prd-status`

Shows current runner state.

Forms:

```text
/prd-status
/prd-status --json
/prd-status --verbose
```

Must show:

- Current run ID.
- Mode.
- Current PRD.
- Current branch.
- Current worktree.
- Current stage.
- Attempt count.
- Completed PRDs.
- Stuck PRDs.
- Latest event.

### 6.5 `/prd-dashboard`

Starts or focuses the TUI dashboard.

Forms:

```text
/prd-dashboard
/prd-dashboard --compact
/prd-dashboard --verbose
```

### 6.6 `/prd-validate`

Validates PRD files.

Forms:

```text
/prd-validate
/prd-validate --fix
/prd-validate --strict
```

### 6.7 `/prd-stop`

Stops the current run safely.

Forms:

```text
/prd-stop
/prd-stop --now
```

### 6.8 `/prd-retry`

Retries the current or selected PRD.

Forms:

```text
/prd-retry
/prd-retry prd-003
/prd-retry prd-003 --reason "Tests failed after migration change"
```

### 6.9 `/prd-skip`

Skips a PRD.

Forms:

```text
/prd-skip prd-003
/prd-skip prd-003 --reason "Out of scope for current release"
```

### 6.10 `/prd-mark-stuck`

Marks a PRD stuck.

Forms:

```text
/prd-mark-stuck prd-003
/prd-mark-stuck prd-003 --reason "Exceeded revision limit"
```

---

## 7. Target project metadata layout

When the package is used inside a target project, the runner creates this structure:

```text
project/
  docs/
    prds/
      prd-001-auth.md
      prd-002-password-reset.md
      prd-003-email-verification.md

  .pi/
    prd-runner/
      config.yml
      state.json
      events.ndjson
      lock
      worktrees/
        prd-001-auth/
        prd-002-password-reset/
      runs/
        2026-05-28T10-21-00Z/
          run-summary.md
          prd-001-auth/
            attempt-001/
              implementation-summary.md
              review-report.md
              review-result.json
              test-results.md
              changed-files.md
              diff.patch
              metadata.json
            attempt-002/
              implementation-summary.md
              review-report.md
              review-result.json
              test-results.md
              changed-files.md
              diff.patch
              metadata.json
```

---

## 8. PRD file format

Each PRD must use Markdown with frontmatter.

Example:

```markdown
---
id: prd-001-auth
title: Email/password authentication
status: pending
depends_on: []
risk: medium
max_review_cycles: 5
---

# PRD-001: Email/password authentication

## Goal

Implement email/password authentication.

## Scope

Included:
- Sign-up endpoint
- Login endpoint
- Password hashing
- Session creation

Excluded:
- Password reset
- OAuth
- Email verification

## Acceptance criteria

- [ ] Users can create an account with email and password.
- [ ] Passwords are hashed before storage.
- [ ] Duplicate emails are rejected.
- [ ] Users can log in with valid credentials.
- [ ] Invalid credentials return a safe generic error.
- [ ] Tests cover success and failure paths.

## Required checks

```bash
npm test
npm run lint
```

## Files likely to change

- `src/auth/**`
- `src/users/**`
- `tests/auth/**`

## Reviewer checklist

- No plaintext passwords.
- No leaking whether an email exists during login.
- No out-of-scope password reset work.
```

---

## 9. PRD validation rules

A PRD is valid if:

- [ ] It has frontmatter.
- [ ] It has a unique `id`.
- [ ] It has a `title`.
- [ ] It has a supported `status`.
- [ ] It has a `depends_on` list.
- [ ] It has a `Goal` section.
- [ ] It has a `Scope` section.
- [ ] It has an `Acceptance criteria` section.
- [ ] It has at least one acceptance criterion.
- [ ] It has clear included scope.
- [ ] It has clear excluded scope.
- [ ] Its dependencies exist.
- [ ] Its dependencies do not form a cycle.

Supported statuses:

```text
pending
ready
implementing
implemented
checking
reviewing
changes_requested
approved
merging
merged
skipped
stuck
failed
```

---

## 10. Default configuration

Write this default config to `.pi/prd-runner/config.yml`:

```yaml
schemaVersion: 1

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
```

---

## 11. State model

Initial `.pi/prd-runner/state.json`:

```json
{
  "schemaVersion": 1,
  "initialized": true,
  "activeRunId": null,
  "mode": "supervised",
  "baseBranch": "main",
  "currentPrd": null,
  "prds": {},
  "lastUpdated": null
}
```

Example active state:

```json
{
  "schemaVersion": 1,
  "initialized": true,
  "activeRunId": "2026-05-28T10-21-00Z",
  "mode": "auto",
  "baseBranch": "main",
  "currentPrd": "prd-001-auth",
  "prds": {
    "prd-001-auth": {
      "id": "prd-001-auth",
      "path": "docs/prds/prd-001-auth.md",
      "title": "Email/password authentication",
      "status": "reviewing",
      "branch": "pi/prd-001-auth",
      "worktree": ".pi/prd-runner/worktrees/prd-001-auth",
      "attempt": 2,
      "maxReviewCycles": 5,
      "lastReviewDecision": "changes_requested",
      "lastCheckStatus": "passed",
      "mergeCommit": null,
      "startedAt": "2026-05-28T10:21:00+10:00",
      "lastUpdated": "2026-05-28T10:44:12+10:00"
    }
  },
  "lastUpdated": "2026-05-28T10:44:12+10:00"
}
```

---

## 12. Event log

`.pi/prd-runner/events.ndjson` is append-only.

Example events:

```jsonl
{"ts":"2026-05-28T10:21:00+10:00","type":"run.started","runId":"2026-05-28T10-21-00Z","mode":"auto"}
{"ts":"2026-05-28T10:21:03+10:00","type":"prd.started","prd":"prd-001-auth"}
{"ts":"2026-05-28T10:21:05+10:00","type":"worktree.created","prd":"prd-001-auth","branch":"pi/prd-001-auth"}
{"ts":"2026-05-28T10:35:20+10:00","type":"implementation.completed","prd":"prd-001-auth","attempt":1}
{"ts":"2026-05-28T10:36:10+10:00","type":"checks.passed","prd":"prd-001-auth","attempt":1}
{"ts":"2026-05-28T10:40:30+10:00","type":"review.changes_requested","prd":"prd-001-auth","attempt":1}
{"ts":"2026-05-28T10:58:00+10:00","type":"review.approved","prd":"prd-001-auth","attempt":2}
{"ts":"2026-05-28T10:59:00+10:00","type":"merge.completed","prd":"prd-001-auth","branch":"pi/prd-001-auth","target":"main"}
```

Required event types:

- `run.started`
- `run.stopped`
- `run.completed`
- `run.failed`
- `prd.started`
- `prd.status_changed`
- `worktree.created`
- `worktree.reused`
- `implementation.started`
- `implementation.completed`
- `checks.started`
- `checks.passed`
- `checks.failed`
- `review.started`
- `review.approved`
- `review.changes_requested`
- `review.blocked`
- `merge.started`
- `merge.completed`
- `merge.conflict`
- `prd.stuck`
- `prd.skipped`

---

## 13. State machine

Valid transitions:

```text
pending → ready
ready → implementing
implementing → implemented
implemented → checking
checking → reviewing
checking → changes_requested
reviewing → approved
reviewing → changes_requested
reviewing → stuck
changes_requested → implementing
approved → merging
merging → merged
pending → skipped
ready → skipped
any → failed
any → stuck
```

Invalid transitions must throw or return a structured error. All valid transitions must update timestamps and append an event.

---

## 14. Worktree behavior

For each PRD:

1. Ensure the repository exists and has a `main` branch.
2. Ensure the current working tree is clean unless the dirty state belongs to `.pi/prd-runner` generated files.
3. Generate branch name: `pi/<prd-id>`.
4. Create branch from `main`:

```bash
git branch pi/prd-001-auth main
```

5. Create worktree:

```bash
git worktree add .pi/prd-runner/worktrees/prd-001-auth pi/prd-001-auth
```

6. Run implementation, checks, review, and artifact generation inside the PRD worktree.
7. Merge branch to `main` only after reviewer approval.
8. Keep worktree after merge by default.
9. Allow future cleanup option but do not require cleanup in v0.1.0.

---

## 15. Merge behavior

### 15.1 Supervised mode

Default:

```yaml
autoMerge: false
```

When reviewer approves, pause and show:

```text
PRD prd-001-auth approved.

Options:
  Enter  merge into main
  d      view diff
  r      request another review
  s      skip merge
  q      stop
```

### 15.2 Auto mode

Default:

```yaml
autoMerge: true
```

When reviewer approves:

1. Checkout `main`.
2. Squash merge approved branch.
3. Commit with PRD title.
4. Update state.
5. Mark PRD `merged`.
6. Continue to next PRD.

Default merge commands:

```bash
git checkout main
git merge --squash pi/prd-001-auth
git commit -m "PRD-001: Email/password authentication"
```

If merge conflict occurs:

- Abort merge when possible.
- Mark PRD stuck.
- Write a stuck/merge-conflict report.
- Stop auto mode.
- Prompt in supervised mode.

---

## 16. Agent behavior

### 16.1 Implementation agent

The implementation agent must:

- Read the current PRD.
- Implement only the current PRD.
- Avoid future PRD scope.
- Run required checks when possible.
- Write implementation artifacts.
- Be honest about incomplete work.
- Commit changes to the PRD branch when committing is available.

Required artifacts:

```text
implementation-summary.md
test-results.md
changed-files.md
diff.patch
metadata.json
```

### 16.2 Reviewing agent

The reviewing agent must:

- Use a fresh context.
- Assess the diff against the PRD.
- Check every acceptance criterion.
- Decide `approved`, `changes_requested`, or `blocked`.
- Write structured JSON and a Markdown review report.
- Avoid modifying implementation files.

Required artifacts:

```text
review-report.md
review-result.json
```

Required JSON shape:

```json
{
  "decision": "approved | changes_requested | blocked",
  "summary": "...",
  "acceptanceCriteria": [
    {
      "criterion": "...",
      "status": "passed | failed | unclear",
      "evidence": "..."
    }
  ],
  "requiredRevisions": [],
  "optionalSuggestions": [],
  "risk": "low | medium | high"
}
```

Reviewer approval alone is sufficient for approval.

---

## 17. Acceptance criteria for v0.1.0

The package is ready for v0.1.0 when all of these are true:

- [ ] `/prd-init` creates the expected directory structure.
- [ ] `/prd-init --with-example` creates an example PRD.
- [ ] PRDs are loaded from `docs/prds` by default.
- [ ] `/prd-validate` catches missing required sections.
- [ ] `/prd-run --mode supervised` can run one PRD through implementation, review, and merge.
- [ ] `/prd-run --mode auto` can run multiple PRDs serially.
- [ ] Auto mode automatically merges approved PRDs into `main` by default.
- [ ] `--no-auto-merge` prevents automatic merge in auto mode.
- [ ] Each PRD uses one branch.
- [ ] Each PRD uses one worktree.
- [ ] Failed checks immediately trigger revision.
- [ ] Review changes immediately trigger revision.
- [ ] Reviewer approval alone is sufficient for merge.
- [ ] A PRD becomes stuck after 5 failed/revision attempts by default.
- [ ] State is written to `.pi/prd-runner/state.json`.
- [ ] Events are appended to `.pi/prd-runner/events.ndjson`.
- [ ] Artifacts are written under `.pi/prd-runner/runs`.
- [ ] `/prd-resume` can continue an interrupted run.
- [ ] `/prd-status` shows current state.
- [ ] `/prd-dashboard` shows current queue, stage, checks, review decision, and controls.
- [ ] `/prd-stop` can stop a run safely.
- [ ] `/prd-retry` can retry the current or specified PRD.
- [ ] `/prd-skip` can mark a PRD skipped.
- [ ] `/prd-mark-stuck` can mark a PRD stuck.
- [ ] The package works locally without GitHub integration.
- [ ] The package processes PRDs serially.
- [ ] The core runner is testable without Pi runtime APIs.
- [ ] Documentation explains the full workflow.
- [ ] Tests pass.
- [ ] Lint and typecheck pass if configured.

---

## 18. Implementation backlog for `/goal`

Work through these PRDs in order. Each section is intentionally small enough to complete, test, and commit independently.

When the agent completes a PRD-sized section, update `docs/implementation-progress.md` with:

- PRD ID.
- Summary of work completed.
- Files changed.
- Tests run.
- Any known limitations.
- Next PRD.

### `prd-001-package-skeleton.md` — package scaffold

Goal: create a functioning TypeScript package skeleton with command placeholders.

Tasks:

- [ ] Create `package.json`.
- [ ] Add TypeScript dependency and config.
- [ ] Add test framework.
- [ ] Add lint/typecheck scripts if practical.
- [ ] Create `src/extension.ts`.
- [ ] Create command directory.
- [ ] Add placeholder command modules for all public commands.
- [ ] Add `src/core/host.ts` with host interfaces.
- [ ] Add `ConsoleHost` fallback.
- [ ] Add `MockHost` for tests.
- [ ] Add `README.md` stub.
- [ ] Add `docs/implementation-progress.md`.
- [ ] Add smoke test that package imports without error.
- [ ] Run tests.

Acceptance criteria:

- [ ] Package installs.
- [ ] TypeScript compiles.
- [ ] Smoke test passes.
- [ ] All command modules exist.

---

### `prd-002-config-init.md` — configuration and `/prd-init`

Goal: implement default config handling and initialization.

Tasks:

- [ ] Create `src/types/config.ts`.
- [ ] Create `src/core/config.ts`.
- [ ] Define `RunnerConfig`.
- [ ] Define default config matching Section 10.
- [ ] Add YAML parser/writer.
- [ ] Add config validation.
- [ ] Add config load function.
- [ ] Add config write function.
- [ ] Create `templates/config.yml`.
- [ ] Create `templates/prd-template.md`.
- [ ] Implement `/prd-init` command.
- [ ] Create `docs/prds`.
- [ ] Create `.pi/prd-runner`.
- [ ] Create `.pi/prd-runner/runs`.
- [ ] Create `.pi/prd-runner/worktrees`.
- [ ] Write default `config.yml`.
- [ ] Write initial `state.json`.
- [ ] Write empty `events.ndjson`.
- [ ] Support `--force`.
- [ ] Support `--with-example`.
- [ ] Prevent accidental overwrite without `--force`.
- [ ] Add tests for fresh init.
- [ ] Add tests for idempotent init.
- [ ] Add tests for force init.
- [ ] Add tests for example PRD creation.

Acceptance criteria:

- [ ] `/prd-init` creates required directories and files.
- [ ] `/prd-init` is idempotent.
- [ ] `/prd-init --with-example` creates a valid example PRD.
- [ ] Config defaults match Section 10.

---

### `prd-003-prd-parser-validator.md` — PRD parsing and validation

Goal: load and validate PRD files from `docs/prds`.

Tasks:

- [ ] Create `src/types/prd.ts`.
- [ ] Create `src/core/prd-parser.ts`.
- [ ] Read PRD files from configurable directory.
- [ ] Match configurable glob pattern.
- [ ] Parse frontmatter.
- [ ] Extract body.
- [ ] Extract `Goal` section.
- [ ] Extract `Scope` section.
- [ ] Extract acceptance criteria.
- [ ] Extract required checks.
- [ ] Extract reviewer checklist.
- [ ] Normalize PRD IDs.
- [ ] Sort PRDs by filename.
- [ ] Create `src/core/prd-validator.ts`.
- [ ] Validate required frontmatter fields.
- [ ] Validate unique IDs.
- [ ] Validate supported statuses.
- [ ] Validate `depends_on` list.
- [ ] Validate dependency existence.
- [ ] Validate dependency cycles.
- [ ] Validate required sections.
- [ ] Validate at least one acceptance criterion.
- [ ] Implement `/prd-validate`.
- [ ] Support `--strict`.
- [ ] Support `--fix` only for safe fixes such as status normalization.
- [ ] Add parser tests.
- [ ] Add validator tests.

Acceptance criteria:

- [ ] Valid PRDs parse correctly.
- [ ] Invalid PRDs produce clear validation errors.
- [ ] `/prd-validate` displays useful human-readable output.
- [ ] `/prd-validate --strict` fails on warnings.

---

### `prd-004-state-events-locking.md` — state, events, and locking

Goal: implement durable state, append-only events, and a lock file.

Tasks:

- [ ] Create `src/types/state.ts`.
- [ ] Create `src/types/event.ts`.
- [ ] Create `src/core/state.ts`.
- [ ] Define `RunnerState`.
- [ ] Define `PrdState`.
- [ ] Implement state loader.
- [ ] Implement atomic state writer.
- [ ] Write backup before state overwrite.
- [ ] Add schema version.
- [ ] Add migration placeholder.
- [ ] Create `src/core/events.ts`.
- [ ] Define event union type.
- [ ] Implement append-only NDJSON writer.
- [ ] Implement event reader.
- [ ] Implement filtering by run ID and PRD.
- [ ] Create `src/core/lock.ts`.
- [ ] Implement lock acquisition.
- [ ] Implement lock release.
- [ ] Store PID and timestamp.
- [ ] Detect stale lock.
- [ ] Add tests for state load/write.
- [ ] Add tests for corrupted state handling.
- [ ] Add tests for event append/read.
- [ ] Add tests for lock acquisition/conflict/stale lock.

Acceptance criteria:

- [ ] State writes are atomic.
- [ ] Event log is append-only.
- [ ] Concurrent runs are prevented by lock.
- [ ] Stale locks can be detected.

---

### `prd-005-state-machine-scheduler.md` — transitions and PRD scheduling

Goal: implement explicit state transitions and serial PRD selection.

Tasks:

- [ ] Create `src/core/state-machine.ts`.
- [ ] Define supported statuses.
- [ ] Define allowed transitions from Section 13.
- [ ] Implement `transitionPrd`.
- [ ] Reject invalid transitions.
- [ ] Emit transition events.
- [ ] Update timestamps.
- [ ] Create `src/core/scheduler.ts`.
- [ ] Select next pending/ready PRD.
- [ ] Respect dependency order.
- [ ] Skip merged PRDs.
- [ ] Skip skipped PRDs.
- [ ] Skip stuck PRDs.
- [ ] Support `--from`.
- [ ] Support `--only`.
- [ ] Detect no eligible PRDs.
- [ ] Add transition tests.
- [ ] Add scheduler tests.

Acceptance criteria:

- [ ] Invalid transitions fail.
- [ ] Scheduler picks the expected PRD.
- [ ] Dependency order is respected.
- [ ] `--from` and `--only` work.

---

### `prd-006-git-wrapper-branches.md` — Git command wrapper and branches

Goal: implement robust Git operations for branches and repository inspection.

Tasks:

- [ ] Create `src/git/git.ts`.
- [ ] Implement Git command runner.
- [ ] Capture stdout.
- [ ] Capture stderr.
- [ ] Capture exit code.
- [ ] Support working directory.
- [ ] Support timeouts.
- [ ] Add helper for repo root.
- [ ] Add helper for current branch.
- [ ] Add helper for clean working tree.
- [ ] Add helper to check branch exists.
- [ ] Create `src/git/branches.ts`.
- [ ] Generate branch name from PRD ID.
- [ ] Sanitize PRD IDs.
- [ ] Create branch from `main`.
- [ ] Reuse existing branch when safe.
- [ ] Detect conflicting existing branch.
- [ ] Add tests with temporary Git repositories.

Acceptance criteria:

- [ ] Git wrapper returns structured results.
- [ ] Branch names are deterministic.
- [ ] Existing safe branches can be reused.
- [ ] Conflicting branches are detected.

---

### `prd-007-worktrees.md` — worktree management

Goal: create and reuse one worktree per PRD.

Tasks:

- [ ] Create `src/git/worktrees.ts`.
- [ ] Generate worktree path from PRD ID.
- [ ] Check whether worktree exists.
- [ ] Create worktree for PRD branch.
- [ ] Reuse worktree when branch matches.
- [ ] Detect dirty worktree.
- [ ] Detect wrong branch in worktree.
- [ ] Implement optional removal helper.
- [ ] Add tests for worktree creation.
- [ ] Add tests for worktree reuse.
- [ ] Add tests for dirty worktree.
- [ ] Add tests for wrong-branch worktree.

Acceptance criteria:

- [ ] Each PRD gets a worktree under `.pi/prd-runner/worktrees`.
- [ ] Worktree reuse is safe.
- [ ] Dirty or mismatched worktrees are reported.

---

### `prd-008-diff-artifacts-checks.md` — diff, artifacts, and checks

Goal: generate review artifacts and run configured checks.

Tasks:

- [ ] Create `src/git/diff.ts`.
- [ ] Generate diff against `main`.
- [ ] Generate changed files list.
- [ ] Generate diff stat summary.
- [ ] Create `src/core/artifacts.ts`.
- [ ] Generate run directory.
- [ ] Generate PRD directory.
- [ ] Generate attempt directory.
- [ ] Write `diff.patch`.
- [ ] Write `changed-files.md`.
- [ ] Write `metadata.json`.
- [ ] Write `implementation-summary.md` placeholder when needed.
- [ ] Write `review-report.md` placeholder when needed.
- [ ] Write `stuck-report.md`.
- [ ] Create `src/checks/check-runner.ts`.
- [ ] Load default checks from config.
- [ ] Load PRD-specific checks from PRD.
- [ ] Run checks in worktree.
- [ ] Capture output and exit code.
- [ ] Write `test-results.md`.
- [ ] Return structured check result.
- [ ] Add tests for artifact paths.
- [ ] Add tests for diff writing.
- [ ] Add tests for passing checks.
- [ ] Add tests for failing checks.

Acceptance criteria:

- [ ] Every attempt directory includes diff, changed files, metadata, and check output.
- [ ] Failed checks are represented as structured data.
- [ ] Check runner works in a temporary project.

---

### `prd-009-agent-prompts-schemas.md` — agent prompts and review schemas

Goal: create implementation/review/revision prompts and typed schemas.

Tasks:

- [ ] Create `src/types/review.ts`.
- [ ] Create `src/agents/schemas.ts`.
- [ ] Define review decision enum.
- [ ] Define review result schema.
- [ ] Define implementation result schema where useful.
- [ ] Create `prompts/implement-prd.md`.
- [ ] Include scope-limiting instructions.
- [ ] Include artifact requirements.
- [ ] Include check requirements.
- [ ] Include commit requirement.
- [ ] Create `prompts/review-prd.md`.
- [ ] Require fresh review context.
- [ ] Require each acceptance criterion to be assessed.
- [ ] Require structured JSON.
- [ ] Create `prompts/revise-prd.md`.
- [ ] Include failed checks or required review revisions.
- [ ] Instruct agent to address only required revisions.
- [ ] Create `skills/prd-implementation/SKILL.md`.
- [ ] Create `skills/prd-review/SKILL.md`.
- [ ] Add prompt rendering functions.
- [ ] Add snapshot tests for prompts.
- [ ] Add schema validation tests.

Acceptance criteria:

- [ ] Prompts are present and specific.
- [ ] Review JSON is schema-validated.
- [ ] Malformed review output can be detected.

---

### `prd-010-agent-orchestration.md` — implementation and review sessions

Goal: orchestrate implementation and review agent sessions through host abstraction.

Tasks:

- [ ] Create `src/agents/implementation-agent.ts`.
- [ ] Create `src/agents/review-agent.ts`.
- [ ] Define `AgentSessionSpec`.
- [ ] Define `AgentSessionResult`.
- [ ] Implement implementation session call through `PiHost.runAgentSession`.
- [ ] Implement review session call through `PiHost.runAgentSession`.
- [ ] Ensure review uses fresh context/session flag where supported.
- [ ] Pass PRD content to implementation agent.
- [ ] Pass PRD, diff, changed files, implementation summary, and test results to review agent.
- [ ] Validate review JSON.
- [ ] Ask agent to repair malformed review JSON once.
- [ ] Add mock-host tests for implementation success.
- [ ] Add mock-host tests for approved review.
- [ ] Add mock-host tests for changes requested.
- [ ] Add mock-host tests for blocked review.
- [ ] Add mock-host tests for malformed review JSON.

Acceptance criteria:

- [ ] Implementation and review can be tested without real Pi runtime.
- [ ] Review sessions are logically fresh.
- [ ] Review output controls subsequent runner behavior.

---

### `prd-011-core-runner-loop.md` — main orchestration loop

Goal: implement the complete serial implementation/check/review/revision loop.

Tasks:

- [ ] Create `src/core/runner.ts`.
- [ ] Define run options.
- [ ] Load config.
- [ ] Acquire lock.
- [ ] Load state.
- [ ] Parse PRDs.
- [ ] Validate PRDs.
- [ ] Select next PRD.
- [ ] Initialize PRD state.
- [ ] Create branch.
- [ ] Create worktree.
- [ ] Create attempt directory.
- [ ] Transition to `implementing`.
- [ ] Run implementation agent.
- [ ] Generate artifacts.
- [ ] Transition to `checking`.
- [ ] Run checks.
- [ ] On failed checks, transition to `changes_requested` and immediately revise.
- [ ] On passing checks, transition to `reviewing`.
- [ ] Run review agent.
- [ ] On approval, transition to `approved`.
- [ ] On changes requested, increment attempt and revise.
- [ ] On blocked, mark stuck.
- [ ] Enforce max review cycles.
- [ ] Release lock.
- [ ] Write run summary.
- [ ] Add integration test for approval on first attempt.
- [ ] Add integration test for failed checks then approval.
- [ ] Add integration test for review changes then approval.
- [ ] Add integration test for max attempts stuck.

Acceptance criteria:

- [ ] One PRD can move through implementation, checks, review, and approval.
- [ ] Failed checks cause immediate revision.
- [ ] Review changes cause immediate revision.
- [ ] Max attempts mark stuck.

---

### `prd-012-merge.md` — merge behavior

Goal: implement supervised and automatic merges.

Tasks:

- [ ] Create `src/git/merge.ts`.
- [ ] Implement checkout of target branch.
- [ ] Ensure clean working tree before merge.
- [ ] Implement squash merge.
- [ ] Generate commit message from PRD title.
- [ ] Record merge commit hash.
- [ ] Detect merge conflict.
- [ ] Abort merge on conflict when possible.
- [ ] Write merge-conflict stuck report.
- [ ] Update state to `merging` then `merged`.
- [ ] Emit merge events.
- [ ] In supervised mode, prompt before merge.
- [ ] In auto mode, auto-merge by default.
- [ ] Respect `--no-auto-merge`.
- [ ] Add tests for successful squash merge.
- [ ] Add tests for merge conflict.
- [ ] Add tests for auto merge.
- [ ] Add tests for supervised merge prompt.
- [ ] Add tests for `--no-auto-merge`.

Acceptance criteria:

- [ ] Approved PRDs can be merged into `main`.
- [ ] Auto mode merges automatically by default.
- [ ] Merge conflicts mark PRD stuck.
- [ ] Merge commit hash is recorded.

---

### `prd-013-commands-run-resume-status.md` — run, resume, and status commands

Goal: expose the runner through public commands.

Tasks:

- [ ] Implement command argument parser.
- [ ] Implement `/prd-run`.
- [ ] Support `--mode`.
- [ ] Support `--from`.
- [ ] Support `--only`.
- [ ] Support `--max-review-cycles`.
- [ ] Support `--no-auto-merge`.
- [ ] Print run start summary.
- [ ] Print run end summary.
- [ ] Create `src/core/reconciliation.ts`.
- [ ] Check state PRDs against files.
- [ ] Check branches exist.
- [ ] Check worktrees exist.
- [ ] Check branch/worktree match.
- [ ] Repair safe state mismatches.
- [ ] Report unsafe mismatches.
- [ ] Implement `/prd-resume`.
- [ ] Implement `/prd-status`.
- [ ] Support `/prd-status --json`.
- [ ] Support `/prd-status --verbose`.
- [ ] Add tests for command parsing.
- [ ] Add tests for status output.
- [ ] Add tests for resume with no active run.
- [ ] Add tests for resume after approval before merge.

Acceptance criteria:

- [ ] `/prd-run` invokes the core runner.
- [ ] `/prd-resume` can continue from a safe state.
- [ ] `/prd-status` reports useful current state.

---

### `prd-014-dashboard.md` — TUI dashboard

Goal: implement a useful local dashboard model and renderer.

Tasks:

- [ ] Create `src/dashboard/dashboard-model.ts`.
- [ ] Convert state to dashboard model.
- [ ] Include PRD queue.
- [ ] Include current stage.
- [ ] Include attempt count.
- [ ] Include current branch.
- [ ] Include current worktree.
- [ ] Include latest check status.
- [ ] Include latest review decision.
- [ ] Include latest finding.
- [ ] Create `src/dashboard/dashboard-renderer.ts`.
- [ ] Render compact layout.
- [ ] Render verbose layout.
- [ ] Render queue panel.
- [ ] Render stage panel.
- [ ] Render latest finding panel.
- [ ] Render controls footer.
- [ ] Create `src/dashboard/dashboard.ts`.
- [ ] Implement refresh on state/event changes where host supports it.
- [ ] Implement fallback text rendering in ConsoleHost.
- [ ] Implement `/prd-dashboard`.
- [ ] Support `--compact`.
- [ ] Support `--verbose`.
- [ ] Add tests for dashboard model.
- [ ] Add rendering snapshot tests.

Dashboard target layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ pi-prd-runner          mode: auto              run: 2026-05-28-001 │
├────────────────────────────────────────────────────────────────────┤
│ Project: current repo   base: main             branch: pi/prd-001  │
│ Current PRD: prd-001-auth Email/password authentication            │
│ Stage: reviewing        Attempt: 2 / 5                             │
├───────────────────────────────┬────────────────────────────────────┤
│ PRD Queue                     │ Current Stage                      │
│ ✓ prd-000-setup               │ ✓ Preflight                        │
│ ▶ prd-001-auth                │ ✓ Implementation                   │
│ ○ prd-002-password-reset      │ ✓ Checks                           │
│ ○ prd-003-email-verification  │ ▶ Review                           │
│                               │ ○ Merge                            │
├───────────────────────────────┴────────────────────────────────────┤
│ Latest finding                                                     │
│ Reviewer requested a generic error for all invalid login attempts. │
├────────────────────────────────────────────────────────────────────┤
│ Checks: test ✓  lint ✓       Changed files: 8      Attempts: 2/5   │
│ Controls: Enter continue | d diff | r report | p pause | q quit    │
└────────────────────────────────────────────────────────────────────┘
```

Acceptance criteria:

- [ ] Dashboard shows queue, stage, attempts, checks, review decision, and controls.
- [ ] Dashboard has a console fallback.
- [ ] `/prd-dashboard` works without an active run by showing idle status.

---

### `prd-015-supervised-controls.md` — supervised prompts and controls

Goal: implement supervised pause points and user choices.

Tasks:

- [ ] Implement pause before PRD.
- [ ] Implement pause after implementation.
- [ ] Implement pause on failed checks.
- [ ] Implement pause before merge.
- [ ] Implement pause on stuck.
- [ ] Render options consistently.
- [ ] Implement continue option.
- [ ] Implement view diff option.
- [ ] Implement view report option.
- [ ] Implement retry option.
- [ ] Implement skip option.
- [ ] Implement quit option.
- [ ] Add tests for prompt branching.

Supervised control examples:

```text
Enter  continue
d      view diff
r      view latest report
s      skip PRD
m      merge approved PRD
p      pause
q      quit
```

Acceptance criteria:

- [ ] Supervised mode pauses at configured gates.
- [ ] User choices affect runner state correctly.
- [ ] View diff/report controls work through the host abstraction.

---

### `prd-016-auto-mode.md` — auto mode behavior

Goal: implement automatic progression and default auto-merge.

Tasks:

- [ ] Automatically continue to next eligible PRD.
- [ ] Automatically revise on failed checks.
- [ ] Automatically revise on changes requested.
- [ ] Automatically merge approved PRDs.
- [ ] Stop on max review cycles.
- [ ] Stop on merge conflict.
- [ ] Stop on stuck.
- [ ] Stop on invalid PRD.
- [ ] Respect config defaults.
- [ ] Respect CLI overrides.
- [ ] Add tests for auto continuation.
- [ ] Add tests for auto merge.
- [ ] Add tests for auto stop on stuck.
- [ ] Add tests for auto invalid PRD stop.
- [ ] Add tests for `--no-auto-merge`.

Acceptance criteria:

- [ ] Auto mode can process multiple PRDs serially.
- [ ] Auto mode merges approved branches into `main` by default.
- [ ] Auto mode stops safely when blocked.

---

### `prd-017-control-commands.md` — stop, retry, skip, stuck

Goal: implement operational control commands.

Tasks:

- [ ] Implement `/prd-stop`.
- [ ] Support graceful stop.
- [ ] Support `--now` best-effort immediate stop.
- [ ] Implement `/prd-retry`.
- [ ] Retry current PRD by default.
- [ ] Retry explicit PRD when provided.
- [ ] Preserve previous artifacts.
- [ ] Increment attempt.
- [ ] Feed latest failure to implementation agent.
- [ ] Implement `/prd-skip`.
- [ ] Require PRD ID.
- [ ] Accept reason.
- [ ] Update state.
- [ ] Emit event.
- [ ] Implement `/prd-mark-stuck`.
- [ ] Require PRD ID.
- [ ] Accept reason.
- [ ] Write stuck report.
- [ ] Update state.
- [ ] Emit event.
- [ ] Add command tests.

Acceptance criteria:

- [ ] User can stop, retry, skip, and mark stuck.
- [ ] Commands update state and events.
- [ ] Artifacts are preserved.

---

### `prd-018-documentation-examples.md` — docs, examples, and release readiness

Goal: document the package and prepare v0.1.0.

Tasks:

- [ ] Write README overview.
- [ ] Document command list.
- [ ] Document config file.
- [ ] Document PRD format.
- [ ] Document supervised mode.
- [ ] Document auto mode.
- [ ] Document worktree behavior.
- [ ] Document merge behavior.
- [ ] Document artifact locations.
- [ ] Document recovery and resume.
- [ ] Document known limitations.
- [ ] Add quickstart guide.
- [ ] Add example PRD.
- [ ] Add example implementation summary.
- [ ] Add example review report.
- [ ] Add example stuck report.
- [ ] Add release checklist.
- [ ] Run full tests.
- [ ] Run typecheck.
- [ ] Run lint if available.
- [ ] Update `docs/implementation-progress.md` with final status.

Acceptance criteria:

- [ ] A user can understand how to install, initialize, and run the package.
- [ ] Examples are present.
- [ ] Known limitations are explicit.
- [ ] v0.1.0 acceptance criteria are checked off or documented.

---

## 19. Runner algorithm

Implement the core run loop using this algorithm.

```text
load config
acquire lock
load state
parse PRDs
validate PRDs
create run ID if needed

while true:
  prd = scheduler.next()
  if no prd:
    mark run completed
    release lock
    return

  initialize prd state
  create or reuse branch
  create or reuse worktree

  while attempt <= maxReviewCycles:
    transition prd → implementing
    run implementation agent
    write implementation artifacts
    generate diff artifacts

    transition prd → checking
    run checks
    write check artifacts

    if checks failed:
      record changes_requested reason = failed checks
      attempt += 1
      if attempt > maxReviewCycles:
        mark stuck
        stop auto mode
        break
      continue

    transition prd → reviewing
    run fresh review agent
    validate review JSON
    write review artifacts

    if review approved:
      transition prd → approved
      if should merge:
        transition prd → merging
        merge branch into main
        transition prd → merged
      break

    if review changes_requested:
      attempt += 1
      if attempt > maxReviewCycles:
        mark stuck
        stop auto mode
        break
      transition prd → changes_requested
      continue

    if review blocked:
      mark stuck
      stop auto mode
      break

  if mode is supervised:
    pause according to supervised config

  if mode is auto and stopped/stuck:
    release lock
    return

continue
```

---

## 20. Required artifact formats

### 20.1 `implementation-summary.md`

```markdown
# Implementation Summary: prd-001-auth

## Status

Ready for review.

## Acceptance criteria

- [x] Users can create an account with email and password.
- [x] Passwords are hashed before storage.
- [x] Duplicate emails are rejected.
- [x] Users can log in with valid credentials.
- [x] Invalid credentials return a safe generic error.
- [x] Tests cover success and failure paths.

## Changed files

- `src/auth/register.ts`
- `src/auth/login.ts`
- `tests/auth.test.ts`

## Design notes

Implemented email/password authentication using existing user repository patterns.

## Checks

- `npm test`: passed
- `npm run lint`: passed

## Known limitations

None known.
```

### 20.2 `review-report.md`

```markdown
# Review Report: prd-001-auth

## Decision

changes_requested

## Summary

The implementation mostly satisfies the PRD, but login failures reveal whether an email exists.

## Acceptance criteria

- [x] Users can create an account with email and password.
- [x] Passwords are hashed before storage.
- [x] Duplicate emails are rejected.
- [x] Users can log in with valid credentials.
- [ ] Invalid credentials return a safe generic error.
- [x] Tests cover success and failure paths.

## Required revisions

1. Return the same error for nonexistent email and wrong password.
2. Add regression tests for both cases.

## Optional suggestions

None.

## Risk

Medium.
```

### 20.3 `metadata.json`

```json
{
  "prd": "prd-001-auth",
  "attempt": 2,
  "branch": "pi/prd-001-auth",
  "worktree": ".pi/prd-runner/worktrees/prd-001-auth",
  "status": "reviewing",
  "checks": {
    "test": "passed",
    "lint": "passed"
  },
  "reviewDecision": "changes_requested"
}
```

### 20.4 `stuck-report.md`

```markdown
# Stuck Report: prd-001-auth

## Reason

Exceeded maximum review cycles.

## Attempts

5

## Last failure

The login error behavior still leaks whether an email exists.

## Suggested next action

Manually inspect `src/auth/login.ts` and update generic credential failure behavior.
```

---

## 21. Error handling requirements

### Dirty working tree

- Supervised mode: prompt user.
- Auto mode: stop.

### Existing branch

- Reuse if state says it belongs to the PRD.
- Otherwise stop and report conflict.

### Existing worktree

- Reuse if clean and linked to expected branch.
- Otherwise stop and report conflict.

### Merge conflict

- Abort merge when possible.
- Mark PRD stuck.
- Write merge-conflict report.
- Stop auto mode.
- Prompt in supervised mode.

### Invalid PRD

- Stop before implementation.
- Report validation errors.

### Missing artifacts

- Ask the agent once to repair artifacts.
- If still missing, count as failed attempt.
- If attempts exceed maximum, mark stuck.

### Corrupted state file

- Preserve corrupted file as backup.
- Attempt recovery from latest backup and events.
- If unsafe, stop and report.

---

## 22. Testing strategy

At minimum, implement tests for:

- Config defaults and overrides.
- Initialization command.
- PRD parsing.
- PRD validation.
- State load/write.
- Event append/read.
- Lock acquisition/conflict.
- State transitions.
- Scheduler ordering.
- Git branch creation.
- Worktree creation and reuse.
- Diff generation.
- Check runner pass/fail.
- Artifact path generation.
- Review schema validation.
- Runner loop approval path.
- Runner loop failed-check revision path.
- Runner loop review-change revision path.
- Runner loop max attempts stuck path.
- Merge success.
- Merge conflict.
- Auto mode auto-merge.
- `--no-auto-merge`.
- Status output.
- Dashboard model.
- Command parsing.

Use temporary Git repositories for Git integration tests.

---

## 23. Implementation guidance for the `/goal` agent

Use these rules while implementing:

- Work in small increments.
- Prefer typed domain models over loosely shaped objects.
- Keep file-system effects behind helper functions.
- Keep Git effects behind the Git wrapper.
- Keep Pi runtime effects behind the host abstraction.
- Write tests before or immediately after each slice.
- Do not make dashboard implementation block core runner implementation.
- Implement a console dashboard fallback if TUI APIs are uncertain.
- Do not overbuild parallelism or remote integrations.
- Avoid hard-coding absolute paths.
- Preserve user files.
- Do not force-reset branches.
- Do not delete worktrees unless explicitly configured.
- Update `docs/implementation-progress.md` after every PRD-sized chunk.

Recommended order:

1. Make the core package compile.
2. Make `/prd-init` work.
3. Make PRD parse/validate work.
4. Make state/events/locking work.
5. Make Git/worktrees work.
6. Make checks/artifacts work.
7. Make mock agent orchestration work.
8. Make the runner loop work with mocked agents.
9. Make merge work.
10. Expose commands.
11. Add dashboard.
12. Write docs and examples.

---

## 24. Completion checklist for the `/goal` agent

Before declaring the goal complete, verify:

- [ ] `npm install` or equivalent succeeds.
- [ ] Build succeeds.
- [ ] Tests pass.
- [ ] Typecheck passes if configured.
- [ ] Lint passes if configured.
- [ ] `/prd-init` works in a temporary repo.
- [ ] `/prd-validate` works against example PRDs.
- [ ] `/prd-run --mode supervised` works with mock or real agent integration.
- [ ] `/prd-run --mode auto` auto-merges an approved PRD in a temporary Git repo.
- [ ] Worktrees are created under `.pi/prd-runner/worktrees`.
- [ ] State and events are written under `.pi/prd-runner`.
- [ ] Artifacts are written under `.pi/prd-runner/runs`.
- [ ] Dashboard command renders useful status.
- [ ] README is complete.
- [ ] Known limitations are documented.
- [ ] `docs/implementation-progress.md` contains final status.

---

## 25. Known implementation risk

The exact Pi extension API available in the implementation environment may differ from this spec. To avoid blocking:

- Implement all core logic independently of Pi APIs.
- Keep Pi command registration thin.
- Provide console/test command wrappers when needed.
- Use TODO comments only at the Pi adapter boundary.
- Do not leave core orchestration as TODO.

A partial Pi adapter is acceptable only if the core package, command handlers, runner, tests, and docs are complete and the missing Pi API is explicitly documented.
