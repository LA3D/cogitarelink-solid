/**
 * ViewSpaceHttpHandler — the `/vault/views/people/` cross-cutting demonstrator
 * (view-layer spec §6). One person, one URL, assembled from every container
 * that knows them (wiki note + addressbook contact): the Verborgh
 * contacts-conundrum existence proof.
 *
 * Inserted BEFORE LdpHandler (Task 11), so it owns reads under viewSpaceRoot.
 * Read-only per the lens law (sub:writable false): writes get 405 naming the
 * writable homes (via rdfs:seeAlso in each card).
 *
 * Source enumeration is Type-Index-driven (D107: no hardcoded containers):
 *   1. read publicTypeIndex → containers registered for schema:Person OR
 *      vcard:Individual.
 *   2. read each container's ldp:contains members.
 *   3. per member: prefer its `.meta` quads; fall back to the resource's own
 *      quads when `.meta` is empty/missing (contacts are RDF resources).
 *   4. follow schema:sameAs objects under baseUrl (the contact bridge — those
 *      contact resources are not Type-Index-registered, so they are reached
 *      only this way) and add them as sources too.
 *   5. assembler.construct(people-projection, sources); cache 60s.
 *
 * Contract:
 *   GET/HEAD {root}people/        → 200 turtle container listing (informational
 *                                   ldp:BasicContainer + one ldp:contains per
 *                                   distinct person).
 *   GET/HEAD {root}people/{slug}  → 200 turtle person card (their quads +
 *                                   rdfs:seeAlso to both homes + bridged contact
 *                                   quads). Unknown slug → 404.
 *   PUT/POST/PATCH/DELETE         → 405 Allow: GET, HEAD, OPTIONS, read-only body.
 */
import {
  HttpHandler,
  type HttpHandlerInput,
  type ResourceStore,
  NotImplementedHttpError,
  NotFoundHttpError,
  INTERNAL_QUADS,
  readableToQuads,
} from "@solid/community-server";
import { getLoggerFor } from "global-logger-factory";
import { Store, DataFactory } from "n3";
import type { Quad, Quad_Subject } from "n3";

import { ViewAssembler } from "./ViewAssembler";

const { namedNode, quad } = DataFactory;

const CACHE_TTL_MS = 60_000;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LDP = "http://www.w3.org/ns/ldp#";
const RDFS_SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
const SCHEMA_PERSON = "https://schema.org/Person";
const SCHEMA_SAMEAS = "https://schema.org/sameAs";

// Type Index registration vocabulary.
const SOLID_FOR_CLASS = "http://www.w3.org/ns/solid/terms#forClass";
const SOLID_INSTANCE_CONTAINER = "http://www.w3.org/ns/solid/terms#instanceContainer";

// Classes whose registered containers hold person data.
const PERSON_CLASSES = new Set<string>([
  SCHEMA_PERSON,
  "http://www.w3.org/2006/vcard/ns#Individual",
]);

const READ_ONLY_BODY =
  "Derived read-only view. Author at the wiki note or the contact resource " +
  "(see rdfs:seeAlso in this graph).";

export class ViewSpaceHttpHandler extends HttpHandler {
  private readonly logger = getLoggerFor(this);
  private readonly store: ResourceStore;
  private readonly assembler: ViewAssembler;
  private readonly baseUrl: string;
  private readonly viewsBase: string;
  private readonly viewSpaceRoot: string;
  private readonly typeIndexUrl: string;

  private resultCache?: { quads: Quad[]; at: number };
  private queryCache?: { query: string; at: number };

  public constructor(
    store: ResourceStore,
    assembler: ViewAssembler,
    baseUrl: string,
    viewsBase: string,
    viewSpaceRoot: string,
    typeIndexUrl: string,
  ) {
    super();
    this.store = store;
    this.assembler = assembler;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.viewsBase = viewsBase.endsWith("/") ? viewsBase : `${viewsBase}/`;
    this.viewSpaceRoot = viewSpaceRoot.endsWith("/") ? viewSpaceRoot : `${viewSpaceRoot}/`;
    this.typeIndexUrl = typeIndexUrl;
  }

  private fullUrl(rawUrl: string): string {
    return rawUrl.startsWith("http") ? rawUrl : this.baseUrl + rawUrl;
  }

