import { describe, it, expect } from 'vitest';
import { buildSubClassClosure, expandSuperClasses } from '../src/subClassClosure';
import { Parser } from 'n3';

const AXIOMS = `
@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
as:Announce rdfs:subClassOf as:Activity .
mem:CrystallizeAction rdfs:subClassOf mem:Action .
mem:ContradictionDetected rdfs:subClassOf mem:Event .
mem:Event rdfs:subClassOf as:Activity .
`;

describe('subClassClosure', () => {
  it('maps a class to all transitive ancestors', () => {
    const quads = new Parser().parse(AXIOMS);
    const closure = buildSubClassClosure(quads);
    expect(closure.get('https://pod.vardeman.me/vault/ontology/mem#ContradictionDetected'))
      .toEqual(expect.arrayContaining([
        'https://pod.vardeman.me/vault/ontology/mem#Event',
        'https://www.w3.org/ns/activitystreams#Activity',
      ]));
  });

  it('expandSuperClasses includes declared types plus all ancestors', () => {
    const quads = new Parser().parse(AXIOMS);
    const closure = buildSubClassClosure(quads);
    const declared = ['https://www.w3.org/ns/activitystreams#Announce'];
    const expanded = expandSuperClasses(declared, closure);
    expect(expanded).toContain('https://www.w3.org/ns/activitystreams#Announce');
    expect(expanded).toContain('https://www.w3.org/ns/activitystreams#Activity');
  });

  it('returns declared types unchanged when no axioms apply', () => {
    const closure = buildSubClassClosure([]);
    expect(expandSuperClasses(['urn:x'], closure)).toEqual(['urn:x']);
  });
});
