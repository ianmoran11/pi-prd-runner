import type { CommandContext, CommandResult } from "./types.js";
import { loadConfigOrDefault } from "../core/config.js";
import { loadPrds } from "../core/prd-parser.js";
import { fixSafePrdIssues, validatePrds } from "../core/prd-validator.js";
import type { PrdValidationIssue } from "../types/prd.js";

function formatIssue(issue: PrdValidationIssue): string {
  const location = issue.file ? `${issue.file}: ` : "";
  return `${issue.level.toUpperCase()} ${location}${issue.message}`;
}

export async function prdValidate(context: CommandContext, args: string[] = []): Promise<CommandResult> {
  const strict = args.includes("--strict");
  const fix = args.includes("--fix");
  const config = await loadConfigOrDefault(context.cwd);
  let prds = await loadPrds(context.cwd, config);

  let fixed: string[] = [];
  if (fix) {
    fixed = await fixSafePrdIssues(prds);
    prds = await loadPrds(context.cwd, config);
  }

  const result = validatePrds(prds);
  const ok = result.valid && (!strict || result.warnings.length === 0);
  const lines = [
    ok ? `Validated ${prds.length} PRD(s): ok.` : `Validated ${prds.length} PRD(s): issues found.`,
    ...fixed.map((file) => `FIXED ${file}`),
    ...result.errors.map(formatIssue),
    ...result.warnings.map(formatIssue)
  ];
  const message = lines.join("\n");

  if (ok) {
    context.host.log(message);
  } else {
    context.host.error(message);
  }

  return {
    ok,
    message,
    data: { prds, validation: result, fixed }
  };
}
