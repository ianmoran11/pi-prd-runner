import { describe, expect, it } from "vitest";
import { activate, getPublicCommands, MockHost } from "../src/index.js";

const expectedCommands = [
  "/prd-init",
  "/prd-run",
  "/prd-resume",
  "/prd-status",
  "/prd-dashboard",
  "/prd-validate",
  "/prd-stop",
  "/prd-retry",
  "/prd-skip",
  "/prd-mark-stuck"
];

describe("package skeleton", () => {
  it("registers every public command", () => {
    const host = new MockHost();
    const commands = activate(host, process.cwd());

    expect(commands.map((command) => command.name)).toEqual(expectedCommands);
    expect(host.commands.map((command) => command.name)).toEqual(expectedCommands);
  });

  it("exposes command metadata without side effects", () => {
    expect(getPublicCommands().map((command) => command.name)).toEqual(expectedCommands);
  });
});
