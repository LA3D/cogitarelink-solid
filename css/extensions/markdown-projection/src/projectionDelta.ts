import type { Quad } from "n3";

/** Canonical key: term-equality including literal datatype/language.
 *  N3 plain literals carry xsd:string datatype implicitly — same as explicit xsd:string. */
const key = (q: Quad): string =>
  `${q.subject.value}|${q.predicate.value}|${q.object.termType}|${q.object.value}|` +
  `${(q.object as any).language ?? ""}|${(q.object as any).datatype?.value ?? ""}`;

/** Exact subtraction (spec §4): remove from `current` every quad term-equal to one in
 *  `oldProjected`. Set semantics — RDF graphs are sets, so one old quad removes all
 *  term-equal occurrences. Agent triples survive by construction, including ones using
 *  governed predicates on other subjects; an agent triple IDENTICAL to a projected one
 *  goes with it (the coincidence rule, spec §5 — derivables are not hand-asserted, D109). */
export function subtractProjected(current: Quad[], oldProjected: Quad[]): Quad[] {
  const old = new Set(oldProjected.map(key));
  return current.filter((q) => !old.has(key(q)));
}

/** Degraded mode (spec §5, no recoverable prior body): remove quads whose
 *  (subject, predicate) pair the NEW projection emits — strictly narrower than the
 *  legacy predicate strip. May leave residue for pairs the new body dropped; callers
 *  MUST pair this with a mem curation signal (Task 5). */
export function pairShadow(current: Quad[], newProjected: Quad[]): Quad[] {
  const pairs = new Set(newProjected.map((q) => `${q.subject.value}|${q.predicate.value}`));
  return current.filter((q) => !pairs.has(`${q.subject.value}|${q.predicate.value}`));
}
