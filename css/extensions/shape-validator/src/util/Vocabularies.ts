/**
 * Self-contained vocabulary definitions for shape validation.
 * Replaces the CSS v5 createUriAndTermNamespace which was removed in v8.
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

export const SH = createVocab('http://www.w3.org/ns/shacl#',
  'targetClass',
);

export const LDP = createVocab('http://www.w3.org/ns/ldp#',
  'contains',
  'BasicContainer',
  'Container',
  'Resource',
  'constrainedBy',
);
