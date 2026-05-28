import { git } from "./git.js";

export interface DiffSummary {
  base: string;
  diff: string;
  changedFiles: string[];
  stat: string;
}

export async function generateDiff(cwd: string, base = "main"): Promise<string> {
  const result = await git(["diff", "--binary", base], { cwd });
  return result.stdout;
}

export async function listChangedFiles(cwd: string, base = "main"): Promise<string[]> {
  const result = await git(["diff", "--name-only", base], { cwd });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function diffStat(cwd: string, base = "main"): Promise<string> {
  const result = await git(["diff", "--stat", base], { cwd });
  return result.stdout;
}

export async function getDiffSummary(cwd: string, base = "main"): Promise<DiffSummary> {
  const [diff, changedFiles, stat] = await Promise.all([generateDiff(cwd, base), listChangedFiles(cwd, base), diffStat(cwd, base)]);
  return { base, diff, changedFiles, stat };
}

