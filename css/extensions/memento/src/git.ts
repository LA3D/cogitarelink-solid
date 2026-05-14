import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, open, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import type { GitOptions, MementoRecord } from "./types";

const exec = promisify(execFile);

const GIT_USER_NAME = "Memento CDC";
const GIT_USER_EMAIL = "memento@cogitarelink.local";

const LOCK_FILE = ".git/memento.lock";
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;

async function withLock<T>(opts: GitOptions, fn: () => Promise<T>): Promise<T> {
  const lockPath = join(opts.cwd, LOCK_FILE);
  for (;;) {
    try {
      const fh = await open(lockPath, "wx");
      await fh.close();
      try { return await fn(); } finally { await unlink(lockPath).catch(() => {}); }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const age = await stat(lockPath).then((s) => Date.now() - s.mtimeMs).catch(() => 0);
      if (age > LOCK_STALE_MS) { await unlink(lockPath).catch(() => {}); continue; }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}

async function git(opts: GitOptions, args: string[], encoding: "utf8" | "buffer" = "utf8"): Promise<string | Buffer> {
  const r = await exec("git", args, { cwd: opts.cwd, encoding: encoding as BufferEncoding, maxBuffer: 64 * 1024 * 1024 });
  return r.stdout as string | Buffer;
}

async function gitStr(opts: GitOptions, args: string[]): Promise<string> {
  return (await git(opts, args, "utf8")) as string;
}

async function gitBuf(opts: GitOptions, args: string[]): Promise<Buffer> {
  return (await git(opts, args, "buffer")) as Buffer;
}

export async function gitInitialized(opts: GitOptions): Promise<boolean> {
  try {
    await access(join(opts.cwd, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function gitInit(opts: GitOptions): Promise<void> {
  if (await gitInitialized(opts)) return;
  await gitStr(opts, ["init", "--quiet"]);
  await gitStr(opts, ["config", "user.name", GIT_USER_NAME]);
  await gitStr(opts, ["config", "user.email", GIT_USER_EMAIL]);
}

export async function gitCommit(opts: GitOptions, message: string): Promise<string | null> {
  return withLock(opts, async () => {
    await gitStr(opts, ["add", "-A"]);
    const status = (await gitStr(opts, ["status", "--porcelain"])).trim();
    if (!status) return null;
    await gitStr(opts, ["commit", "--quiet", "-m", message]);
    return (await gitStr(opts, ["rev-parse", "HEAD"])).trim();
  });
}

export async function gitCommitPath(opts: GitOptions, path: string, message: string): Promise<string | null> {
  return withLock(opts, async () => {
    await gitStr(opts, ["add", "--", path]);
    const status = (await gitStr(opts, ["status", "--porcelain", "--", path])).trim();
    if (!status) return null;
    await gitStr(opts, ["commit", "--quiet", "--only", "-m", message, "--", path]);
    return (await gitStr(opts, ["rev-parse", "HEAD"])).trim();
  });
}

export async function gitLogBefore(opts: GitOptions, datetime: Date, path: string): Promise<MementoRecord | null> {
  const iso = datetime.toISOString();
  const out = (await gitStr(opts, [
    "log", "-1",
    `--before=${iso}`,
    "--format=%H%x09%cI",
    "--", path,
  ])).trim();
  if (!out) return null;
  const [hash, cIso] = out.split("\t");
  return { hash, datetime: new Date(cIso) };
}

export async function gitShow(opts: GitOptions, hash: string, path: string): Promise<Buffer> {
  return gitBuf(opts, ["show", `${hash}:${path}`]);
}

export async function gitLogForPath(opts: GitOptions, path: string): Promise<MementoRecord[]> {
  const out = (await gitStr(opts, ["log", "--format=%H%x09%cI", "--", path])).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [hash, cIso] = line.split("\t");
    return { hash, datetime: new Date(cIso) };
  });
}
