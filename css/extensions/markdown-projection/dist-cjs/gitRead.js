"use strict";
// gitRead.ts — thin read-only git helpers for the listener backstop (PSP T5, spec §5).
//
// MIRRORED from css/extensions/memento/src/git.ts (gitLogBefore lines ~99-110 +
// gitShow lines ~112-114): markdown-projection has NO package edge to the memento
// extension (cross-bundle injection is structural, not nominal — the same constraint
// that produced stampPredicates.ts), so the exec idiom and the git argv/format
// strings are duplicated here verbatim. The agreement test in
// test/listenerBackstop.test.ts pins both files' invocation strings equal (the
// repo's mirror-test idiom — see versionAgreement / stampAgreement).
//
// Read-only by design: memento's withLock guards COMMITS; log/show need no lock.
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitLogBefore = gitLogBefore;
exports.gitShow = gitShow;
exports.recoverPriorBody = recoverPriorBody;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_crypto_1 = require("node:crypto");
const exec = (0, node_util_1.promisify)(node_child_process_1.execFile);
async function gitStr(gitDir, args) {
    const r = await exec("git", args, { cwd: gitDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return r.stdout;
}
async function gitBuf(gitDir, args) {
    const r = await exec("git", args, { cwd: gitDir, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    return r.stdout;
}
/**
 * Newest commit touching `path` with commit date <= `beforeIso`. NOTE git's
 * `--before` is INCLUSIVE of the boundary instant — walking past a known commit
 * therefore needs a strictly earlier query datetime (see recoverPriorBody).
 * Null when no matching commit exists (or the repo has none).
 */
async function gitLogBefore(gitDir, beforeIso, path) {
    const iso = beforeIso;
    const out = (await gitStr(gitDir, [
        "log", "-1",
        `--before=${iso}`,
        "--name-status",
        "--format=COMMIT%x09%H%x09%cI",
        "--", path,
    ])).trim();
    for (const line of out.split("\n")) {
        if (line.startsWith("COMMIT\t")) {
            const [, hash, cIso] = line.split("\t");
            return { hash, datetime: new Date(cIso) };
        }
    }
    return null;
}
async function gitShow(gitDir, hash, path) {
    return gitBuf(gitDir, ["show", `${hash}:${path}`]);
}
const sha256 = (s) => (0, node_crypto_1.createHash)("sha256").update(s).digest("hex");
/**
 * Recover the body whose projection the CURRENT .meta carries — the body whose
 * sha256 equals `wantSha256` (the .meta's sub:bodyHash stamp) — from the Memento
 * git history. The stamp match is the correctness guard: f(recovered) is exactly
 * the projection sitting in .meta, so subtracting it can never be wrong.
 *
 * Commit timing (read from MementoCommitListener): the memento listener commits on
 * its OWN promise chain off the same MonitoringStore 'changed' event that triggers
 * this backstop — there is NO ordering guarantee between the two chains, so at
 * backstop time the newest commit may be either the pre-write (old) body or the
 * already-committed NEW body. Hence:
 *   1. take the newest commit; accept it only if it hash-matches the stamp;
 *   2. if it instead matches the CURRENT on-disk body (memento won the race), walk
 *      ONE commit back — git's --before is inclusive, so re-query at (newest − 1s)
 *      and require a different hash. Commit-date granularity is seconds, so a
 *      same-second commit pair is unresolvable this way: we return null rather
 *      than risk a wrong subtraction (the plan's PREFER-degraded directive);
 *   3. a walk-back that does not hash-match the stamp also returns null —
 *      degraded pair-shadow over a wrong exact subtraction, always.
 */
async function recoverPriorBody(gitDir, path, currentSha256, wantSha256) {
    try {
        const newest = await gitLogBefore(gitDir, new Date().toISOString(), path);
        if (newest === null)
            return null;
        const candidate = (await gitShow(gitDir, newest.hash, path)).toString("utf8");
        const candidateSha = sha256(candidate);
        if (candidateSha === wantSha256)
            return candidate;
        // History diverged from BOTH the stamped state and the current write → degraded.
        if (candidateSha !== currentSha256)
            return null;
        // The new write is already committed → step past it (strictly earlier instant).
        const prior = await gitLogBefore(gitDir, new Date(newest.datetime.getTime() - 1000).toISOString(), path);
        if (prior === null || prior.hash === newest.hash)
            return null;
        const walked = (await gitShow(gitDir, prior.hash, path)).toString("utf8");
        return sha256(walked) === wantSha256 ? walked : null;
    }
    catch {
        // No repo / no commits / unreadable object — degraded, never throw.
        return null;
    }
}
