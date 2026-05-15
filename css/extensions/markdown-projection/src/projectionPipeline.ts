// projectionPipeline.ts
//
// Combines frontmatterProjection + wikilinkProjection into the full .meta
// projection pass described by D58/D71/D72.
//
// Additional derivations beyond the individual projection modules:
//   - dct:title — extracted from the first H1 heading when not in frontmatter
//   - dct:identifier — derived from the URI slug when not in frontmatter
//   - prov:wasGeneratedBy — stamped to the affordance descriptor URI (D69)

import { DataFactory, Quad } from "n3";
import * as YAML from "yaml";
import { projectFrontmatter, Frontmatter } from "./frontmatterProjection.js";
import { projectWikilinks } from "./wikilinkProjection.js";

const { namedNode, literal, quad } = DataFactory;

const DCT_TITLE       = "http://purl.org/dc/terms/title";
const DCT_IDENTIFIER  = "http://purl.org/dc/terms/identifier";
const PROV_GEN_BY     = "http://www.w3.org/ns/prov#wasGeneratedBy";
const AFFORDANCE_PATH = "/meta/affordances/markdown-projection";

// ---------------------------------------------------------------------------
// Frontmatter splitting
// ---------------------------------------------------------------------------

function splitFrontmatter(body: string): { fm: Frontmatter; rest: string } {
    if (!body.startsWith("---\n")) return { fm: {}, rest: body };
    const end = body.indexOf("\n---\n", 4);
    if (end < 0) return { fm: {}, rest: body };
    const fmText = body.slice(4, end);
    const rest   = body.slice(end + 5);
    try {
        return { fm: YAML.parse(fmText) ?? {}, rest };
    } catch {
        return { fm: {}, rest };
    }
}

// ---------------------------------------------------------------------------
// H1 extraction
// ---------------------------------------------------------------------------

function extractH1(text: string): string | undefined {
    const m = text.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : undefined;
}

// ---------------------------------------------------------------------------
// URI slug extraction
// Pulls the filename stem from a URI like
//   http://localhost:3000/wiki/pages/wiki-memory-l3-profile.md
//   → "wiki-memory-l3-profile"
// ---------------------------------------------------------------------------

function uriSlug(uri: string): string {
    const last = uri.split("/").pop() ?? "";
    return last.endsWith(".md") ? last.slice(0, -3) : last;
}

// ---------------------------------------------------------------------------
// Pod root extraction
// http://localhost:3000/wiki/pages/foo.md → http://localhost:3000
// ---------------------------------------------------------------------------

function podRoot(uri: string): string {
    try {
        const u = new URL(uri);
        return `${u.protocol}//${u.host}`;
    } catch {
        // Fallback: strip everything after the third slash segment
        const m = uri.match(/^(https?:\/\/[^/]+)/);
        return m ? m[1] : "";
    }
}

// ---------------------------------------------------------------------------
// Subject rebinding (placeholder → real URI)
// ---------------------------------------------------------------------------

function rebindSubject(triples: Quad[], realSubject: string): Quad[] {
    const real = namedNode(realSubject);
    return triples.map(t =>
        quad(real, t.predicate as any, t.object as any),
    );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const projectionPipeline = {
    async run(resourceUri: string, body: string): Promise<Quad[]> {
        const { fm, rest } = splitFrontmatter(body);

        // Frontmatter → quads (subject still urn:placeholder:subject)
        const fmTriples = rebindSubject(projectFrontmatter(fm), resourceUri);

        // Body wikilinks → quads (subject = resourceUri)
        const wikiTriples = projectWikilinks(rest, resourceUri);

        // Derived: dct:title from H1 when frontmatter carries no title
        const derived: Quad[] = [];
        if (!fm.title) {
            const h1 = extractH1(body);
            if (h1) {
                derived.push(quad(namedNode(resourceUri), namedNode(DCT_TITLE), literal(h1)));
            }
        }

        // Derived: dct:identifier from URI slug when frontmatter carries no identifier/citekey
        if (!fm.identifier && !fm.citekey) {
            const id = uriSlug(resourceUri);
            if (id) {
                derived.push(quad(namedNode(resourceUri), namedNode(DCT_IDENTIFIER), literal(id)));
            }
        }

        // Provenance stamp — absolute URI constructed from pod root (D52/D69)
        const affordanceUri = `${podRoot(resourceUri)}${AFFORDANCE_PATH}`;
        const provTriple = quad(
            namedNode(resourceUri),
            namedNode(PROV_GEN_BY),
            namedNode(affordanceUri),
        );

        return [...fmTriples, ...derived, ...wikiTriples, provTriple];
    },
};
