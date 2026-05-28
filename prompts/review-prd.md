# Review PRD

Review the implementation in a fresh context.

Required behavior:
- Assess the diff against the PRD only.
- Check every acceptance criterion.
- Decide `approved`, `changes_requested`, or `blocked`.
- Write `review-report.md`.
- Return structured JSON with the review decision, acceptance-criterion evidence, required revisions, optional suggestions, and risk.
- Do not modify implementation files.

