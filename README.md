# pi-prd-runner

`pi-prd-runner` is a local-first Pi package that processes Markdown PRDs from `docs/prds` one at a time. Each PRD is implemented on its own branch and Git worktree, checked, reviewed through the host agent abstraction, and then merged when approved.

This repository is being implemented from `pi-prd-runner-goal-spec.md`. See `docs/implementation-progress.md` for the current backlog status.

## Development

```bash
npm install
npm test
npm run typecheck
```

