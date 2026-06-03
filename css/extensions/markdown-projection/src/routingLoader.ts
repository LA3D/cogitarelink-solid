// routingLoader.ts
//
// Loads /vault/meta/routing.jsonld and parses it into predicate IRI → class IRI.
// No JSON-LD processor: the doc uses simple CURIEs we expand via its @context.
//
// Uses fetch() (NOT store.getRepresentation) for lock-safety — same pattern as
// TypeIndexLoader. Re-entrant write-lock hazard documented at D92.

type RoutingDoc = { "@context"?: Record<string, any>; "@graph"?: any[] };

function expand(curie: string, prefixes: Record<string, string>): string {
    const i = curie.indexOf(":");
    if (i < 0) return curie;
    const pfx = curie.slice(0, i);
    return prefixes[pfx] ? prefixes[pfx] + curie.slice(i + 1) : curie;
}

export function parseRoutingDoc(doc: RoutingDoc): Record<string, string> {
    const ctx = doc["@context"] ?? {};
    const prefixes: Record<string, string> = {};
    for (const [k, v] of Object.entries(ctx)) {
        if (typeof v === "string") prefixes[k] = v;
        else if (typeof v === "object" && v !== null && typeof (v as Record<string, unknown>)["@id"] === "string")
            prefixes[k] = (v as Record<string, string>)["@id"];
    }
    const out: Record<string, string> = {};
    for (const node of doc["@graph"] ?? []) {
        const id = node["@id"]; const cls = node["routesToClass"];
        if (typeof id === "string" && typeof cls === "string") {
            out[expand(id, prefixes)] = expand(cls, prefixes);
        }
    }
    return out;
}

// Runtime loader: fetch the Pod doc with the lock-safe fetch() pattern (NOT
// store.getRepresentation — re-entrant-lock hazard, D92). Returns the bootstrap
// kernel on any failure (404 / pre-deploy / parse error).
export async function loadRoutingMap(
    podBase: string,
    fetchFn: typeof fetch,
    bootstrap: Record<string, string>,
): Promise<Record<string, string>> {
    const url = `${podBase}/meta/routing.jsonld`;
    try {
        const res = await fetchFn(url, {
            headers: { Accept: "application/ld+json" },
        });
        if (!res.ok) {
            // eslint-disable-next-line no-console
            console.error(`[markdown-projection] routing.jsonld unreachable at ${url} (status ${(res as any).status ?? "unknown"}); using bootstrap kernel`);
            return bootstrap;
        }
        const map = parseRoutingDoc(await res.json() as RoutingDoc);
        if (!Object.keys(map).length) {
            // eslint-disable-next-line no-console
            console.error(`[markdown-projection] routing.jsonld at ${url} parsed to empty map; using bootstrap kernel`);
            return bootstrap;
        }
        return map;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[markdown-projection] routing.jsonld unreachable at ${url} (${(err as Error).message}); using bootstrap kernel`);
        return bootstrap;
    }
}
