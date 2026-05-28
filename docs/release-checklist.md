# v0.1.0 Release Checklist

- [x] `npm install`
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `/prd-init` works in a temporary repo
- [x] `/prd-validate` works against example PRDs
- [x] `/prd-run --mode supervised` works with mock host integration
- [x] `/prd-run --mode auto` auto-merges approved PRDs in a temporary Git repo
- [x] Worktrees are created under `.pi/prd-runner/worktrees`
- [x] State and events are written under `.pi/prd-runner`
- [x] Artifacts are written under `.pi/prd-runner/runs`
- [x] Dashboard command renders useful status
- [x] Known limitations are documented
