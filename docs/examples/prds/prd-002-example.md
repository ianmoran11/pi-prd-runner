---
id: prd-002-example
title: Add greeting punctuation option
status: pending
depends_on: [prd-001-example]
risk: low
max_review_cycles: 5
---

# PRD-002: Add greeting punctuation option

## Goal

Allow the greeting helper to customize punctuation.

## Scope

Included:
- Optional punctuation argument.
- Tests for default and custom punctuation.

Excluded:
- Localization.
- CLI integration.

## Acceptance criteria

- [ ] The helper keeps the existing default punctuation.
- [ ] The helper accepts custom punctuation.
- [ ] Tests cover both cases.

## Required checks

```bash
npm test
```

## Files likely to change

- `src/greeting.ts`
- `tests/greeting.test.ts`

## Reviewer checklist

- The dependency on `prd-001-example` is respected.

