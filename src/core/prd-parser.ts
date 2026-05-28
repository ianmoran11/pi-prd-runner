import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import YAML from "yaml";
import type { RunnerConfig } from "../types/config.js";
import type { AcceptanceCriterion, ParsedPrd, PrdFrontmatter } from "../types/prd.js";
import { DEFAULT_CONFIG } from "./config.js";

export function normalizePrdId(id: string): string {
  return id.trim();
}

function fallbackIdFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function splitFrontmatter(raw: string): { hasFrontmatter: boolean; frontmatter: PrdFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { hasFrontmatter: false, frontmatter: {}, body: raw };
  }

  const parsed = YAML.parse(match[1] ?? "") ?? {};
  return {
    hasFrontmatter: true,
    frontmatter: parsed as PrdFrontmatter,
    body: raw.slice(match[0].length)
  };
}

function sectionKey(heading: string): string {
  return heading.trim().toLowerCase();
}

export function extractSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  let current: string | undefined;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current) {
      sections[current] = buffer.join("\n").trim();
    }
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (match) {
      flush();
      current = sectionKey(match[1]);
      buffer = [];
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

export function extractAcceptanceCriteria(section = ""): AcceptanceCriterion[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      checked: match[1].toLowerCase() === "x",
      text: match[2].trim()
    }));
}

export function extractRequiredChecks(section = ""): string[] {
  const checks: string[] = [];
  const fenceRegex = /```(?:bash|sh|shell)?\s*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(section))) {
    checks.push(
      ...match[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  }

  if (checks.length > 0) {
    return checks;
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+`?(.+?)`?\s*$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

export function extractReviewerChecklist(section = ""): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

export function parsePrd(raw: string, filePath: string, rootDir = process.cwd()): ParsedPrd {
  const { hasFrontmatter, frontmatter, body } = splitFrontmatter(raw);
  const rawId = typeof frontmatter.id === "string" ? frontmatter.id : undefined;
  const id = normalizePrdId(rawId ?? fallbackIdFromPath(filePath));
  const sections = extractSections(body);
  const dependsOn = Array.isArray(frontmatter.depends_on)
    ? frontmatter.depends_on.map((dependency) => String(dependency).trim()).filter(Boolean)
    : [];

  return {
    id,
    rawId,
    title: typeof frontmatter.title === "string" ? frontmatter.title.trim() : undefined,
    status: typeof frontmatter.status === "string" ? frontmatter.status.trim() : undefined,
    dependsOn,
    risk: typeof frontmatter.risk === "string" ? frontmatter.risk.trim() : undefined,
    maxReviewCycles: typeof frontmatter.max_review_cycles === "number" ? frontmatter.max_review_cycles : undefined,
    path: filePath,
    relativePath: path.relative(rootDir, filePath),
    hasFrontmatter,
    frontmatter,
    body,
    sections,
    goal: sections.goal,
    scope: sections.scope,
    acceptanceCriteria: extractAcceptanceCriteria(sections["acceptance criteria"]),
    requiredChecks: extractRequiredChecks(sections["required checks"]),
    reviewerChecklist: extractReviewerChecklist(sections["reviewer checklist"]),
    raw
  };
}

export async function parsePrdFile(filePath: string, rootDir = process.cwd()): Promise<ParsedPrd> {
  return parsePrd(await readFile(filePath, "utf8"), filePath, rootDir);
}

export async function loadPrds(cwd: string, config: RunnerConfig = DEFAULT_CONFIG): Promise<ParsedPrd[]> {
  const prdDirectory = path.join(cwd, config.project.prdDirectory);
  const files = await fg(config.project.prdPattern, {
    cwd: prdDirectory,
    absolute: true,
    onlyFiles: true
  });

  const sortedFiles = files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return Promise.all(sortedFiles.map((file) => parsePrdFile(file, cwd)));
}

