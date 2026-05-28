import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prdInit } from "../src/commands/prd-init.js";
import { DEFAULT_CONFIG, loadConfig } from "../src/core/config.js";
import { MockHost } from "../src/core/host.js";

let tempDir: string;

async function fileText(relativePath: string): Promise<string> {
  return readFile(path.join(tempDir, relativePath), "utf8");
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-prd-runner-init-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("/prd-init", () => {
  it("creates required directories and metadata files", async () => {
    const host = new MockHost();
    const result = await prdInit({ cwd: tempDir, host }, []);

    expect(result.ok).toBe(true);
    await expect(fileText(".pi/prd-runner/config.yml")).resolves.toContain("schemaVersion: 1");
    await expect(fileText(".pi/prd-runner/state.json")).resolves.toContain('"initialized": true');
    await expect(fileText(".pi/prd-runner/events.ndjson")).resolves.toBe("");
    await expect(loadConfig(tempDir)).resolves.toEqual(DEFAULT_CONFIG);
  });

  it("is idempotent and does not overwrite existing files without force", async () => {
    await prdInit({ cwd: tempDir, host: new MockHost() }, []);
    await writeFile(path.join(tempDir, ".pi/prd-runner/config.yml"), "schemaVersion: 1\ncustom: true\n", "utf8");

    const result = await prdInit({ cwd: tempDir, host: new MockHost() }, []);

    expect(result.ok).toBe(true);
    expect(await fileText(".pi/prd-runner/config.yml")).toContain("custom: true");
  });

  it("overwrites metadata with force", async () => {
    await prdInit({ cwd: tempDir, host: new MockHost() }, []);
    await writeFile(path.join(tempDir, ".pi/prd-runner/config.yml"), "schemaVersion: 1\ncustom: true\n", "utf8");

    await prdInit({ cwd: tempDir, host: new MockHost() }, ["--force"]);

    const config = YAML.parse(await fileText(".pi/prd-runner/config.yml"));
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("creates an example PRD when requested", async () => {
    await prdInit({ cwd: tempDir, host: new MockHost() }, ["--with-example"]);

    const example = await fileText("docs/prds/prd-001-example.md");
    expect(example).toContain("id: prd-001-example");
    expect(example).toContain("## Acceptance criteria");
  });
});
