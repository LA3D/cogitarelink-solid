import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Parser, Store } from "n3";
import { projectionPipeline } from "../src/projectionPipeline.js";

const FIX_ROOT = join(__dirname, "../../../../tests/fixtures/wiki-memory-l3");

function loadStore(path: string, baseIRI: string): Store {
    const ttl = readFileSync(path, "utf8");
    const s = new Store();
    s.addQuads(new Parser({ baseIRI }).parse(ttl));
    return s;
}

function isographic(a: Store, b: Store): boolean {
    if (a.size !== b.size) return false;
    const aQuads = a.getQuads(null, null, null, null);
    return aQuads.every(q =>
        b.countQuads(q.subject, q.predicate, q.object, null) > 0
    );
}

function dumpStore(label: string, store: Store): void {
    console.error(`\n--- ${label} (${store.size} triples) ---`);
    for (const q of store.getQuads(null, null, null, null)) {
        console.error(`  <${q.subject.value}> <${q.predicate.value}> ${
            q.object.termType === "Literal"
                ? JSON.stringify(q.object.value)
                : `<${q.object.value}>`
        }`);
    }
}

describe("projectionPipeline", () => {
    it("Wiki-Memory L3 Profile body+frontmatter projects to graph-equal .meta", async () => {
        const body = readFileSync(join(FIX_ROOT, "bodies", "wiki-memory-l3-profile.md"), "utf8");
        const baseIRI = "http://localhost:3000/wiki/pages/wiki-memory-l3-profile.md";
        const expected = loadStore(join(FIX_ROOT, "meta", "wiki-memory-l3-profile.md.meta"), baseIRI);
        const triples = await projectionPipeline.run(baseIRI, body);
        const actual = new Store(triples);
        if (!isographic(actual, expected)) {
            dumpStore("ACTUAL", actual);
            dumpStore("EXPECTED", expected);
        }
        expect(isographic(actual, expected)).toBe(true);
    });

    it("Agentic Memory Systems MOC projects to graph-equal .meta", async () => {
        const body = readFileSync(join(FIX_ROOT, "bodies", "agentic-memory-systems-moc.md"), "utf8");
        const baseIRI = "http://localhost:3000/wiki/pages/agentic-memory-systems-moc.md";
        const expected = loadStore(join(FIX_ROOT, "meta", "agentic-memory-systems-moc.md.meta"), baseIRI);
        const triples = await projectionPipeline.run(baseIRI, body);
        const actual = new Store(triples);
        if (!isographic(actual, expected)) {
            dumpStore("ACTUAL", actual);
            dumpStore("EXPECTED", expected);
        }
        expect(isographic(actual, expected)).toBe(true);
    });

    it("Ghumare source projects to graph-equal .meta", async () => {
        const body = readFileSync(join(FIX_ROOT, "bodies", "ghumare---llm-wiki-v2-extending-karpathy.md"), "utf8");
        const baseIRI = "http://localhost:3000/wiki/sources/ghumare---llm-wiki-v2-extending-karpathy.md";
        const expected = loadStore(join(FIX_ROOT, "meta", "ghumare---llm-wiki-v2-extending-karpathy.md.meta"), baseIRI);
        const triples = await projectionPipeline.run(baseIRI, body);
        const actual = new Store(triples);
        if (!isographic(actual, expected)) {
            dumpStore("ACTUAL", actual);
            dumpStore("EXPECTED", expected);
        }
        expect(isographic(actual, expected)).toBe(true);
    });

    it("Karpathy person projects to graph-equal .meta", async () => {
        const body = readFileSync(join(FIX_ROOT, "bodies", "karpathy-andrej.md"), "utf8");
        const baseIRI = "http://localhost:3000/wiki/people/karpathy-andrej.md";
        const expected = loadStore(join(FIX_ROOT, "meta", "karpathy-andrej.md.meta"), baseIRI);
        const triples = await projectionPipeline.run(baseIRI, body);
        const actual = new Store(triples);
        if (!isographic(actual, expected)) {
            dumpStore("ACTUAL", actual);
            dumpStore("EXPECTED", expected);
        }
        expect(isographic(actual, expected)).toBe(true);
    });

    it("running the pipeline twice on same input produces identical output", async () => {
        const body = readFileSync(join(FIX_ROOT, "bodies", "wiki-memory-l3-profile.md"), "utf8");
        const uri = "http://localhost:3000/wiki/pages/wiki-memory-l3-profile.md";
        const t1 = await projectionPipeline.run(uri, body);
        const t2 = await projectionPipeline.run(uri, body);
        expect(new Store(t1).size).toBe(new Store(t2).size);
        expect(isographic(new Store(t1), new Store(t2))).toBe(true);
    });

    it("Bug F: page resource rdf:type deduplication — prevents <> from being typed as domain class when invariants emit it on <#this>", async () => {
        const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
        const SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept";
        const WIKI_PAGE = "https://pod.vardeman.me/vault/ontology/wiki#Page";

        const body = `---
title: Bug F Smoke Test
type: skos:Concept
---

# Bug F Smoke Test

Body content.`;
        const resourceUri = "http://localhost:3000/wiki/concepts/bugf-smoke.md";
        const triples = await projectionPipeline.run(resourceUri, body);
        const store = new Store(triples);

        // Page resource <> should have wiki:Page type
        const pageTypes = store
            .getQuads(null, null, null, null)
            .filter((q) => q.subject.value === resourceUri && q.predicate.value === RDF_TYPE)
            .map((q) => q.object.value);
        expect(pageTypes).toContain(WIKI_PAGE);

        // Page resource <> should NOT have the domain Thing class (skos:Concept) — Bug F
        expect(pageTypes).not.toContain(SKOS_CONCEPT);

        // Thing <#this> should have skos:Concept type
        const thingTypes = store
            .getQuads(null, null, null, null)
            .filter((q) => q.subject.value === resourceUri + "#this" && q.predicate.value === RDF_TYPE)
            .map((q) => q.object.value);
        expect(thingTypes).toContain(SKOS_CONCEPT);
    });
});

