import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { Parser, Store, DataFactory } from "n3";
import { shouldReproject, DEFAULT_STAMP_PRED, MarkdownProjectionListener } from "../src-cjs/listener.js";
import { recoverPriorBody, gitLogBefore, gitShow } from "../src-cjs/gitRead.js";
import { pendingCurationSignals } from "../src-cjs/curationSignal.js";
import { STAMP_PRED, VERSION_PRED } from "../src-cjs/stampPredicates.js";
import { pkgVersion } from "../src-cjs/markdownBodyProjector.js";

const { namedNode } = DataFactory;

const body = "# A\n[A]{.prefLabel}\n";
const hash = createHash("sha256").update(body).digest("hex");

describe("backstop shouldReproject", () => {
  it("skips when stamp matches the body hash", () => {
    const meta = `<x> <${DEFAULT_STAMP_PRED}> "${hash}" .`;
    expect(shouldReproject(body, meta)).toBe(false);
  });
  it("reprojects when stamp missing", () => {
    expect(shouldReproject(body, `<x> <http://purl.org/dc/terms/title> "A" .`)).toBe(true);
  });
  it("reprojects when stamp stale", () => {
    const meta = `<x> <${DEFAULT_STAMP_PRED}> "deadbeef" .`;
    expect(shouldReproject(body, meta)).toBe(true);
  });
  it("reprojects when .meta is absent/empty", () => {
    expect(shouldReproject(body, "")).toBe(true);
  });
});

// --- PSP T5: listener backstop — Memento old body + degraded signal ----------

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const SKOS_PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const SKOS_BROADER = "http://www.w3.org/2004/02/skos/core#broader";
const BODY_V1 = "---\ntype: concept\n---\n# Photosynthesis\n\n[Photosynthesis]{.prefLabel}\n\n[[Biology]]{.broader}\n";
// V2: prefLabel revised + the wikilink edge DROPPED (same fixture pair as the T3 floor tests)
const BODY_V2 = "---\ntype: concept\n---\n# Photosynthesis\n\n[Light-driven carbon fixation]{.prefLabel}\n";

const BASE = "https://pod.vardeman.me";

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "psp-t5-"));
  execSync("git init --quiet && git config user.name t && git config user.email t@t.local", {
    cwd: dir, shell: "/bin/bash",
  });
  return dir;
}

// Distinct GIT_COMMITTER_DATEs per commit: git commit-date granularity is seconds and
// the walk-back queries at (newest - 1s), so same-second commits are unresolvable.
function commitAll(dir: string, msg: string, dateIso: string): void {
  execSync(`git add -A && git commit --quiet -m "${msg}"`, {
    cwd: dir, shell: "/bin/bash",
    env: { ...process.env, GIT_COMMITTER_DATE: dateIso, GIT_AUTHOR_DATE: dateIso },
  });
}

