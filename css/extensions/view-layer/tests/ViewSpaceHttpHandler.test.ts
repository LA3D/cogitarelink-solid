import { describe, it, expect } from "vitest";
import { guardedStreamFrom } from "@solid/community-server";
import { Store, DataFactory } from "n3";
import { ViewSpaceHttpHandler } from "../src/ViewSpaceHttpHandler";
import { ViewAssembler } from "../src/ViewAssembler";

const { namedNode, quad, literal } = DataFactory;

const BASE = "https://pod.vardeman.me";
const VIEWS = "https://pod.vardeman.me/vault/meta/views/";
const VIEWSPACE_ROOT = "/vault/views/";
const TYPE_INDEX = `${BASE}/vault/settings/publicTypeIndex`;

// Registration vocabulary.
const SOLID = "http://www.w3.org/ns/solid/terms#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA_PERSON = "https://schema.org/Person";
const VCARD_INDIVIDUAL = "http://www.w3.org/2006/vcard/ns#Individual";

// Containers.
const PEOPLE_CTR = `${BASE}/vault/wiki/people/`;
const CONTACTS_CTR = `${BASE}/vault/contacts/Person/`;

// One wiki person + one contact bridged by schema:sameAs.
const PERSON = `${PEOPLE_CTR}jane-doe.md#this`;
const PERSON_RES = `${PEOPLE_CTR}jane-doe.md`;
const CONTACT = `${BASE}/vault/contacts/Person/jane.ttl#this`;

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";
const SCHEMA_NAME = "https://schema.org/name";
const SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const SCHEMA_SAMEAS = "https://schema.org/sameAs";
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";

// Type Index: BOTH a schema:Person registration (wiki people) AND a
// vcard:Individual registration (a hypothetical contacts container) — the
// handler must read whichever the deployed Pod actually carries.
const TYPE_INDEX_QUADS = [
  quad(namedNode(`${TYPE_INDEX}#wiki-people`), namedNode(RDF_TYPE),
       namedNode(`${SOLID}TypeRegistration`)),
  quad(namedNode(`${TYPE_INDEX}#wiki-people`), namedNode(`${SOLID}forClass`),
       namedNode(SCHEMA_PERSON)),
  quad(namedNode(`${TYPE_INDEX}#wiki-people`), namedNode(`${SOLID}instanceContainer`),
       namedNode(PEOPLE_CTR)),
  quad(namedNode(`${TYPE_INDEX}#contacts`), namedNode(RDF_TYPE),
       namedNode(`${SOLID}TypeRegistration`)),
  quad(namedNode(`${TYPE_INDEX}#contacts`), namedNode(`${SOLID}forClass`),
       namedNode(VCARD_INDIVIDUAL)),
  quad(namedNode(`${TYPE_INDEX}#contacts`), namedNode(`${SOLID}instanceContainer`),
       namedNode(CONTACTS_CTR)),
];

// people container listing.
const PEOPLE_LISTING = [
  quad(namedNode(PEOPLE_CTR), namedNode(LDP_CONTAINS), namedNode(PERSON_RES)),
];
// contacts container listing.
const CONTACTS_LISTING = [
  quad(namedNode(CONTACTS_CTR), namedNode(LDP_CONTAINS),
       namedNode(`${BASE}/vault/contacts/Person/jane.ttl`)),
];

// jane-doe wiki person .meta: typed schema:Person, has prefLabel + sameAs→contact.
const PERSON_META = [
  quad(namedNode(PERSON), namedNode(RDF_TYPE), namedNode(SCHEMA_PERSON)),
  quad(namedNode(PERSON), namedNode(SKOS_PREFLABEL), literal("Jane Doe")),
  quad(namedNode(PERSON), namedNode(SCHEMA_NAME), literal("Jane Doe")),
  quad(namedNode(PERSON), namedNode(SCHEMA_SAMEAS), namedNode(CONTACT)),
];
// the contact resource (RDF, served as its own quads — no .meta).
const CONTACT_QUADS = [
  quad(namedNode(CONTACT), namedNode(VCARD_FN), literal("Jane Doe (contact)")),
];

// The declared people-projection (overlays/wiki-memory/views/people-projection).
const PEOPLE_PROJECTION = `
PREFIX schema: <https://schema.org/>
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
CONSTRUCT {
  ?person ?p ?o .
  ?person rdfs:seeAlso ?contact .
  ?contact ?cp ?co .
}
WHERE {
  ?person a schema:Person ; ?p ?o .
  OPTIONAL {
    ?person schema:sameAs ?contact .
    ?contact ?cp ?co .
  }
}`;

