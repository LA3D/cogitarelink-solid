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
export class ViewAssembler {
  private readonly engine = new QueryEngine();

  public async construct(query: string, sources: unknown[]): Promise<Quad[]> {
    const stream = await this.engine.queryQuads(query, {
      sources: sources as [any, ...any[]],
    });
    return stream.toArray() as Promise<Quad[]>;
  }

  public async serializeTurtle(quads: Quad[]): Promise<string> {
    const writer = new Writer({ format: "Turtle" });
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
