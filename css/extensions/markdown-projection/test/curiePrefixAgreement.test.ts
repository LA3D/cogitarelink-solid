// CURIE prefix agreement: projection CURIE_PREFIXES ↔ served JSON-LD context
// (R-T7, audit R3 / P2 first row — previously "already diverged").
//
// Reconciliation (see frontmatterProjection.ts header): the invariant is set
// EQUALITY of the prefix-declaration terms. D79 makes the served context the
// agents' source of truth — a `type:` CURIE that resolves for an agent reading
// the context must resolve in projection, and any prefix projection can expand
// (and may land in .meta output: prov/as/mem/owl/rdfs/vcard) must be documented
// in the context so an agent can look it up. So both sides carry the union.
//
// Reads the maps sidecar (curiePrefixes, = the live CURIE_PREFIXES) and the
// served context fragment overlays/wiki-memory/context-fragment.jsonld. The
// context's prefix-declaration terms are the @context entries whose value is a
// plain namespace string (ends in # or /); term aliases like "title": "dct:title"
// are NOT prefix declarations.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..", "..", "..");
const MAPS = JSON.parse(readFileSync(join(__dirname, "..", "maps.json"), "utf8"));
const CTX = JSON.parse(
    readFileSync(join(ROOT, "overlays", "wiki-memory", "context-fragment.jsonld"), "utf8"),
);

function contextPrefixDecls(ctx: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(ctx["@context"] as Record<string, unknown>)) {
        if (typeof v === "string" && (v.endsWith("#") || v.endsWith("/"))) out[k] = v;
    }
    return out;
}

describe("CURIE prefix agreement (projection ↔ served context)", () => {
    const ctxPrefixes = contextPrefixDecls(CTX);
    const tsPrefixes: Record<string, string> = MAPS.curiePrefixes;

    it("the two prefix-declaration KEY SETS are equal", () => {
        expect(new Set(Object.keys(tsPrefixes))).toEqual(new Set(Object.keys(ctxPrefixes)));
    });

    it("every shared prefix maps to the SAME namespace IRI", () => {
        for (const [k, iri] of Object.entries(tsPrefixes)) {
            if (k in ctxPrefixes) expect(ctxPrefixes[k]).toBe(iri);
        }
    });

    it("each context term-CURIE uses a prefix the context itself declares (no dangling)", () => {
        // e.g. "title": "dct:title" must have a "dct" prefix declaration. This is
        // the latent JSON-LD defect the reconciliation fixed (skos/dct were used
        // but never declared).
        const declared = new Set(Object.keys(ctxPrefixes));
        for (const [, v] of Object.entries(CTX["@context"] as Record<string, unknown>)) {
            let curie: string | undefined;
            if (typeof v === "string" && v.includes(":") && !/^https?:/.test(v)) curie = v;
            else if (v && typeof v === "object" && typeof (v as any)["@id"] === "string") {
                const id = (v as any)["@id"] as string;
                if (id.includes(":") && !/^https?:/.test(id)) curie = id;
            }
            if (curie) {
                const prefix = curie.split(":", 1)[0];
                expect(declared, `term-CURIE ${curie} uses undeclared prefix ${prefix}`).toContain(prefix);
            }
        }
    });
});
