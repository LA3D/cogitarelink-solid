// operationLog.ts
//
// Reads the canonical operation log at /vault/wiki/.operations/ from disk and
// returns the latest mem:Action announcement whose as:object is a given
// resource. Pure aside from the filesystem read (mirrors the listener's
// readFileSync pattern — never re-enters the store). Feeds the derived
// prov:wasGeneratedBy edge in projectionPipeline (RQ-Listener-1 design).

import { readdirSync, readFileSync, existsSync } from "fs";
import * as path from "path";
import { Parser } from "n3";

const AS         = "https://www.w3.org/ns/activitystreams#";
const AS_OBJECT  = AS + "object";
const AS_PUBLISHED = AS + "published";
const RDF_TYPE   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MEM        = "https://pod.vardeman.me/vault/ontology/mem#";

export interface ActionProvenance {
    activityUrl: string;  // dereferenceable announcement resource URL (the <> subject)
    actionType: string;   // mem:*Action IRI
    publishedAt: string;  // xsd:dateTime lexical value (ISO 8601, lexically sortable)
}

// Reconstruct the announcement resource URL from its on-disk filename.
// CSS stores a Turtle resource PUT at <ops>/<slug>.ttl on disk; confirm the
// exact suffix in Task 1 and adjust here if a $.ttl content-type suffix is present.
function filenameToUrl(opsBaseUrl: string, fname: string): string {
    const slug = fname.endsWith("$.ttl") ? fname.slice(0, -"$.ttl".length) : fname;
    return opsBaseUrl + slug;
}

export function findLatestAction(
    opsDir: string,
    resourceUri: string,
    opsBaseUrl: string,
): ActionProvenance | undefined {
    if (!existsSync(opsDir)) return undefined;

    let best: ActionProvenance | undefined;
    for (const fname of readdirSync(opsDir)) {
        if (fname.startsWith(".")) continue;            // .meta / .acl / .internal
        if (!fname.endsWith(".ttl")) continue;          // only Turtle announcements
        const annUrl = filenameToUrl(opsBaseUrl, fname);

        let quads;
        try {
            quads = new Parser({ baseIRI: annUrl })
                .parse(readFileSync(path.join(opsDir, fname), "utf8"));
        } catch {
            continue;  // unparseable → skip, never block projection
        }

        const targets = quads.filter(q => q.predicate.value === AS_OBJECT)
                             .map(q => q.object.value);
        if (!targets.includes(resourceUri)) continue;

        const actionType = quads.find(
            q => q.predicate.value === RDF_TYPE && q.object.value.startsWith(MEM),
        )?.object.value;
        if (!actionType) continue;

        const publishedAt = quads.find(
            q => q.predicate.value === AS_PUBLISHED,
        )?.object.value ?? "";

        if (!best || publishedAt > best.publishedAt) {
            best = { activityUrl: annUrl, actionType, publishedAt };
        }
    }
    return best;
}
