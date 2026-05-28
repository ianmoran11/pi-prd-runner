#!/usr/bin/env node
import { ConsoleHost } from "./core/host.js";
import { getPublicCommands } from "./extension.js";

const [commandName, ...args] = process.argv.slice(2);
const host = new ConsoleHost();

if (!commandName) {
  host.error(`Usage: pi-prd-runner <command> [args]\nCommands:\n${getPublicCommands().map((command) => `  ${command.name}`).join("\n")}`);
  process.exitCode = 1;
} else {
  const normalized = commandName.startsWith("/") ? commandName : `/${commandName}`;
  const command = getPublicCommands().find((candidate) => candidate.name === normalized);
  if (!command) {
    host.error(`Unknown command '${commandName}'.`);
    process.exitCode = 1;
  } else {
    const result = await command.handler({ cwd: process.cwd(), host }, args);
    process.exitCode = result.ok ? 0 : 1;
  }
}