describe("gitRead.recoverPriorBody (the hash-guarded walk)", () => {
  let dir: string;
  afterEach(() => { try { rmSync(dir, { recursive: true }); } catch {} });

  it("(d) newest-commit-is-current-body: walks back one commit and recovers v1", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "f.md"), BODY_V1);
    commitAll(dir, "v1", "2026-01-01T00:00:00Z");
    writeFileSync(join(dir, "f.md"), BODY_V2);
    commitAll(dir, "v2", "2026-01-01T00:00:10Z");
    // disk = v2 (already committed — memento won the race); stamp wants v1
    const out = await recoverPriorBody(dir, "f.md", sha(BODY_V2), sha(BODY_V1));
    expect(out).toBe(BODY_V1);
  });

  it("newest commit IS the wanted prior body (memento has not committed the new write yet)", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "f.md"), BODY_V1);
    commitAll(dir, "v1", "2026-01-01T00:00:00Z");
    writeFileSync(join(dir, "f.md"), BODY_V2); // new write on disk, NOT committed
    const out = await recoverPriorBody(dir, "f.md", sha(BODY_V2), sha(BODY_V1));
    expect(out).toBe(BODY_V1);
  });

  it("(e) walk-back has nowhere to go (single commit == current body) → null, not a wrong body", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "f.md"), BODY_V2);
    commitAll(dir, "only", "2026-01-01T00:00:00Z");
    expect(await recoverPriorBody(dir, "f.md", sha(BODY_V2), sha(BODY_V1))).toBeNull();
  });

  it("(e) history matches NEITHER the stamp NOR the current body → null (prefer degraded)", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "f.md"), "something else entirely\n");
    commitAll(dir, "other", "2026-01-01T00:00:00Z");
    expect(await recoverPriorBody(dir, "f.md", sha(BODY_V2), sha(BODY_V1))).toBeNull();
  });

  it("(b-precondition) no commits at all → null", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "f.md"), BODY_V2);
    expect(await recoverPriorBody(dir, "f.md", sha(BODY_V2), sha(BODY_V1))).toBeNull();
  });

  it("gitLogBefore + gitShow round-trip a committed file", async () => {
    dir = initRepo();
    writeFileSync(join(dir, "g.md"), "hello\n");
    commitAll(dir, "g", "2026-01-01T00:00:00Z");
    const rec = await gitLogBefore(dir, new Date().toISOString(), "g.md");
    expect(rec).not.toBeNull();
    expect((await gitShow(dir, rec!.hash, "g.md")).toString("utf8")).toBe("hello\n");
  });
});