  public async canHandle(input: HttpHandlerInput): Promise<void> {
    const url = this.fullUrl(input.request.url ?? "");
    if (!url.startsWith(this.baseUrl)) {
      throw new NotImplementedHttpError("view-space request outside baseUrl");
    }
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith(this.viewSpaceRoot)) {
      throw new NotImplementedHttpError("not a /vault/views/ request");
    }
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    const { request, response } = input;
    const method = (request.method ?? "GET").toUpperCase();
    const url = this.fullUrl(request.url ?? "");

    if (method !== "GET" && method !== "HEAD") {
      this.writeReadOnly(response);
      return;
    }

    const head = method === "HEAD";
    const pathname = new URL(url).pathname; // e.g. /vault/views/people/ or .../jane-doe
    const rest = pathname.slice(this.viewSpaceRoot.length); // people/  | people/jane-doe
    const segs = rest.split("/").filter((s) => s.length > 0);

    // Only the people view-space is wired in v1; anything else is unknown.
    if (segs[0] !== "people") {
      throw new NotFoundHttpError(`no view-space at ${pathname}`);
    }

    const persons = await this.assemblePersons();

    if (segs.length === 1) {
      return this.serveContainer(response, persons, head);
    }
    return this.serveMember(response, persons, segs[1], head);
  }

  // ─── container listing ──────────────────────────────────────────────────────
  private async serveContainer(response: any, persons: PersonCard[], head: boolean): Promise<void> {
    const root = `${this.baseUrl}${this.viewSpaceRoot}people/`;
    const listing = new Store();
    listing.addQuad(quad(namedNode(root), namedNode(RDF_TYPE), namedNode(`${LDP}BasicContainer`)));
    for (const p of persons) {
      listing.addQuad(
        quad(namedNode(root), namedNode(`${LDP}contains`), namedNode(`${root}${p.slug}`)),
      );
    }
    return this.writeTurtle(response, listing.getQuads(null, null, null, null), head);
  }

  // ─── person card ────────────────────────────────────────────────────────────
  private async serveMember(response: any, persons: PersonCard[], slug: string, head: boolean): Promise<void> {
    const card = persons.find((p) => p.slug === slug);
    if (!card) {
      throw new NotFoundHttpError(`no person view for slug "${slug}"`);
    }
    return this.writeTurtle(response, card.quads, head);
  }

  // ─── assembly ─────────────────────────────────────────────────────────────────
  // Run the people-projection over Type-Index-enumerated sources; partition the
  // result by distinct schema:Person subject. Cached 60s.
  private async assemblePersons(): Promise<PersonCard[]> {
    const now = Date.now();
    if (!this.resultCache || now - this.resultCache.at > CACHE_TTL_MS) {
      const sources = await this.enumerateSources();
      const query = await this.readProjectionQuery();
      const quads = await this.assembler.construct(query, sources);
      this.resultCache = { quads, at: now };
    }
    return this.partition(this.resultCache.quads);
  }

  // Distinct persons = subjects with rdf:type schema:Person in the result. Each
  // card = the person's quads PLUS the quads of any subject the person links to
  // via rdfs:seeAlso (the bridged contact).
  private partition(quads: Quad[]): PersonCard[] {
    const result = new Store(quads);
    const personSubjects = result
      .getQuads(null, namedNode(RDF_TYPE), namedNode(SCHEMA_PERSON), null)
      .map((q) => q.subject);

    const cards: PersonCard[] = [];
    for (const subj of personSubjects) {
      const cardStore = new Store();
      cardStore.addQuads(result.getQuads(subj, null, null, null));
      // Pull in each rdfs:seeAlso target's quads (the contact home).
      for (const sa of result.getQuads(subj, namedNode(RDFS_SEE_ALSO), null, null)) {
        cardStore.addQuads(result.getQuads(sa.object as Quad_Subject, null, null, null));
      }
      cards.push({ slug: this.slugFor(subj.value), quads: cardStore.getQuads(null, null, null, null) });
    }
    return cards;
  }

  // slug = last non-empty path segment of the subject IRI, stripped of any
  // fragment and a trailing .md (e.g. …/people/jane-doe.md#this → jane-doe).
  private slugFor(iri: string): string {
    const noFrag = iri.split("#")[0];
    const segs = noFrag.split("/").filter((s) => s.length > 0);
    const last = segs[segs.length - 1] ?? "";
    return last.replace(/\.md$/, "");
  }

  // ─── source enumeration (Type-Index-driven, D107) ────────────────────────────
  private async enumerateSources(): Promise<Store[]> {
    const tiStore = await this.readQuadsAt(this.typeIndexUrl);
    // Containers registered for a person class.
    const containers = new Set<string>();
    for (const cls of PERSON_CLASSES) {
      for (const reg of tiStore.getQuads(null, namedNode(SOLID_FOR_CLASS), namedNode(cls), null)) {
        for (const ic of tiStore.getQuads(reg.subject, namedNode(SOLID_INSTANCE_CONTAINER), null, null)) {
          containers.add(ic.object.value);
        }
      }
    }

    const sources: Store[] = [];
    const seen = new Set<string>();
    const sameAsTargets = new Set<string>();

    for (const ctr of containers) {
      const listing = await this.readQuadsAt(ctr);
      for (const m of listing.getQuads(null, namedNode(`${LDP}contains`), null, null)) {
        const member = m.object.value;
        const memberStore = await this.readMemberQuads(member);
        if (seen.has(member)) continue;
        seen.add(member);
        sources.push(memberStore);
        // Collect schema:sameAs objects under baseUrl — the contact bridge. Those
        // contact resources are not Type-Index-registered, so add them too.
        for (const sa of memberStore.getQuads(null, namedNode(SCHEMA_SAMEAS), null, null)) {
          const t = sa.object.value;
          if (t.startsWith(this.baseUrl)) sameAsTargets.add(t);
        }
      }
    }

    for (const t of sameAsTargets) {
      const resPath = t.split("#")[0];
      if (seen.has(resPath)) continue;
      seen.add(resPath);
      sources.push(await this.readMemberQuads(resPath));
    }

    return sources;
  }

  // A member contributes BOTH its `.meta` quads and its own quads, merged.
  // Markdown notes carry their substantive RDF in `.meta` (the body is text/markdown
  // → no INTERNAL_QUADS); contacts/.ttl carry their substantive RDF in the resource
  // body while CSS auto-stamps `.meta` with system metadata (dc:modified, posix:*).
  // A `meta.size > 0` heuristic mis-fires for contacts because their `.meta` is never
  // empty — it just holds the wrong (system) triples. Merging both stores serves every
  // case: the body quads + the .meta quads together.
  private async readMemberQuads(member: string): Promise<Store> {
    const merged = await this.readQuadsAt(`${member}.meta`);
    merged.addQuads((await this.readQuadsAt(member)).getQuads(null, null, null, null));
    return merged;
  }

  // INTERNAL_QUADS read; tolerates a missing resource → empty store.
  private async readQuadsAt(path: string): Promise<Store> {
    try {
      const rep = await this.store.getRepresentation(
        { path },
        { type: { [INTERNAL_QUADS]: 1 } },
      );
      return readableToQuads(rep.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`readQuadsAt: ${path}: ${msg}`);
      return new Store();
    }
  }

  // The people-projection query text, cached 60s.
  private async readProjectionQuery(): Promise<string> {
    const now = Date.now();
    if (!this.queryCache || now - this.queryCache.at > CACHE_TTL_MS) {
      const rep = await this.store.getRepresentation(
        { path: `${this.viewsBase}people-projection` },
        { type: { "text/markdown": 1, "text/plain": 1, "application/sparql-query": 1 } },
      );
      const { readableToString } = await import("@solid/community-server");
      const query = await readableToString(rep.data);
      this.queryCache = { query, at: now };
    }
    return this.queryCache.query;
  }

  // ─── response writers ─────────────────────────────────────────────────────────
  private async writeTurtle(response: any, quads: Quad[], head: boolean): Promise<void> {
    const ttl = await this.assembler.serializeTurtle(quads);
    response.writeHead(200, {
      "Content-Type": "text/turtle",
      Link: `<${this.viewsBase}people>; rel="profile"`,
    });
    response.end(head ? undefined : ttl);
  }

  private writeReadOnly(response: any): void {
    response.writeHead(405, {
      "Content-Type": "text/plain",
      Allow: "GET, HEAD, OPTIONS",
    });
    response.end(READ_ONLY_BODY);
  }
}

interface PersonCard {
  slug: string;
  quads: Quad[];
}
