import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prdValidate } from "../src/commands/prd-validate.js";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import { MockHost } from "../src/core/host.js";
import { loadPrds, parsePrd } from "../src/core/prd-parser.js";
import { validatePrds } from "../src/core/prd-validator.js";

let tempDir: string;

const validPrd = `---
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

Excluded:
- Password reset
- OAuth

## Acceptance criteria

- [ ] Users can create an account with email and password.
- [ ] Users can log in with valid credentials.

## Required checks

\`\`\`bash
npm test
npm run lint
\`\`\`

## Reviewer checklist

- No plaintext passwords.
`;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-prd-"));
  await mkdir(path.join(tempDir, "docs/prds"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("PRD parser", () => {
  it("parses frontmatter, sections, acceptance criteria, checks, and checklist", () => {
    const parsed = parsePrd(validPrd, path.join(tempDir, "docs/prds/prd-001-auth.md"), tempDir);

    expect(parsed.id).toBe("prd-001-auth");
    expect(parsed.title).toBe("Email/password authentication");
    expect(parsed.goal).toContain("Implement email/password");
    expect(parsed.acceptanceCriteria.map((criterion) => criterion.text)).toEqual([
      "Users can create an account with email and password.",
      "Users can log in with valid credentials."
    ]);
    expect(parsed.requiredChecks).toEqual(["npm test", "npm run lint"]);
    expect(parsed.reviewerChecklist).toEqual(["No plaintext passwords."]);
  });

  it("loads PRDs from docs/prds sorted by filename", async () => {
    await writeFile(path.join(tempDir, "docs/prds/prd-002-b.md"), validPrd.replaceAll("prd-001-auth", "prd-002-b"), "utf8");
    await writeFile(path.join(tempDir, "docs/prds/prd-001-a.md"), validPrd.replaceAll("prd-001-auth", "prd-001-a"), "utf8");

    const prds = await loadPrds(tempDir, DEFAULT_CONFIG);

    expect(prds.map((prd) => prd.id)).toEqual(["prd-001-a", "prd-002-b"]);
  });
});

describe("PRD validator", () => {
  it("accepts a valid PRD", () => {
    const result = validatePrds([parsePrd(validPrd, "docs/prds/prd-001-auth.md")]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing required sections clearly", () => {
    const invalid = `---
id: prd-001-bad
title: Bad PRD
status: pending
depends_on: []
---

# Bad
`;

    const result = validatePrds([parsePrd(invalid, "docs/prds/prd-001-bad.md")]);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["goal_missing", "scope_missing", "acceptance_criteria_missing"])
    );
  });

  it("validates dependency existence and cycles", () => {
    const a = validPrd.replace("id: prd-001-auth", "id: prd-a").replace("depends_on: []", "depends_on: [prd-b]");
    const b = validPrd.replace("id: prd-001-auth", "id: prd-b").replace("depends_on: []", "depends_on: [prd-a]");

    const result = validatePrds([parsePrd(a, "a.md"), parsePrd(b, "b.md")]);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("dependency_cycle");
  });
});

describe("/prd-validate", () => {
  it("prints useful validation output", async () => {
    await writeFile(path.join(tempDir, "docs/prds/prd-001-auth.md"), validPrd, "utf8");
    const host = new MockHost();

    const result = await prdValidate({ cwd: tempDir, host }, []);

    expect(result.ok).toBe(true);
    expect(host.logs[0]).toContain("Validated 1 PRD(s): ok.");
  });

  it("fails strict mode on warnings", async () => {
    await writeFile(
      path.join(tempDir, "docs/prds/prd-001-auth.md"),
      validPrd.replace(/## Reviewer checklist[\s\S]*$/, ""),
      "utf8"
    );

    const result = await prdValidate({ cwd: tempDir, host: new MockHost() }, ["--strict"]);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Reviewer checklist is recommended");
  });
});
