import { spawn } from "node:child_process";
import type { CheckCommandConfig, RunnerConfig } from "../types/config.js";
import type { ParsedPrd } from "../types/prd.js";
import type { AttemptArtifactPaths } from "../types/artifact.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { writeTextArtifact } from "../core/artifacts.js";

export interface CheckResult {
  name: string;
  command: string;
  status: "passed" | "failed";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface CheckRunResult {
  status: "passed" | "failed";
  results: CheckResult[];
}

export interface CheckRunOptions {
  timeoutMs?: number;
}

export function checksForPrd(config: RunnerConfig = DEFAULT_CONFIG, prd?: ParsedPrd): CheckCommandConfig[] {
  const checks = [...config.checks.default];
  for (const [index, command] of prd?.requiredChecks.entries() ?? []) {
    if (!checks.some((check) => check.command === command)) {
      checks.push({ name: `prd-${index + 1}`, command });
    }
  }
  return checks;
}

export async function runOneCheck(cwd: string, check: CheckCommandConfig, options: CheckRunOptions = {}): Promise<CheckResult> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 60_000;

  return new Promise((resolve, reject) => {
    const child = spawn(check.command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        name: check.name,
        command: check.command,
        status: exitCode === 0 && !timedOut ? "passed" : "failed",
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut
      });
    });
  });
}

export async function runChecks(cwd: string, checks: CheckCommandConfig[], options: CheckRunOptions = {}): Promise<CheckRunResult> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    results.push(await runOneCheck(cwd, check, options));
  }

  return {
    status: results.every((result) => result.status === "passed") ? "passed" : "failed",
    results
  };
}

export function renderCheckResults(result: CheckRunResult): string {
  const lines = ["# Test Results", "", `Overall: ${result.status}`, ""];
  for (const check of result.results) {
    lines.push(`## ${check.name}`, "");
    lines.push(`Command: \`${check.command}\``);
    lines.push(`Status: ${check.status}`);
    lines.push(`Exit code: ${check.exitCode ?? "null"}`);
    lines.push(`Duration: ${check.durationMs}ms`);
    lines.push("");
    lines.push("### stdout", "");
    lines.push("```");
    lines.push(check.stdout.trimEnd());
    lines.push("```");
    lines.push("");
    lines.push("### stderr", "");
    lines.push("```");
    lines.push(check.stderr.trimEnd());
    lines.push("```");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function writeCheckResults(paths: AttemptArtifactPaths, result: CheckRunResult): Promise<void> {
  await writeTextArtifact(paths.testResults, renderCheckResults(result));
}

