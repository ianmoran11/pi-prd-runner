---
id: prd-001-example
title: Add example greeting
status: pending
depends_on: []
risk: low
max_review_cycles: 5
---

# PRD-001: Add example greeting

## Goal

Add a small greeting helper.

## Scope

Included:
- Greeting helper.
- Unit test.

Excluded:
- CLI integration.
- Remote services.

## Acceptance criteria

- [ ] The helper returns a greeting for a supplied name.
- [ ] Tests cover the helper.

## Required checks

```bash
npm test
```

## Files likely to change

- `src/greeting.ts`
- `tests/greeting.test.ts`

## Reviewer checklist

- The implementation stays within the greeting helper scope.

