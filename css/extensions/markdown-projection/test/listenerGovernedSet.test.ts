// R-T2 / audit R1.3 + P3 — listener-path corrections.
//
// (a) The listener resolves the governed-predicate set via resolveGovernedFromQuads
//     keyed off the <#this> rdf:type (NOT detectClass's first rdf:type, which is
//     the page's wiki:Page after the Bug-F filter and dropped the skos axis). A
//     concept body's governed set must include skos:prefLabel.
// (b) The listener extracts the frontmatter type via the pipeline's YAML
//     splitFrontmatter (NOT a private `^type:` regex). The regex captured inline
//     YAML comments into the IRI; YAML parses the clean value.
import { describe, it, expect } from "vitest";
import { projectionPipeline, resolveGovernedFromQuads, splitFrontmatter } from "../src/index.js";

const SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const STORAGE_BASE = "https://pod.vardeman.me/vault";

describe("listener-path governed set keyed off <#this> rdf:type (R1.3)", () => {
    it("a concept body's governed set includes skos:prefLabel (skos axis not dropped)", async () => {
        // type: concept → wiki:Concept → <#this> a skos:Concept (via TYPE_MAP +
        // invariants). The Bug-F filter strips the domain class off <>, so the
        // FIRST rdf:type in the array is wiki:Page — the old detectClass path
        // would have resolved schema:Thing's COMMON predicates (no skos). The
        // <#this>-keyed resolution recovers the full concept governed set.
        const uri = `${STORAGE_BASE}/wiki/concepts/photosynthesis.md`;
        const body = "---\ntype: concept\n---\n# Photosynthesis\n\n[Photosynthesis]{.prefLabel}\n";
        const triples = await projectionPipeline.run(uri, body, undefined, undefined, undefined, STORAGE_BASE);

        // The page's wiki:Page rdf:type is present and comes before the thing class.
        const firstType = triples.find(
            (q) => q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        );
        expect(firstType?.object.value).toBe("https://pod.vardeman.me/vault/ontology/wiki#Page");

        // The listener path: governed set keyed off <#this>.
        const governed = resolveGovernedFromQuads(triples, `${uri}#this`);
        expect(governed).toBeDefined();
        expect(governed).toContain(SKOS_PREFLABEL);
    });

    it("resolveGovernedFromQuads returns undefined when <#this> has no rdf:type", () => {
        // A plain body with no governed type → no <#this> rdf:type → not governed.
        const governed = resolveGovernedFromQuads([], "https://pod.example/x.md#this");
        expect(governed).toBeUndefined();
    });
});

describe("frontmatter type via YAML, not regex (P3)", () => {
    // The OLD private regex `^type:\s*(.+)$/m` captured the trailing inline YAML
    // comment INTO the IRI; YAML.parse returns the clean value. This is the
    // listener's frontmatterTypeIRI input — assert the splitter the listener now
    // reuses parses the clean IRI a `^type:` grep would have mangled.
    it("inline-comment type: value parses clean via splitFrontmatter (regex would include the comment)", () => {
        const body = "---\ntype: https://schema.org/Person  # canonical\n---\n# X\n";
        const { fm } = splitFrontmatter(body);
        expect(fm.type).toBe("https://schema.org/Person");

        // Demonstrate the regex defect the YAML path avoids.
        const fmBlock = body.slice(4, body.indexOf("\n---\n", 4));
        const regexCapture = fmBlock.match(/^type:\s*(.+)$/m)?.[1].trim();
        expect(regexCapture).toBe("https://schema.org/Person  # canonical"); // wrong (comment included)
        expect(regexCapture).not.toBe(fm.type);
    });

    it("a nested type: key does not shadow the absent top-level type (YAML returns undefined)", () => {
        // `source.type` is nested; there is NO top-level type. YAML → fm.type
        // undefined (correct: the resource is untyped). The regex would have
        // matched a column-0 `type:` if one existed; here the only `type:` is
        // indented, so both agree it's untyped — but YAML is the principled path.
        const body = "---\nsource:\n  type: https://evil.example/X\ntitle: A note\n---\n# X\n";
        const { fm } = splitFrontmatter(body);
        expect(fm.type).toBeUndefined();
        expect((fm.source as { type?: string }).type).toBe("https://evil.example/X");
    });
});