function makeStore() {
  return {
    async getRepresentation(id: { path: string }, prefs: any) {
      const path = id.path;
      const wantsQuads = !!(prefs?.type && prefs.type["internal/quads"]);

      const serveQuads = (quads: any[]) =>
        ({ data: guardedStreamFrom(new Store(quads).getQuads(null, null, null, null)) });

      // people-projection query text.
      if (path === `${VIEWS}people-projection`) {
        return { data: guardedStreamFrom(PEOPLE_PROJECTION) };
      }

      if (path === TYPE_INDEX) return serveQuads(TYPE_INDEX_QUADS);
      if (path === PEOPLE_CTR) return serveQuads(PEOPLE_LISTING);
      if (path === CONTACTS_CTR) return serveQuads(CONTACTS_LISTING);

      // wiki person .meta.
      if (path === `${PERSON_RES}.meta`) return serveQuads(PERSON_META);
      // wiki person body resource as quads → empty (markdown body, no RDF).
      if (path === PERSON_RES) return serveQuads([]);

      // contact resource: no .meta → empty; the resource itself carries quads.
      if (path === `${BASE}/vault/contacts/Person/jane.ttl.meta`) return serveQuads([]);
      if (path === `${BASE}/vault/contacts/Person/jane.ttl`) return serveQuads(CONTACT_QUADS);
      // contact reached directly via sameAs (#this stripped to base resource).
      if (path === CONTACT) return serveQuads(CONTACT_QUADS);

      throw new Error(`unexpected getRepresentation: ${path} (wantsQuads=${wantsQuads})`);
    },
  };
}

function makeResponse() {
  const headers: Record<string, string | string[]> = {};
  let body = "";
  let statusCode = 0;
  return {
    response: {
      writeHead(status: number, hdrs?: Record<string, string | string[]>) {
        statusCode = status;
        if (hdrs) for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;
        return this;
      },
      setHeader(k: string, v: string | string[]) { headers[k.toLowerCase()] = v; },
      end(chunk?: string) { if (chunk) body += chunk; },
      set statusCode(v: number) { statusCode = v; },
      get statusCode() { return statusCode; },
    } as any,
    get body() { return body; },
    get statusCode() { return statusCode; },
    headers,
  };
}

function build() {
  return new ViewSpaceHttpHandler(
    makeStore() as any,
    new ViewAssembler(),
    BASE,
    VIEWS,
    VIEWSPACE_ROOT,
    TYPE_INDEX,
  );
}

function input(method: string, pathUnderRoot: string, res: ReturnType<typeof makeResponse>) {
  return {
    request: { method, url: `${VIEWSPACE_ROOT}${pathUnderRoot}` } as any,
    response: res.response,
  };
}

describe("ViewSpaceHttpHandler.canHandle", () => {
  it("accepts /vault/views/people/", async () => {
    const h = build();
    const res = makeResponse();
    await expect(h.canHandle(input("GET", "people/", res) as any)).resolves.toBeUndefined();
  });

  it("rejects /vault/wiki/x", async () => {
    const h = build();
    const res = makeResponse();
    await expect(
      h.canHandle({
        request: { method: "GET", url: "/vault/wiki/x" } as any,
        response: res.response,
      } as any),
    ).rejects.toThrow();
  });
});

describe("ViewSpaceHttpHandler.handle — container", () => {
  it("GET /vault/views/people/ → 200 turtle with ldp:contains for the person slug", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "people/", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    expect(res.body).toContain("contains");
    expect(res.body).toContain(`${BASE}/vault/views/people/jane-doe`);
  });

  it("HEAD container → 200, no body", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("HEAD", "people/", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("");
    expect(res.headers["content-type"]).toBe("text/turtle");
  });
});

describe("ViewSpaceHttpHandler.handle — member", () => {
  it("GET person card → 200 turtle with name/prefLabel AND rdfs:seeAlso both homes", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("GET", "people/jane-doe", res) as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/turtle");
    // person's own data.
    expect(res.body).toContain("Jane Doe");
    // seeAlso to BOTH homes: wiki person + contact.
    expect(res.body).toContain("seeAlso");
    expect(res.body).toContain(CONTACT);
    // the contact's own quad pulled in via the sameAs bridge.
    expect(res.body).toContain("Jane Doe (contact)");
  });

  it("unknown slug → 404", async () => {
    const h = build();
    const res = makeResponse();
    await expect(h.handle(input("GET", "people/nobody", res) as any)).rejects.toThrow();
  });
});

describe("ViewSpaceHttpHandler.handle — read-only", () => {
  it("PUT → 405 + Allow + read-only body", async () => {
    const h = build();
    const res = makeResponse();
    await h.handle(input("PUT", "people/jane-doe", res) as any);
    expect(res.statusCode).toBe(405);
    expect(res.headers["allow"]).toBe("GET, HEAD, OPTIONS");
    expect(res.body).toContain("read-only");
    expect(res.body).toContain("rdfs:seeAlso");
  });
});
