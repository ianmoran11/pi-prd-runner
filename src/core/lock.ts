import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { metadataPath } from "./config.js";

export interface LockFile {
  pid: number;
  acquiredAt: string;
  token: string;
}

export interface LockOptions {
  staleMs?: number;
}

export interface LockHandle {
  path: string;
  data: LockFile;
  staleLockReplaced: boolean;
  release(): Promise<void>;
}

export class LockConflictError extends Error {
  constructor(readonly lock: LockFile) {
    super(`pi-prd-runner is already locked by pid ${lock.pid}.`);
    this.name = "LockConflictError";
  }
}

function lockPath(cwd: string): string {
  return metadataPath(cwd, "lock");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockIsStale(lock: LockFile, staleMs: number): boolean {
  const age = Date.now() - Date.parse(lock.acquiredAt);
  return age > staleMs || !pidIsAlive(lock.pid);
}

async function readLock(filePath: string): Promise<LockFile | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as LockFile;
  } catch {
    return null;
  }
}

export async function acquireLock(cwd: string, options: LockOptions = {}): Promise<LockHandle> {
  const filePath = lockPath(cwd);
  const staleMs = options.staleMs ?? 60 * 60 * 1000;
  await mkdir(path.dirname(filePath), { recursive: true });

  let staleLockReplaced = false;
  if (await exists(filePath)) {
    const existing = await readLock(filePath);
    if (existing && !lockIsStale(existing, staleMs)) {
      throw new LockConflictError(existing);
    }

    await rm(filePath, { force: true });
    staleLockReplaced = true;
  }

  const data: LockFile = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    token: randomUUID()
  };

  try {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch {
    const existing = await readLock(filePath);
    if (existing) {
      throw new LockConflictError(existing);
    }
    throw new Error("Failed to acquire pi-prd-runner lock.");
  }

  return {
    path: filePath,
    data,
    staleLockReplaced,
    async release(): Promise<void> {
      const current = await readLock(filePath);
      if (current?.token === data.token) {
        await rm(filePath, { force: true });
      }
    }
  };
}

