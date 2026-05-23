import type { Quad } from '@rdfjs/types';

const SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

/**
 * Build class -> all transitive superclasses from rdfs:subClassOf quads.
 * Assumes acyclic input; cycles are handled safely (a class may appear in
 * its own ancestor set) but are not filtered.
 */
export function buildSubClassClosure(quads: Quad[]): Map<string, string[]> {
  const direct = new Map<string, Set<string>>();
  for (const q of quads) {
    if (q.predicate.value === SUBCLASS) {
      if (!direct.has(q.subject.value)) direct.set(q.subject.value, new Set());
      direct.get(q.subject.value)!.add(q.object.value);
    }
  }
  const closure = new Map<string, string[]>();
  const ancestorsOf = (cls: string, seen: Set<string>): Set<string> => {
    for (const parent of direct.get(cls) ?? []) {
      if (!seen.has(parent)) { seen.add(parent); ancestorsOf(parent, seen); }
    }
    return seen;
  };
  for (const cls of direct.keys()) {
    closure.set(cls, [...ancestorsOf(cls, new Set())]);
  }
  return closure;
}

/** Declared types plus all their ancestors (deduplicated). */
export function expandSuperClasses(classes: string[], closure: Map<string, string[]>): string[] {
  const out = new Set<string>(classes);
  for (const c of classes) for (const a of closure.get(c) ?? []) out.add(a);
  return [...out];
}
