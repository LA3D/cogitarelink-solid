// typeIndexLoader.ts
//
// Fetches and caches the Pod's live Type Index (/settings/publicTypeIndex).
// Used by MarkdownProjectionListener to make URI-independent dispatch decisions
// (Bug G fix): instead of filtering by /wiki/ path prefix, the listener asks
// "does this path map to a known Thing class via the Type Index?"
//
// Merges live registrations with DEFAULT_WIKI_TYPE_INDEX so the built-in wiki
// paths always work even on a fresh Pod with no publicTypeIndex yet.

import { Parser, Store, DataFactory } from "n3";
import { TypeIndex, DEFAULT_WIKI_TYPE_INDEX } from "./typeIndexLookup.js";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SOLID_TYPE_REG = "http://www.w3.org/ns/solid/terms#TypeRegistration";
const SOLID_FOR_CLASS = "http://www.w3.org/ns/solid/terms#forClass";
const SOLID_INSTANCE_CONTAINER = "http://www.w3.org/ns/solid/terms#instanceContainer";

export class TypeIndexLoader {
    private cache: TypeIndex | undefined;
    private readonly podBase: string;

    constructor(podBase: string) {
        this.podBase = podBase.replace(/\/$/, "");
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
                this.cache = { ...DEFAULT_WIKI_TYPE_INDEX, ...live };
                return this.cache;
            }
        } catch {
            // Network error or Pod not ready — fall through to defaults
        }
        this.cache = { ...DEFAULT_WIKI_TYPE_INDEX };
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
                result[containerPath] = forClass.value;
            } catch {
                // Non-parseable container IRI — skip
            }
        }
        return result;
    }
}