const RES = "https://pod.vardeman.me/vault/wiki/concepts/decay-theory.md";
const PROV_GEN = "http://www.w3.org/ns/prov#wasGeneratedBy";
// podRoot strips the path (protocol+host only), so the affordance URI has no /vault/ prefix.
const AFFORDANCE = "https://pod.vardeman.me/meta/affordances/markdown-projection";

const BODY = `---
type: concept
---
# Decay Theory

A concept.
`;

describe("provenance placement (RQ-Listener-1 collapse)", () => {
  it("does NOT stamp the affordance URI on the resource subject anymore", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const stamp = triples.find(
      q => q.subject.value === RES && q.predicate.value === PROV_GEN
           && q.object.value === AFFORDANCE);
    expect(stamp).toBeUndefined();
  });

  it("relocates the projector audit stamp onto the .meta document subject", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const audit = triples.find(
      q => q.subject.value === RES + ".meta" && q.predicate.value === PROV_GEN
           && q.object.value === AFFORDANCE);
    expect(audit).toBeDefined();
  });

  it("emits NO resource-level wasGeneratedBy (provenance lives in .operations/)", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const onResource = triples.find(
      q => q.subject.value === RES && q.predicate.value === PROV_GEN);
    expect(onResource).toBeUndefined();
  });
});

describe("ThingShape conformance", () => {
  it("emits schema:name on <#this> derived from the title (ThingShape minCount 1)", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const name = triples.find(
      q => q.subject.value === RES + "#this"
           && q.predicate.value === "https://schema.org/name");
    expect(name).toBeDefined();
    expect(name!.object.value).toBe("Decay Theory");  // from the H1
  });
});
