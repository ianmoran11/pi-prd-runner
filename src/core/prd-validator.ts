import { readFile, writeFile } from "node:fs/promises";
import YAML from "yaml";
import type { ParsedPrd, PrdStatus, PrdValidationIssue, PrdValidationResult } from "../types/prd.js";
import { SUPPORTED_PRD_STATUSES } from "../types/prd.js";

const supportedStatusSet = new Set<string>(SUPPORTED_PRD_STATUSES);

function issue(prd: ParsedPrd | undefined, code: string, message: string, level: "error" | "warning" = "error"): PrdValidationIssue {
  return {
    level,
    code,
    message,
    prdId: prd?.id,
    file: prd?.relativePath
  };
}

function hasClearScope(scope: string | undefined, label: "Included" | "Excluded"): boolean {
  if (!scope) {
    return false;
  }

  const match = scope.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?:\\n\\s*(?:Included|Excluded):|$)`, "i"));
  return Boolean(match?.[1]?.match(/[-*]\s+\S/));
}

function validateDependencies(prds: ParsedPrd[], errors: PrdValidationIssue[]): void {
  const byId = new Map(prds.map((prd) => [prd.id, prd]));

  for (const prd of prds) {
    for (const dependency of prd.dependsOn) {
      if (!byId.has(dependency)) {
        errors.push(issue(prd, "dependency_missing", `Dependency '${dependency}' does not exist.`));
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (prd: ParsedPrd, stack: string[]): void => {
    if (visited.has(prd.id)) {
      return;
    }

    if (visiting.has(prd.id)) {
      errors.push(issue(prd, "dependency_cycle", `Dependency cycle detected: ${[...stack, prd.id].join(" -> ")}.`));
      return;
    }

    visiting.add(prd.id);
    for (const dependency of prd.dependsOn) {
      const dependencyPrd = byId.get(dependency);
      if (dependencyPrd) {
        visit(dependencyPrd, [...stack, prd.id]);
      }
    }
    visiting.delete(prd.id);
    visited.add(prd.id);
  };

  for (const prd of prds) {
    visit(prd, []);
  }
}

export function validatePrds(prds: ParsedPrd[]): PrdValidationResult {
  const errors: PrdValidationIssue[] = [];
  const warnings: PrdValidationIssue[] = [];
  const seenIds = new Map<string, ParsedPrd>();

  for (const prd of prds) {
    if (!prd.hasFrontmatter) {
      errors.push(issue(prd, "frontmatter_missing", "PRD must start with YAML frontmatter."));
    }

    if (!prd.rawId) {
      errors.push(issue(prd, "id_missing", "Frontmatter must include an id."));
    }

    if (seenIds.has(prd.id)) {
      errors.push(issue(prd, "id_duplicate", `Duplicate PRD id '${prd.id}'.`));
    }
    seenIds.set(prd.id, prd);

    if (!prd.title) {
      errors.push(issue(prd, "title_missing", "Frontmatter must include a title."));
    }

    if (!prd.status) {
      errors.push(issue(prd, "status_missing", "Frontmatter must include a status."));
    } else if (!supportedStatusSet.has(prd.status)) {
      errors.push(issue(prd, "status_unsupported", `Unsupported status '${prd.status}'.`));
    }

    if (!Array.isArray(prd.frontmatter.depends_on)) {
      errors.push(issue(prd, "depends_on_invalid", "Frontmatter depends_on must be a list."));
    }

    if (!prd.goal) {
      errors.push(issue(prd, "goal_missing", "PRD must include a Goal section."));
    }

    if (!prd.scope) {
      errors.push(issue(prd, "scope_missing", "PRD must include a Scope section."));
    }

    if (!prd.sections["acceptance criteria"]) {
      errors.push(issue(prd, "acceptance_criteria_missing", "PRD must include an Acceptance criteria section."));
    } else if (prd.acceptanceCriteria.length === 0) {
      errors.push(issue(prd, "acceptance_criteria_empty", "PRD must include at least one acceptance criterion."));
    }

    if (!hasClearScope(prd.scope, "Included")) {
      errors.push(issue(prd, "scope_included_missing", "Scope must include a non-empty Included list."));
    }

    if (!hasClearScope(prd.scope, "Excluded")) {
      errors.push(issue(prd, "scope_excluded_missing", "Scope must include a non-empty Excluded list."));
    }

    if (!prd.sections["reviewer checklist"]) {
      warnings.push(issue(prd, "reviewer_checklist_missing", "Reviewer checklist is recommended.", "warning"));
    }
  }

  validateDependencies(prds, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function isPrdStatus(status: string): status is PrdStatus {
  return supportedStatusSet.has(status);
}

export async function fixSafePrdIssues(prds: ParsedPrd[]): Promise<string[]> {
  const fixed: string[] = [];

  for (const prd of prds) {
    if (!prd.hasFrontmatter || !prd.status) {
      continue;
    }

    const normalizedStatus = prd.status.toLowerCase();
    if (prd.status === normalizedStatus || !isPrdStatus(normalizedStatus)) {
      continue;
    }

    const raw = await readFile(prd.path, "utf8");
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      continue;
    }

    const frontmatter = YAML.parse(match[1] ?? "") ?? {};
    frontmatter.status = normalizedStatus;
    const nextRaw = raw.replace(match[0], `---\n${YAML.stringify(frontmatter).trimEnd()}\n---`);
    await writeFile(prd.path, nextRaw, "utf8");
    fixed.push(prd.relativePath);
  }

  return fixed;
}

