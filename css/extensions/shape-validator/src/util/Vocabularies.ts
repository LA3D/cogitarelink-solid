/**
 * Local vocabulary terms for shape validation (audit F10).
 *
 * Coverage check against @solid/community-server's own exports (v8):
 *   - CSS exports `LDP` with: contains, BasicContainer, Container, Resource —
 *     but NOT `ldp:constrainedBy`, which the floor + validator need.
 *   - CSS exports NO `SH` vocabulary at all (no `sh:targetClass`).
 *
 * So the genuinely-missing terms (`ldp:constrainedBy`, the whole `SH` namespace)
 * must be minted locally. We keep `LDP.contains` here too — even though CSS exports
 * it — so the two LDP terms this extension uses live behind a single import symbol
 * rather than splitting one predicate set across two `LDP` objects (a worse readability
 * trap than one small local table). Predicates are compared by IRI value (NamedNode
 * .equals), so a locally-minted term interoperates with CSS-emitted metadata.
 *
 * Unused-redundant terms (BasicContainer/Container/Resource) were dropped — this table
 * now carries ONLY what the extension references.
 */
import { DataFactory } from 'n3';

const { namedNode } = DataFactory;

function createVocab<T extends string>(baseUri: string, ...localNames: T[]) {
  const ns = {} as Record<T, string> & { terms: Record<T, ReturnType<typeof namedNode>> };
  ns.terms = {} as Record<T, ReturnType<typeof namedNode>>;
  for (const name of localNames) {
    (ns as any)[name] = baseUri + name;
    ns.terms[name] = namedNode(baseUri + name);
  }
  return ns;
}

// Entirely absent from CSS's exports — must be local.
export const SH = createVocab('http://www.w3.org/ns/shacl#',
  'targetClass',
);

// `contains` IS in CSS's LDP; `constrainedBy` is NOT. Kept together (see header).
export const LDP = createVocab('http://www.w3.org/ns/ldp#',
  'contains',
  'constrainedBy',
);
