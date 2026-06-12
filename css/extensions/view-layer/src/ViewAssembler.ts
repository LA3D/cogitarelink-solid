import { QueryEngine } from "@comunica/query-sparql";
import { Writer } from "n3";
import type { Quad } from "n3";

/**
 * Executes declared projection queries (the view descriptors' role:mapping
 * artifacts) over EXPLICIT sources. Declared-query, engine-executed: the
 * same query text is runnable by the Pod MCP sparql tool and client
 * engines — no hand-mirrored assembly to drift (view-layer spec §3.1).
 *
 * No HTTP fetching, no link traversal — explicit sources only.
 * The Pod hosts no SPARQL endpoint (D3/D29); this engine is internal
 * to representation generation.
 */
// Default prefix map for served turtle — the substrate's working vocabulary
// (SP2-T7; Comunica/N3 otherwise emit unabbreviated IRIs). Callers may override.
const TURTLE_PREFIXES: Record<string, string> = {
  skos: "http://www.w3.org/2004/02/skos/core#",
  schema: "https://schema.org/",
  dct: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
  mem: "https://pod.vardeman.me/vault/ontology/mem#",
  sub: "https://pod.vardeman.me/vault/ontology/substrate#",
  ldp: "http://www.w3.org/ns/ldp#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

export class ViewAssembler {
  private readonly engine = new QueryEngine();

  public async construct(query: string, sources: unknown[]): Promise<Quad[]> {
    const stream = await this.engine.queryQuads(query, {
      sources: sources as [any, ...any[]],
    });
    return stream.toArray() as Promise<Quad[]>;
  }

  public async serializeTurtle(
    quads: Quad[],
    prefixes: Record<string, string> = TURTLE_PREFIXES,
  ): Promise<string> {
    const writer = new Writer({ format: "Turtle", prefixes });
    writer.addQuads(quads);
    return new Promise((resolve, reject) =>
      writer.end((err, out) => (err ? reject(err) : resolve(out))));
  }

  /** Fused document = stored body ⊕ fenced serialization of the projection result. */
  public async fuse(body: string, query: string, sources: unknown[]): Promise<string> {
    const quads = await this.construct(query, sources);
    const ttl = await this.serializeTurtle(quads);
    return `${body.replace(/\n*$/, "\n")}\n## Graph\n\n\`\`\`turtle\n${ttl.trim()}\n\`\`\`\n`;
  }
}
