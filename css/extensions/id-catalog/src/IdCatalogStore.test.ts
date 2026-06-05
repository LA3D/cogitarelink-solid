/**
 * Unit tests for IdCatalogStore (D111 §4.4 — the server-derived identifier-scheme catalog).
 *
 * The catalog container's RDF carries one server-derived "thin entry" per scheme record.
 * Agents NEVER author those triples (the ldp:contains precedent): this store derives them
 * from record writes in-band, and rejects client writes that touch them.
 *
 * Seam discipline (the repo's standing lesson — exercise the REAL parse/serialize path,
 * don't mock it away): `source` is an in-memory stub that records calls and holds the
 * catalog .meta as a real internal/quads BasicRepresentation. The store's actual
 * deriveThinEntry / N3 parse / N3 Writer / readableToQuads paths all run for real; only
 * the backend storage is faked.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DataFactory, Store, Parser } from "n3";
import {
  BasicRepresentation,
  RepresentationMetadata,
  INTERNAL_QUADS,
  ConflictHttpError,
  readableToString,
  readableToQuads,
} from "@solid/community-server";
import { IdCatalogStore } from "./IdCatalogStore.js";

const { namedNode, quad, literal } = DataFactory;

const CATALOG = "https://pod.vardeman.me/id/schemes/";
const CATALOG_META = `${CATALOG}.meta`;
const RECORD = "https://pod.vardeman.me/id/schemes/doi";
const TOPIC = "https://pod.vardeman.me/id/schemes/#doi";
const TOPIC_NEW = "https://pod.vardeman.me/id/schemes/#doi-new";
const OTHER = "https://pod.vardeman.me/wiki/concepts/photosynthesis.md";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const FOAF = "http://xmlns.com/foaf/0.1/";
const IDOT = "http://identifiers.org/idot/";
const AS = "https://www.w3.org/ns/activitystreams#";
const SOLID_META = "http://www.w3.org/ns/solid/terms#";

// A realistic DOI scheme record (Turtle).
const DOI_RECORD = `
@prefix rdfs: <${RDFS}> .
@prefix skos: <${SKOS}> .
@prefix foaf: <${FOAF}> .
@prefix idot: <${IDOT}> .
<> foaf:primaryTopic <${TOPIC}> .
<${TOPIC}>
  a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "DOI" ;
  skos:definition "Digital Object Identifier" .
`;

// The same record re-PUT with a CHANGED foaf:primaryTopic (#doi → #doi-new).
const DOI_RECORD_NEW_TOPIC = `
@prefix rdfs: <${RDFS}> .
@prefix skos: <${SKOS}> .
@prefix foaf: <${FOAF}> .
@prefix idot: <${IDOT}> .
<> foaf:primaryTopic <${TOPIC_NEW}> .
<${TOPIC_NEW}>
  a idot:Namespace, skos:Concept, rdfs:Datatype ;
  skos:prefLabel "DOI" ;
  skos:definition "Digital Object Identifier" .
`;

// --- in-memory stub source --------------------------------------------------
//
// Holds one mutable .meta store (the catalog container's). Records every call so
// tests can assert pass-through identity. setRepresentation of the catalog .meta
// reads the incoming quads back into the held store (the REAL serialize→parse cycle).

interface Call { method: string; id: string; rep?: any; }

function makeSource(initialMetaQuads: any[] = []) {
  const metaStore = new Store(initialMetaQuads);
  const calls: Call[] = [];

  // Build a fresh ChangeMap-like Map keyed by the created identifier whose metadata
  // reports the as:Create activity. The store reads it via
  //   find(changes.keys(), k => changes.get(k)?.has(SOLID_AS.terms.activity, AS.terms.Create))
  // We mirror AdmissionFloorStore.test's idiom exactly: a `{ has: () => true }` stub —
  // a real RepresentationMetadata's vocab-term init is brittle under the Vite TS-source
  // resolution, and the seam under test is the find()+derive flow, not metadata.has().
  function changeMapForCreate(createdPath: string) {
    return new Map([[{ path: createdPath }, { has: () => true }]]);
  }

  const source = {
    calls,
    metaStore,
    async getRepresentation(id: { path: string }, _prefs?: any) {
      calls.push({ method: "getRepresentation", id: id.path });
      if (id.path === CATALOG_META) {
        // Serve the held catalog .meta as internal/quads (the runtime read shape).
        return new BasicRepresentation(metaStore.getQuads(null, null, null, null), INTERNAL_QUADS);
      }
      throw new Error(`unexpected getRepresentation ${id.path}`);
    },
    async setRepresentation(id: { path: string }, rep: any, _cond?: any) {
      calls.push({ method: "setRepresentation", id: id.path, rep });
      if (id.path === CATALOG_META) {
        // Re-read the quads back into the held store (REAL parse path).
        const ct = rep.metadata?.contentType;
        const store = ct === INTERNAL_QUADS
          ? await readableToQuads(rep.data)
          : await (async () => {
              const text = await readableToString(rep.data);
              return new Store(new Parser({ baseIRI: CATALOG }).parse(text));
            })();
        metaStore.removeQuads(metaStore.getQuads(null, null, null, null));
        metaStore.addQuads(store.getQuads(null, null, null, null));
      }
      return new Map();
    },
    async addResource(container: { path: string }, rep: any, _cond?: any) {
      calls.push({ method: "addResource", id: container.path, rep });
      return changeMapForCreate(RECORD);
    },
    async deleteResource(id: { path: string }, _cond?: any) {
      calls.push({ method: "deleteResource", id: id.path });
      return new Map();
    },
    async hasResource() { return true; },
  };
  return source;
}

function ttl(path: string, body: string) {
  return new BasicRepresentation(body, new RepresentationMetadata({ path }, "text/turtle"));
}

// An N3 InsertDeletePatch body (Patch-typed representation).
function n3Patch(path: string, body: string) {
  const meta = new RepresentationMetadata({ path }, "text/n3");
  return new BasicRepresentation(body, meta);
}

// --- helpers to read the derived entry from the held store ------------------

function entryQuadsFor(source: any, topic: string) {
  return source.metaStore.getQuads(namedNode(topic), null, null, null);
}

beforeEach(() => {});

describe("IdCatalogStore — client-write guards (ldp:contains precedent)", () => {
  it("rejects a PUT (setRepresentation) directly to the catalog container", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);
    await expect(
      store.setRepresentation({ path: CATALOG }, ttl(CATALOG, `<${CATALOG}> a <urn:x> .`)),
    ).rejects.toBeInstanceOf(ConflictHttpError);
    expect(source.calls.some((c) => c.method === "setRepresentation")).toBe(false);
  });

  it("rejects a PUT directly to the catalog .meta", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);
    await expect(
      store.setRepresentation({ path: CATALOG_META }, ttl(CATALOG_META, `<${TOPIC}> a <urn:x> .`)),
    ).rejects.toBeInstanceOf(ConflictHttpError);
  });

  it("rejects a PATCH that touches a catalog-fragment subject, naming the subject", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);
    const patch = `
@prefix solid: <${SOLID_META}> .
@prefix skos: <${SKOS}> .
<> a solid:InsertDeletePatch ;
  solid:inserts { <${CATALOG}#fake> a skos:Concept . } .`;
    await expect(
      store.modifyResource({ path: CATALOG_META }, n3Patch(CATALOG_META, patch) as any),
    ).rejects.toThrow(/server-derived/i);
    expect(source.calls.some((c) => c.method === "modifyResource")).toBe(false);
  });

  it("allows a PATCH on the catalog that does NOT touch a fragment subject", async () => {
    const source = makeSource();
    // give modifyResource on source a recorder
    (source as any).modifyResource = async (id: any) => {
      source.calls.push({ method: "modifyResource", id: id.path });
      return new Map();
    };
    const store = new IdCatalogStore(source as any, CATALOG);
    const patch = `
@prefix solid: <${SOLID_META}> .
@prefix dct: <http://purl.org/dc/terms/> .
<> a solid:InsertDeletePatch ;
  solid:inserts { <${CATALOG}> dct:title "Scheme catalog" . } .`;
    await store.modifyResource({ path: CATALOG_META }, n3Patch(CATALOG_META, patch) as any);
    expect(source.calls.some((c) => c.method === "modifyResource")).toBe(true);
  });

  it("a malformed (unparseable) patch passes through to source — no raw n3 error from our layer", async () => {
    const source = makeSource();
    (source as any).modifyResource = async (id: any) => {
      source.calls.push({ method: "modifyResource", id: id.path });
      return new Map();
    };
    const store = new IdCatalogStore(source as any, CATALOG);
    const garbage = n3Patch(CATALOG_META, "not n3 {{{");
    // Our guard must not surface a raw N3 ParseError; the request reaches source,
    // where CSS's own (same-family) patch handler rejects it with a proper 4xx.
    await expect(
      store.modifyResource({ path: CATALOG_META }, garbage as any),
    ).resolves.toBeDefined();
    expect(source.calls.some((c) => c.method === "modifyResource")).toBe(true);
  });
});

describe("IdCatalogStore — server derivation on record writes", () => {
  it("PUT of a record derives the 7-quad thin entry into the catalog .meta", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);

    await store.setRepresentation({ path: RECORD }, ttl(RECORD, DOI_RECORD));

    // Original record write passed through.
    const recWrite = source.calls.find((c) => c.method === "setRepresentation" && c.id === RECORD);
    expect(recWrite).toBeTruthy();
    // The .meta was rewritten (deriving=true write below Locking).
    const metaWrite = source.calls.find((c) => c.method === "setRepresentation" && c.id === CATALOG_META);
    expect(metaWrite).toBeTruthy();

    // The held catalog .meta now carries the full normative entry for the topic.
    const got = new Set(
      entryQuadsFor(source, TOPIC).map((q: any) => `${q.predicate.value} ${q.object.value}`),
    );
    expect(got).toEqual(new Set([
      `${RDF_TYPE} ${IDOT}Namespace`,
      `${RDF_TYPE} ${SKOS}Concept`,
      `${RDF_TYPE} ${RDFS}Datatype`,
      `${SKOS}prefLabel DOI`,
      `${SKOS}inScheme ${CATALOG}`,
      `${RDFS}isDefinedBy ${CATALOG}`,
      `${FOAF}isPrimaryTopicOf ${RECORD}`,
    ]));
  });

  it("POST of a record (addResource onto the catalog) derives the entry for the created id", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);

    await store.addResource({ path: CATALOG }, ttl(RECORD, DOI_RECORD));

    expect(source.calls.some((c) => c.method === "addResource")).toBe(true);
    const got = entryQuadsFor(source, TOPIC);
    expect(got.length).toBe(7);
    expect(got.some((q: any) => q.predicate.value === `${FOAF}isPrimaryTopicOf` && q.object.value === RECORD)).toBe(true);
  });

  it("re-PUT replaces the topic's existing entry (no stale duplicates)", async () => {
    // Pre-seed the catalog .meta with a STALE entry for the topic (old prefLabel).
    const stale = [
      quad(namedNode(TOPIC), namedNode(`${SKOS}prefLabel`), literal("OLD")),
      quad(namedNode(TOPIC), namedNode(`${RDFS}isDefinedBy`), namedNode(CATALOG)),
    ];
    const source = makeSource(stale);
    const store = new IdCatalogStore(source as any, CATALOG);

    await store.setRepresentation({ path: RECORD }, ttl(RECORD, DOI_RECORD));

    const labels = entryQuadsFor(source, TOPIC).filter((q: any) => q.predicate.value === `${SKOS}prefLabel`);
    expect(labels.length).toBe(1);
    expect(labels[0].object.value).toBe("DOI");
  });

  it("re-PUT with a CHANGED primaryTopic orphans no stale entry (replace per-record)", async () => {
    // Pre-seed the catalog .meta with the FULL derived entry for the OLD topic (#doi),
    // including its isPrimaryTopicOf back-link to the record.
    const seeded = [
      quad(namedNode(TOPIC), namedNode(RDF_TYPE), namedNode(`${IDOT}Namespace`)),
      quad(namedNode(TOPIC), namedNode(`${SKOS}prefLabel`), literal("DOI")),
      quad(namedNode(TOPIC), namedNode(`${SKOS}inScheme`), namedNode(CATALOG)),
      quad(namedNode(TOPIC), namedNode(`${RDFS}isDefinedBy`), namedNode(CATALOG)),
      quad(namedNode(TOPIC), namedNode(`${FOAF}isPrimaryTopicOf`), namedNode(RECORD)),
    ];
    const source = makeSource(seeded);
    const store = new IdCatalogStore(source as any, CATALOG);

    // Re-PUT the SAME record with a changed topic (#doi → #doi-new).
    await store.setRepresentation({ path: RECORD }, ttl(RECORD, DOI_RECORD_NEW_TOPIC));

    // The new entry is present in full.
    expect(entryQuadsFor(source, TOPIC_NEW).length).toBe(7);
    // The stale #doi entry is gone — ZERO quads with that subject.
    expect(entryQuadsFor(source, TOPIC).length).toBe(0);
    // Exactly ONE back-link to the record (no orphaned duplicate).
    const backlinks = source.metaStore.getQuads(
      null,
      namedNode(`${FOAF}isPrimaryTopicOf`),
      namedNode(RECORD),
      null,
    );
    expect(backlinks.length).toBe(1);
    expect(backlinks[0].subject.value).toBe(TOPIC_NEW);
  });

  it("DELETE of a record removes its entry from the catalog .meta (matched by isPrimaryTopicOf)", async () => {
    // Pre-seed the catalog .meta with the topic's full entry.
    const seeded = [
      quad(namedNode(TOPIC), namedNode(RDF_TYPE), namedNode(`${SKOS}Concept`)),
      quad(namedNode(TOPIC), namedNode(`${SKOS}prefLabel`), literal("DOI")),
      quad(namedNode(TOPIC), namedNode(`${SKOS}inScheme`), namedNode(CATALOG)),
      quad(namedNode(TOPIC), namedNode(`${RDFS}isDefinedBy`), namedNode(CATALOG)),
      quad(namedNode(TOPIC), namedNode(`${FOAF}isPrimaryTopicOf`), namedNode(RECORD)),
    ];
    const source = makeSource(seeded);
    const store = new IdCatalogStore(source as any, CATALOG);

    await store.deleteResource({ path: RECORD });

    expect(source.calls.some((c) => c.method === "deleteResource" && c.id === RECORD)).toBe(true);
    expect(entryQuadsFor(source, TOPIC).length).toBe(0);
  });
});

describe("IdCatalogStore — pass-through for non-catalog writes", () => {
  it("a write outside the catalog space is pure passthrough (identical args, no .meta write)", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);
    const rep = ttl(OTHER, `<${OTHER}#this> a <urn:T> .`);

    await store.setRepresentation({ path: OTHER }, rep);

    const setCalls = source.calls.filter((c) => c.method === "setRepresentation");
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].id).toBe(OTHER);
    expect(setCalls[0].rep).toBe(rep); // identical representation, not a re-wrap
    // No catalog .meta touched.
    expect(source.calls.some((c) => c.id === CATALOG_META)).toBe(false);
  });

  it("addResource onto a non-catalog container is pure passthrough (no derivation)", async () => {
    const source = makeSource();
    const store = new IdCatalogStore(source as any, CATALOG);
    const container = "https://pod.vardeman.me/wiki/concepts/";
    const rep = ttl(`${container}x.ttl`, `<#this> a <urn:T> .`);

    await store.addResource({ path: container }, rep);

    const addCalls = source.calls.filter((c) => c.method === "addResource");
    expect(addCalls.length).toBe(1);
    expect(addCalls[0].rep).toBe(rep);
    expect(source.calls.some((c) => c.id === CATALOG_META)).toBe(false);
  });
});
