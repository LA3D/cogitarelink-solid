// metaWriter.ts
//
// Writes projected triples to .meta sidecar files with:
//   - File lock (O_CREAT | O_EXCL) mirroring D68 .git/memento.lock pattern
//   - Model A predicate replacement: only governed predicates are replaced;
//     agent-owned triples (predicates NOT in the governed set) are preserved
//
// The "replace-governed" contract means:
//   - Old governed triples are removed
//   - New projected triples are inserted
//   - Non-governed triples are left untouched
//
// This lets agents annotate resources without their edits being wiped by
// the next body-projection pass (D50/D71/D72).
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
import type { NamedNode } from "n3";

const STALE_LOCK_MS = 30_000;

const PROV_GEN_BY = "http://www.w3.org/ns/prov#wasGeneratedBy";

export class MetaWriter {
    /**
     * Replace all governed-predicate triples in the .meta file with the
     * projected quads, leaving non-governed triples untouched.
     *
     * @param target      Absolute path to the resource file (NOT the .meta file)
     * @param projected   New triples to write for governed predicates
     * @param governed    Set of predicate URIs this caller owns
     * @param resourceUrl HTTP URL of the resource (used as base IRI for .meta parsing
     *                    so that relative URIs in agent-owned triples survive the
     *                    parse → write → re-parse cycle unchanged)
     */
    async replaceGoverned(
        target: string,
        projected: Quad[],
        governed: string[],
        resourceUrl?: string,
    ): Promise<void> {
        const metaPath = `${target}.meta`;
        const lockPath = `${metaPath}.lock`;
        // Base IRI for parsing existing .meta: use the meta-file URL so that
        // CSS-style relative subjects (<wiki-memory-l3-profile.md>) and PATCH-inserted
        // self-references (<>) both resolve to absolute URIs and survive the write cycle.
        const metaBaseIri = resourceUrl ? `${resourceUrl}.meta` : undefined;

        await this.withLock(lockPath, async () => {
            const existing = this.readExisting(metaPath, metaBaseIri);
            const govSet   = new Set(governed);

            // Keep triples whose predicate is NOT in the governed set.
            // prov:wasGeneratedBy gets a one-predicate SUBJECT scope (F7): the
            // pipeline only ever emits it on the .meta DOCUMENT subject
            // (projectionPipeline.ts), so stripping it by predicate on other
            // subjects deleted derivation pointers like the index view's
            // <resource> prov:wasGeneratedBy <view-descriptor>. NOT generalized
            // to pair-scoping — that collides with the replace-stale-values
            // contract; broad agent-triple survival stays D82's problem.
            const preserved = existing
                .getQuads(null, null, null, null)
                .filter(q => !govSet.has(q.predicate.value)
                    || (q.predicate.value === PROV_GEN_BY
                        && metaBaseIri !== undefined
                        && q.subject.value !== metaBaseIri));

            const merged = new Store([...preserved, ...projected]);
            await this.write(metaPath, merged);
        });
    }

    // -------------------------------------------------------------------------

    private readExisting(metaPath: string, baseIRI?: string): Store {
        if (!existsSync(metaPath)) return new Store();
        try {
            const ttl = readFileSync(metaPath, "utf8");
            const parser = baseIRI ? new Parser({ baseIRI }) : new Parser();
            return new Store(parser.parse(ttl));
        } catch {
            return new Store();
        }
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
