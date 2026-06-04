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
        const baseIRI = "http://localhost:3000/wiki/concepts/wiki-memory-l3-profile.md";
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
        const baseIRI = "http://localhost:3000/wiki/concepts/agentic-memory-systems-moc.md";
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

describe("dct:identifier subject framing (C-T2 / option C)", () => {
  const DCT_ID = "http://purl.org/dc/terms/identifier";
  // type: wiki:Source so invariants emit (<#this> a wiki:Source); the page lives
  // in concepts/ per D98. The frontmatter citekey is the entity's external id.
  const SRC_URI = "https://pod.vardeman.me/vault/wiki/concepts/zhang-2025.md";
  const SRC_BODY = `---\ntype: wiki:Source\ncitekey: zhang-2025\n---\n# Zhang 2025\n\nA source.\n`;

  it("rebinds frontmatter citekey to <#this> dct:identifier (not the page <>)", async () => {
    const triples = await projectionPipeline.run(SRC_URI, SRC_BODY);
    const ids = triples.filter((q) => q.predicate.value === DCT_ID);
    expect(ids).toHaveLength(1);
    expect(ids[0].subject.value).toBe(SRC_URI + "#this");
    expect(ids[0].object.value).toBe("zhang-2025");
    // never on the page subject
    expect(triples.find((q) => q.predicate.value === DCT_ID && q.subject.value === SRC_URI)).toBeUndefined();
  });

  it("emits NO derived dct:identifier slug when frontmatter carries none (the URI is the id)", async () => {
    const body = `---\ntype: concept\n---\n# Decay Theory\n\n[Decay Theory]{.prefLabel}\n`;
    const triples = await projectionPipeline.run(
      "https://pod.vardeman.me/vault/wiki/concepts/decay-theory.md", body);
    expect(triples.find((q) => q.predicate.value === DCT_ID)).toBeUndefined();
  });
});

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

describe("routing via predicateToClass", () => {
  it("routes a body {.affiliation} link via injected Type Index + routing map (diverges from defaults)", async () => {
    // Deliberately contradict the defaults: BOOTSTRAP maps affiliation→Organization and
    // DEFAULT_WIKI_TYPE_INDEX registers organizations/. Here we route affiliation→Place
    // and register only places/, so the OLD unthreaded pipeline (which used the defaults)
    // would land the object in organizations/ — only correct threading yields places/.
    const typeIndex = {
      "/vault/wiki/concepts/": "http://www.w3.org/2004/02/skos/core#Concept",
      "/vault/wiki/places/":   "https://schema.org/Place",
    };
    const routing = { "https://schema.org/affiliation": "https://schema.org/Place" };
    const quads = await projectionPipeline.run(
      "https://pod.example/vault/wiki/concepts/jarek.md",
      "# Jarek\n\nWorks at [[Notre Dame]]{.affiliation}.\n",
      typeIndex,
      routing,
    );
    const edge = quads.find(q => q.predicate.value === "https://schema.org/affiliation");
    expect(edge?.object.value).toBe("https://pod.example/vault/wiki/places/notre-dame.md#this");
  });
});