describe("listener backstop project() (PSP T5)", () => {
  let dir: string;
  beforeEach(() => { pendingCurationSignals.length = 0; });
  afterEach(() => { try { rmSync(dir, { recursive: true }); } catch {} });

  function setup(slug: string, gitDir?: string) {
    dir = initRepo();
    const storeStub = { on() {} } as any;
    const listener = new MarkdownProjectionListener(
      storeStub, BASE, dir, undefined, "/vault", DEFAULT_STAMP_PRED, gitDir ?? dir,
    );
    const url = `${BASE}/vault/wiki/concepts/${slug}.md`;
    const fsPath = join(dir, `vault/wiki/concepts/${slug}.md`);
    mkdirSync(dirname(fsPath), { recursive: true });
    return { listener, url, fsPath };
  }

  const project = (listener: MarkdownProjectionListener, url: string) =>
    (listener as any).project({ path: url });

  const readMeta = (fsPath: string, url: string): Store =>
    new Store(new Parser({ baseIRI: `${url}.meta` }).parse(readFileSync(`${fsPath}.meta`, "utf8")));

  it("(a) exact path through git: agent triple survives, dropped edge GONE, stamps current, no signal", async () => {
    const { listener, url, fsPath } = setup("exact");

    // first projection (out-of-band write #1) — no prior .meta → silent first-write
    writeFileSync(fsPath, BODY_V1);
    await project(listener, url);
    expect(existsSync(`${fsPath}.meta`)).toBe(true);
    expect(pendingCurationSignals).toHaveLength(0);
    // the listener stamps its own write (bodyHash + projectorVersion)
    let out = readMeta(fsPath, url);
    expect(out.getQuads(namedNode(url), namedNode(STAMP_PRED), null, null)[0]?.object.value).toBe(sha(BODY_V1));
    expect(out.getQuads(namedNode(url), namedNode(VERSION_PRED), null, null)[0]?.object.value).toBe(pkgVersion());

    // agent PATCHes an ungoverned triple between the writes
    appendFileSync(`${fsPath}.meta`, `\n<${url}#this> <urn:agentOwned> "keep" .\n`);
    // memento commits v1 (body + .meta)
    commitAll(dir, "v1", "2026-01-01T00:00:00Z");
    // out-of-band write #2
    writeFileSync(fsPath, BODY_V2);
    await project(listener, url);

    out = readMeta(fsPath, url);
    expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
    // the dropped wikilink edge is REMOVED — exact subtraction through the git old body
    expect(out.getQuads(null, namedNode(SKOS_BROADER), null, null)).toHaveLength(0);
    const labels = out.getQuads(null, namedNode(SKOS_PREF), null, null);
    expect(labels).toHaveLength(1);
    expect(labels[0].object.value).toBe("Light-driven carbon fixation");
    // exactly ONE stamp each, re-pointed at v2
    const hashes = out.getQuads(null, namedNode(STAMP_PRED), null, null);
    expect(hashes).toHaveLength(1);
    expect(hashes[0].object.value).toBe(sha(BODY_V2));
    expect(out.getQuads(null, namedNode(VERSION_PRED), null, null)).toHaveLength(1);
    // exact path → no degraded signal
    expect(pendingCurationSignals).toHaveLength(0);
  });

  it("(b) no git history → pairShadow (residue stays) + degraded signal emitted", async () => {
    const { listener, url, fsPath } = setup("nohistory");

    writeFileSync(fsPath, BODY_V1);
    await project(listener, url); // first write, silent
    appendFileSync(`${fsPath}.meta`, `\n<${url}#this> <urn:agentOwned> "keep" .\n`);
    // NO commit — git history empty
    writeFileSync(fsPath, BODY_V2);
    await project(listener, url);

    const out = readMeta(fsPath, url);
    // pairShadow preserves the agent triple
    expect(out.getQuads(null, namedNode("urn:agentOwned"), null, null)).toHaveLength(1);
    // documented degraded residue: V2 emits no broader pair → the stale edge REMAINS
    expect(out.getQuads(null, namedNode(SKOS_BROADER), null, null)).toHaveLength(1);
    // signal queued, naming the resource
    expect(pendingCurationSignals).toHaveLength(1);
    expect(pendingCurationSignals[0]).toContain(url);
    expect(pendingCurationSignals[0]).toContain("StalenessDetected");
  });

  it("(c) projector-version mismatch in the on-disk .meta → degraded + signal (git history present)", async () => {
    const { listener, url, fsPath } = setup("mismatch");

    writeFileSync(fsPath, BODY_V1);
    await project(listener, url);
    commitAll(dir, "v1", "2026-01-01T00:00:00Z");
    // doctor the stamp to an older projector version
    const doctored = readFileSync(`${fsPath}.meta`, "utf8")
      .replace(`"${pkgVersion()}"`, '"0.0.0-stale"');
    writeFileSync(`${fsPath}.meta`, doctored);

    writeFileSync(fsPath, BODY_V2);
    await project(listener, url);

    expect(pendingCurationSignals).toHaveLength(1);
    // degraded residue: the dropped edge remains under pairShadow
    const out = readMeta(fsPath, url);
    expect(out.getQuads(null, namedNode(SKOS_BROADER), null, null)).toHaveLength(1);
    // stamps re-pointed at the current version (do not accumulate)
    const versions = out.getQuads(null, namedNode(VERSION_PRED), null, null);
    expect(versions).toHaveLength(1);
    expect(versions[0].object.value).toBe(pkgVersion());
  });
});

// (f) the git argv agreement test — gitRead.ts mirrors memento/src/git.ts; no package
// edge between the extensions, so the invocation strings are pinned textually (the
// repo's mirror-test idiom, like versionAgreement/stampAgreement).
describe("gitRead ↔ memento git argv agreement", () => {
  const here = readFileSync(join(__dirname, "..", "src-cjs", "gitRead.ts"), "utf8");
  const memento = readFileSync(
    join(__dirname, "..", "..", "memento", "src", "git.ts"), "utf8",
  );

  const PINNED = [
    '"log", "-1"',
    "`--before=${iso}`",
    '"--name-status"',
    '"--format=COMMIT%x09%H%x09%cI"',
    "`${hash}:${path}`",
    "maxBuffer: 64 * 1024 * 1024",
  ];

  for (const s of PINNED) {
    it(`both files carry ${JSON.stringify(s)}`, () => {
      expect(here).toContain(s);
      expect(memento).toContain(s);
    });
  }
});
