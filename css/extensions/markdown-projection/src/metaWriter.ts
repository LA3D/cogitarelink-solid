// metaWriter.ts
//
// Writes projected triples to .meta sidecar files with:
//   - File lock (O_CREAT | O_EXCL) mirroring D68 .git/memento.lock pattern
//   - Provenance-scoped replacement (spec 2026-06-12 §4): the subtraction removes
//     exactly the quad set the projection produced LAST time — recomputed from the
//     old body, not matched by schema. Agent triples survive by construction,
//     including ones using governed predicates on other subjects.
//
//   .meta_next = ( .meta_current − f(body_old) ) ∪ f(body_new)
//
// The governed-predicate set is no longer a clobber list — it remains the floor's
// validation dispatch + the agent-facing declaration (sub:governs, D81 Model A).
// Ownership enforcement belongs to the admission floor (D108), not here.
//
// (A buildTwoSubjectPatch N3-Patch generator lived here 2026-05-19 → 2026-06-10;
// it was never wired into the write path — the Store-merge above IS the
// mechanism — and was removed as dead code. See D95/D96 mechanism annotation.)

import {
    openSync,
    closeSync,
    readFileSync,
    writeFileSync,
    existsSync,
    statSync,
    unlinkSync,
    constants,
} from "fs";
import { Parser, Quad, Store, Writer } from "n3";
import { subtractProjected, pairShadow } from "./projectionDelta.js";

const STALE_LOCK_MS = 30_000;

export interface ReplaceOpts {
    resourceUrl?: string;
    /** Pre-commit .meta snapshot (Turtle). When given, the on-disk .meta is IGNORED —
     *  the caller (the floor) read it BEFORE CSS's writeMetadataFile clobbered it
     *  (the D82 root cause; see tests/test_wiki_memory_l3_listener_integration.py:162's
     *  xfail message). */
    snapshotTtl?: string;
}

export class MetaWriter {
    /**
     * Replace the prior projection's quads in the .meta file with the new
     * projection, leaving everything else untouched (spec §4 subtraction).
     *
     * @param target       Absolute path to the resource file (NOT the .meta file)
     * @param newProjected f(body_new) — the quads to write
     * @param oldProjected f(body_old) — exact subtraction; null → degraded
     *                     pairShadow (caller owns the curation signal, spec §5)
     * @param opts         resourceUrl is the base IRI for .meta parsing so relative
     *                     URIs survive the parse → write → re-parse cycle unchanged;
     *                     snapshotTtl overrides the on-disk .meta as current state
     */
    async replaceProjected(
        target: string,
        newProjected: Quad[],
        oldProjected: Quad[] | null,
        opts: ReplaceOpts = {},
    ): Promise<void> {
        const metaPath = `${target}.meta`;
        const lockPath = `${metaPath}.lock`;
        // Base IRI for parsing existing .meta: use the meta-file URL so that
        // CSS-style relative subjects (<wiki-memory-l3-profile.md>) and PATCH-inserted
        // self-references (<>) both resolve to absolute URIs and survive the write cycle.
        const metaBaseIri = opts.resourceUrl ? `${opts.resourceUrl}.meta` : undefined;

        await this.withLock(lockPath, async () => {
            const existing = opts.snapshotTtl !== undefined
                ? this.parseTtl(opts.snapshotTtl, metaBaseIri)
                : this.readExisting(metaPath, metaBaseIri);
            const current = existing.getQuads(null, null, null, null);

            const preserved = oldProjected === null
                ? pairShadow(current, newProjected)
                : subtractProjected(current, oldProjected);

            const merged = new Store([...preserved, ...newProjected]);
            await this.write(metaPath, merged);
        });
    }

    // -------------------------------------------------------------------------

    private parseTtl(ttl: string, baseIRI?: string): Store {
        try {
            const parser = baseIRI ? new Parser({ baseIRI }) : new Parser();
            return new Store(parser.parse(ttl));
        } catch {
            return new Store();
        }
    }

    private readExisting(metaPath: string, baseIRI?: string): Store {
        if (!existsSync(metaPath)) return new Store();
        return this.parseTtl(readFileSync(metaPath, "utf8"), baseIRI);
    }

    private async write(metaPath: string, store: Store): Promise<void> {
        const writer = new Writer();
        for (const q of store.getQuads(null, null, null, null)) {
            writer.addQuad(q);
        }
        await new Promise<void>((resolve, reject) => {
            writer.end((err, result) => {
                if (err) return reject(err);
                writeFileSync(metaPath, result);
                resolve();
            });
        });
    }

    private async withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
        // Recover stale lock (e.g. crash during previous write)
        if (existsSync(lockPath)) {
            const age = Date.now() - statSync(lockPath).mtimeMs;
            if (age > STALE_LOCK_MS) {
                try { unlinkSync(lockPath); } catch {}
            }
        }

        let fd: number;
        try {
            fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR);
        } catch (e: any) {
            if (e.code === "EEXIST") {
                // Lock held by another writer — back off and retry
                await new Promise(r => setTimeout(r, 50));
                return this.withLock(lockPath, fn);
            }
            throw e;
        }

        try {
            return await fn();
        } finally {
            try { closeSync(fd); } catch {}
            try { unlinkSync(lockPath); } catch {}
        }
    }
}
