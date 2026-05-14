import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  gitInit,
  gitInitialized,
  gitCommit,
  gitCommitPath,
  gitLogBefore,
  gitShow,
  gitLogForPath,
} from "../src/git";

function freshRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "memento-git-test-"));
  return dir;
}

function shell(cwd: string, ...args: string[]): string {
  return execFileSync(args[0], args.slice(1), { cwd, encoding: "utf8" }).trim();
}

describe("gitInitialized", () => {
  it("returns false on a fresh tmpdir", async () => {
    expect(await gitInitialized({ cwd: freshRepo() })).toBe(false);
  });

  it("returns true after gitInit", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    expect(await gitInitialized({ cwd: dir })).toBe(true);
  });
});

describe("gitInit", () => {
  it("creates a .git directory", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    expect(() => shell(dir, "git", "rev-parse", "--git-dir")).not.toThrow();
  });

  it("is idempotent — second call does not error", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    await gitInit({ cwd: dir });
    expect(await gitInitialized({ cwd: dir })).toBe(true);
  });

  it("configures user.name + user.email locally so commits work", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    expect(shell(dir, "git", "config", "user.name")).not.toBe("");
    expect(shell(dir, "git", "config", "user.email")).not.toBe("");
  });
});

describe("gitCommit", () => {
  let dir: string;
  beforeEach(async () => { dir = freshRepo(); await gitInit({ cwd: dir }); });

  it("returns null when there is nothing to commit", async () => {
    expect(await gitCommit({ cwd: dir }, "no changes")).toBeNull();
  });

  it("returns a commit hash after staging real changes", async () => {
    writeFileSync(join(dir, "a.txt"), "hello");
    const hash = await gitCommit({ cwd: dir }, "add a.txt");
    expect(hash).toMatch(/^[0-9a-f]{7,40}$/);
  });

  it("includes the message in git log", async () => {
    writeFileSync(join(dir, "a.txt"), "hello");
    await gitCommit({ cwd: dir }, "meaningful message");
    expect(shell(dir, "git", "log", "-1", "--format=%s")).toBe("meaningful message");
  });
});

describe("gitCommitPath", () => {
  let dir: string;
  beforeEach(async () => { dir = freshRepo(); await gitInit({ cwd: dir }); });

  it("returns null when the given path has no changes", async () => {
    writeFileSync(join(dir, "a.txt"), "v1");
    await gitCommit({ cwd: dir }, "seed");
    expect(await gitCommitPath({ cwd: dir }, "a.txt", "no-op")).toBeNull();
  });

  it("commits only the given path even when other files in the worktree are dirty", async () => {
    writeFileSync(join(dir, "a.txt"), "new-a");
    writeFileSync(join(dir, "b.txt"), "new-b");
    const hash = await gitCommitPath({ cwd: dir }, "a.txt", "commit a only");
    expect(hash).toMatch(/^[0-9a-f]{7,40}$/);
    const files = shell(dir, "git", "show", "--name-only", "--format=", hash!)
      .split("\n").filter(Boolean);
    expect(files).toContain("a.txt");
    expect(files).not.toContain("b.txt");
  });

  it("stages deletions of the given path", async () => {
    writeFileSync(join(dir, "a.txt"), "v1");
    await gitCommit({ cwd: dir }, "seed");
    execFileSync("rm", [join(dir, "a.txt")]);
    const hash = await gitCommitPath({ cwd: dir }, "a.txt", "delete a");
    expect(hash).toMatch(/^[0-9a-f]{7,40}$/);
    const status = shell(dir, "git", "show", "--name-status", "--format=", hash!);
    expect(status).toMatch(/^D\s+a\.txt/);
  });

  it("handles paths in subdirectories", async () => {
    mkdirSync(join(dir, "vault"));
    writeFileSync(join(dir, "vault/x.md"), "content");
    const hash = await gitCommitPath({ cwd: dir }, "vault/x.md", "add x");
    expect(hash).toMatch(/^[0-9a-f]{7,40}$/);
    const buf = await gitShow({ cwd: dir }, hash!, "vault/x.md");
    expect(buf.toString()).toBe("content");
  });

  it("serializes concurrent calls — no .git/index.lock races, both commits succeed", async () => {
    writeFileSync(join(dir, "a.txt"), "av");
    writeFileSync(join(dir, "b.txt"), "bv");
    const [hA, hB] = await Promise.all([
      gitCommitPath({ cwd: dir }, "a.txt", "A"),
      gitCommitPath({ cwd: dir }, "b.txt", "B"),
    ]);
    expect(hA).toMatch(/^[0-9a-f]{7,40}$/);
    expect(hB).toMatch(/^[0-9a-f]{7,40}$/);
    expect(hA).not.toBe(hB);
    expect((await gitLogForPath({ cwd: dir }, "a.txt")).length).toBe(1);
    expect((await gitLogForPath({ cwd: dir }, "b.txt")).length).toBe(1);
  });
});

