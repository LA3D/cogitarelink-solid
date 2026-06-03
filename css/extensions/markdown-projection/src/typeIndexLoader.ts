// typeIndexLoader.ts
//
// Fetches and caches the Pod's live Type Index (/settings/publicTypeIndex).
// Used by MarkdownProjectionListener to make URI-independent dispatch decisions
// (Bug G fix): instead of filtering by /wiki/ path prefix, the listener asks
// "does this path map to a known Thing class via the Type Index?"
//
// Merges the built-in wiki defaults with the live registrations so the built-in
// wiki paths always work even on a fresh Pod with no publicTypeIndex yet — but
// the LIVE index is authoritative: a live registration for any container wins
// over the same-keyed default (the Pod's data model is the source of truth; the
// default is only a bootstrap for the unavailable/empty-index case — R1.2).

import { Parser, Store, DataFactory } from "n3";
import { TypeIndex, defaultWikiTypeIndex } from "./typeIndexLookup.js";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SOLID_TYPE_REG = "http://www.w3.org/ns/solid/terms#TypeRegistration";
const SOLID_FOR_CLASS = "http://www.w3.org/ns/solid/terms#forClass";
const SOLID_INSTANCE_CONTAINER = "http://www.w3.org/ns/solid/terms#instanceContainer";

export class TypeIndexLoader {
    private cache: TypeIndex | undefined;
    private readonly podBase: string;
    // The wiki-memory L3 fallback map, derived from the injected storage base —
    // NOT a baked /vault literal. Used when the live index is unavailable/empty
    // and as the floor the live registrations are merged over (live wins per-key).
    private readonly defaultIndex: TypeIndex;

    constructor(podBase: string) {
        this.podBase = podBase.replace(/\/$/, "");
        this.defaultIndex = defaultWikiTypeIndex(this.podBase);
    }

    /** Get the current TypeIndex map, fetching and caching on first use. */
    async getTypeIndex(): Promise<TypeIndex> {
        if (this.cache !== undefined) return this.cache;
        return this.refresh();
    }

    /** Force a refetch from the Pod. */
    async refresh(): Promise<TypeIndex> {
        const url = `${this.podBase}/settings/publicTypeIndex`;
        try {
            const resp = await fetch(url, { headers: { Accept: "text/turtle" } });
            if (resp.ok) {
                const ttl = await resp.text();
                const live = this.parseTypeIndex(ttl, url);
                // Live-authoritative merge (R1.2): the default supplies bootstrap
                // containers, but a live registration for the same container WINS —
                // the deployer's actual publicTypeIndex is the source of truth, and
                // must not be silently overruled by the baked-in defaults. Per-container
                // determinism (when the live index maps one container to two classes)
                // is handled inside parseTypeIndex, so live-wins is stable here.
                this.cache = { ...this.defaultIndex, ...live };
                return this.cache;
            }
            // eslint-disable-next-line no-console
            console.error(`[markdown-projection] Type Index unreachable at ${url} (status ${(resp as any).status ?? "unknown"}); falling back to default wiki Type Index`);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[markdown-projection] Type Index unreachable at ${url} (${(err as Error).message}); falling back to default wiki Type Index`);
        }
        this.cache = { ...this.defaultIndex };
        return this.cache;
    }

    /** Invalidate cache (forces next getTypeIndex() to re-fetch). */
    invalidate(): void {
        this.cache = undefined;
    }

    private parseTypeIndex(ttl: string, baseIRI: string): TypeIndex {
        const parser = new Parser({ baseIRI });
        const store = new Store();
        try {
            store.addQuads(parser.parse(ttl));
        } catch {
            return {};
        }

        const result: TypeIndex = {};
        const typeReg = DataFactory.namedNode(SOLID_TYPE_REG);
        const forClassPred = DataFactory.namedNode(SOLID_FOR_CLASS);
        const instanceContainerPred = DataFactory.namedNode(SOLID_INSTANCE_CONTAINER);

        // Collect (containerPath, classIri) pairs first, then resolve
        // deterministically. N3 quad iteration is not document-ordered, so when
        // the live index maps one container to two classes (e.g. skos:Concept AND
        // wiki:Source both → /wiki/concepts/), last-write-wins over raw iteration
        // would flip non-deterministically. Sorting the pairs and keeping the
        // first per container makes the live index's own resolution stable.
        const pairs: Array<{ container: string; cls: string }> = [];
        for (const regQuad of store.getQuads(null, DataFactory.namedNode(RDF_TYPE), typeReg, null)) {
            const reg = regQuad.subject;
            const forClassQuads = store.getQuads(reg, forClassPred, null, null);
            const containerQuads = store.getQuads(reg, instanceContainerPred, null, null);
            if (forClassQuads.length === 0 || containerQuads.length === 0) continue;

            const forClass = forClassQuads[0].object;
            const container = containerQuads[0].object;
            if (forClass.termType !== "NamedNode" || container.termType !== "NamedNode") continue;

            try {
                const containerPath = new URL(container.value).pathname;
                pairs.push({ container: containerPath, cls: forClass.value });
            } catch {
                // Non-parseable container IRI — skip
            }
        }
        // Deterministic: sort by (container, class), first per container wins.
        pairs.sort((a, b) =>
            a.container === b.container ? a.cls.localeCompare(b.cls) : a.container.localeCompare(b.container),
        );
        for (const { container, cls } of pairs) {
            if (!(container in result)) result[container] = cls;
        }
        return result;
    }
}
