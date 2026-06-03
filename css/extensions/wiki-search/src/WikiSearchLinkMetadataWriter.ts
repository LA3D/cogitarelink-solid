import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { isUnderBaseUrl, isInWikiSubtree, wikiPrefix } from "./uri";

/**
 * Adds a Link: rel="queryBase" header to GET responses for containers
 * at or under "<storagePath>/wiki/". Closes the cold-start discovery loop:
 * an agent reading only HTTP headers (D55 Tier 1) finds the wiki-search
 * affordance without first reading the D83 capability catalog.
 *
 * Path-prefix dispatch — not rdf:type scan — because we cannot afford
 * to read every child's .meta on every container GET just for header
 * decoration. Path matching aligns with the affordance descriptor's
 * wiki:targetContainer claim. The subtree prefix is derived from the
 * injected storagePath (default "/vault"), not a baked literal
 * (R-T4 / audit H1 / D107).
 */
export class WikiSearchLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;
  private readonly wikiPrefix: string;
  private readonly queryBaseUrl: string;

  public constructor(baseUrl: string, storagePath = "/vault") {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wikiPrefix = wikiPrefix(storagePath);
    this.queryBaseUrl = `${this.baseUrl}${this.wikiPrefix}?ext=search-grep`;
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata?.identifier?.value;
    if (!id) return;
    if (!isUnderBaseUrl(id, this.baseUrl)) return;
    if (!isInWikiSubtree(id, this.wikiPrefix)) return;
    if (!id.endsWith("/")) return; // containers only

    addHeader(
      input.response,
      "Link",
      `<${this.queryBaseUrl}>; rel="http://open-services.net/ns/core#queryBase"; title="wiki-search"`,
    );
  }
}