describe("gitLogBefore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = freshRepo();
    await gitInit({ cwd: dir });
  });

  function fakeCommitAt(path: string, content: string, isoDate: string): void {
    const env = {
      ...process.env,
      GIT_AUTHOR_DATE: isoDate,
      GIT_COMMITTER_DATE: isoDate,
    };
    writeFileSync(join(dir, path), content);
    execFileSync("git", ["add", path], { cwd: dir });
    execFileSync("git", ["commit", "-m", `update ${path}`], { cwd: dir, env });
  }

  it("returns null when no commits touch the path", async () => {
    writeFileSync(join(dir, "x.txt"), "x");
    await gitCommit({ cwd: dir }, "add x");
    const rec = await gitLogBefore({ cwd: dir }, new Date(), "y.txt");
    expect(rec).toBeNull();
  });

  it("returns null when target predates all commits for path", async () => {
    fakeCommitAt("a.txt", "v1", "2026-03-01T12:00:00Z");
    const rec = await gitLogBefore({ cwd: dir }, new Date("2026-01-01T00:00:00Z"), "a.txt");
    expect(rec).toBeNull();
  });

  it("returns the closest-prior commit", async () => {
    fakeCommitAt("a.txt", "v1", "2026-03-01T12:00:00Z");
    fakeCommitAt("a.txt", "v2", "2026-04-01T12:00:00Z");
    fakeCommitAt("a.txt", "v3", "2026-05-01T12:00:00Z");
    const rec = await gitLogBefore({ cwd: dir }, new Date("2026-04-15T00:00:00Z"), "a.txt");
    expect(rec).not.toBeNull();
    expect(rec!.datetime.toISOString()).toBe("2026-04-01T12:00:00.000Z");
    expect(rec!.hash).toMatch(/^[0-9a-f]{7,40}$/);
  });

  it("scopes by path — ignores commits to other files", async () => {
    fakeCommitAt("a.txt", "v1", "2026-03-01T12:00:00Z");
    fakeCommitAt("b.txt", "v1", "2026-04-01T12:00:00Z");
    const rec = await gitLogBefore({ cwd: dir }, new Date("2026-05-01T00:00:00Z"), "a.txt");
    expect(rec!.datetime.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });
});

describe("gitShow", () => {
  it("returns the file content at the given commit", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    writeFileSync(join(dir, "a.txt"), "first");
    const hash1 = await gitCommit({ cwd: dir }, "v1");
    writeFileSync(join(dir, "a.txt"), "second");
    await gitCommit({ cwd: dir }, "v2");
    const buf = await gitShow({ cwd: dir }, hash1!, "a.txt");
    expect(buf.toString()).toBe("first");
  });

  it("handles paths in subdirectories", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    mkdirSync(join(dir, "vault"));
    writeFileSync(join(dir, "vault/x.md"), "content");
    const hash = await gitCommit({ cwd: dir }, "add x");
    const buf = await gitShow({ cwd: dir }, hash!, "vault/x.md");
    expect(buf.toString()).toBe("content");
  });

  it("returns binary content faithfully", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    const bin = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x7f]);
    writeFileSync(join(dir, "blob"), bin);
    const hash = await gitCommit({ cwd: dir }, "add blob");
    const buf = await gitShow({ cwd: dir }, hash!, "blob");
    expect(Buffer.compare(buf, bin)).toBe(0);
  });

  it("handles paths containing a literal ':' (e.g. citekey-style names)", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    writeFileSync(join(dir, "a:b.txt"), "colon content");
    const hash = await gitCommit({ cwd: dir }, "add colon");
    const buf = await gitShow({ cwd: dir }, hash!, "a:b.txt");
    expect(buf.toString()).toBe("colon content");
  });

  it("handles deeper path collisions with revision syntax (foo:bar:baz)", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    mkdirSync(join(dir, "foo:bar"));
    writeFileSync(join(dir, "foo:bar/baz.txt"), "deep colon");
    const hash = await gitCommit({ cwd: dir }, "add deep colon");
    const buf = await gitShow({ cwd: dir }, hash!, "foo:bar/baz.txt");
    expect(buf.toString()).toBe("deep colon");
  });

  it("handles paths with spaces (decoded from %20)", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    writeFileSync(join(dir, "has space.md"), "spaced");
    const hash = await gitCommit({ cwd: dir }, "add spaced");
    const buf = await gitShow({ cwd: dir }, hash!, "has space.md");
    expect(buf.toString()).toBe("spaced");
  });
});

describe("gitLogForPath", () => {
  it("returns all commits touching the path, newest first", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });

    const commitAt = (path: string, content: string, iso: string) => {
      const env = { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
      writeFileSync(join(dir, path), content);
      execFileSync("git", ["add", path], { cwd: dir });
      execFileSync("git", ["commit", "-m", `update ${path}`], { cwd: dir, env });
    };

    commitAt("a.txt", "v1", "2026-03-01T12:00:00Z");
    commitAt("a.txt", "v2", "2026-04-01T12:00:00Z");
    commitAt("a.txt", "v3", "2026-05-01T12:00:00Z");

    const records = await gitLogForPath({ cwd: dir }, "a.txt");
    expect(records.length).toBe(3);
    expect(records[0].datetime.toISOString()).toBe("2026-05-01T12:00:00.000Z");
    expect(records[2].datetime.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });

  it("returns empty list when no commits touch the path", async () => {
    const dir = freshRepo();
    await gitInit({ cwd: dir });
    writeFileSync(join(dir, "a.txt"), "v");
    await gitCommit({ cwd: dir }, "add a");
    expect(await gitLogForPath({ cwd: dir }, "nonexistent.txt")).toEqual([]);
  });
});
