import { describe, it, expect } from 'vitest';
import { buildSubClassClosure, expandSuperClasses } from '../src/subClassClosure';
import { evaluatePathConstraint, PathConstraintConfig } from '../src/pathConstraint';
import { Parser } from 'n3';

// Regression: as:Announce + mem:CrystallizeAction posted to .operations/
// (allow-list = [as:Activity]) must PASS once types are subclass-expanded.
it('announcement passes .operations/ constraint after subclass expansion', () => {
  const axioms = `
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    as:Announce rdfs:subClassOf as:Activity .`;
  const closure = buildSubClassClosure(new Parser().parse(axioms));
  const declared = [
    'https://www.w3.org/ns/activitystreams#Announce',
    'https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction',
  ];
  const expanded = expandSuperClasses(declared, closure);
  const constraints = [new PathConstraintConfig(
    '/vault/wiki/.operations/',
    ['https://www.w3.org/ns/activitystreams#Activity'], [],
  )];
  const result = evaluatePathConstraint('/vault/wiki/.operations/x.ttl', expanded, constraints);
  expect(result.ok).toBe(true);
});

it('unexpanded as:Announce fails .operations/ constraint (literal-check baseline)', () => {
  // Confirms that without expansion the literal check rejects Announce.
  const declared = [
    'https://www.w3.org/ns/activitystreams#Announce',
    'https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction',
  ];
  const constraints = [new PathConstraintConfig(
    '/vault/wiki/.operations/',
    ['https://www.w3.org/ns/activitystreams#Activity'], [],
  )];
  const result = evaluatePathConstraint('/vault/wiki/.operations/x.ttl', declared, constraints);
  expect(result.ok).toBe(false);
});

it('mem:Event passes .events/ constraint after subclass expansion through mem.ttl axioms', () => {
  const axioms = `
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    mem:ContradictionDetected rdfs:subClassOf mem:Event .
    mem:Event rdfs:subClassOf as:Activity .`;
  const closure = buildSubClassClosure(new Parser().parse(axioms));
  const declared = ['https://pod.vardeman.me/vault/ontology/mem#ContradictionDetected'];
  const expanded = expandSuperClasses(declared, closure);
  const constraints = [new PathConstraintConfig(
    '/vault/wiki/.events/',
    ['https://pod.vardeman.me/vault/ontology/mem#Event'], [],
  )];
  const result = evaluatePathConstraint('/vault/wiki/.events/x.ttl', expanded, constraints);
  expect(result.ok).toBe(true);
});
