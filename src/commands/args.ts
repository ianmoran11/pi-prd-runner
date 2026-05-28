export interface ParsedArgs {
  flags: Record<string, string | boolean>;
  positionals: string[];
}

export function parseCommandArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positionals };
}

export function stringFlag(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.flags[key];
  return typeof value === "string" ? value : undefined;
}

export function numberFlag(parsed: ParsedArgs, key: string): number | undefined {
  const value = stringFlag(parsed, key);
  if (value === undefined) {
    return undefined;
  }

  const parsedNumber = Number(value);
  if (!Number.isInteger(parsedNumber)) {
    throw new Error(`--${key} must be an integer.`);
  }
  return parsedNumber;
}

export function booleanFlag(parsed: ParsedArgs, key: string): boolean {
  return parsed.flags[key] === true;
}

