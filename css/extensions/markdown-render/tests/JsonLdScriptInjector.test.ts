// Tests for JsonLdScriptInjector — pure data-shape unit tests.
//
// The injector lives in src-cjs/ rather than src/ (per investigation findings
// for Task A.7-A.9): its only consumer is the CJS converter, and keeping it
// CJS-side avoids re-introducing the ESM dynamic-import dance that wraps the
// rehype pipeline. n3 ships CJS exports, so vitest picks it up directly.

import { describe, it, expect } from 'vitest';
import { Quad, DataFactory } from 'n3';
import { JsonLdScriptInjector } from '../src-cjs/JsonLdScriptInjector';
const { namedNode, literal, quad } = DataFactory;

describe('JsonLdScriptInjector', () => {
  const resourceIri = 'https://pod.example.com/vault/wiki/';
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const WIKI_PAGE = 'https://pod.vardeman.me/vault/ontology/wiki#Page';
  const DCT_TITLE = 'http://purl.org/dc/terms/title';

  it('emits a <script type="application/ld+json"> block for a resource with meta triples', () => {
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(RDF_TYPE), namedNode(WIKI_PAGE)),
      quad(namedNode(resourceIri), namedNode(DCT_TITLE), literal('Test Page')),
    ];
    const injector = new JsonLdScriptInjector();
    const result = injector.buildScriptTag(resourceIri, triples);
    expect(result).toMatch(/^<script type="application\/ld\+json">/);
    expect(result).toContain('"@id": "https://pod.example.com/vault/wiki/"');
    expect(result).toContain('"@type"');
    expect(result).toContain('Test Page');
    expect(result).toMatch(/<\/script>$/);
  });

  it('returns an empty string when there are no triples for the resource', () => {
    const injector = new JsonLdScriptInjector();
    const result = injector.buildScriptTag(resourceIri, []);
    expect(result).toBe('');
  });

  it('filters by subject — only emits triples where subject = resourceIri', () => {
    const otherIri = 'https://pod.example.com/vault/wiki/other.md';
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(DCT_TITLE), literal('This page')),
      quad(namedNode(otherIri), namedNode(DCT_TITLE), literal('Other page')),
    ];
    const injector = new JsonLdScriptInjector();
    const result = injector.buildScriptTag(resourceIri, triples);
    expect(result).toContain('This page');
    expect(result).not.toContain('Other page');
  });

  // ── termType-aware projection (audit M3 / R1.4) ──────────────────────────
  // The injected JSON-LD must distinguish a relationship IRI (NamedNode) from a
  // string value (Literal). We parse the emitted <script> back to JSON and
  // assert the object SHAPE, not substring presence.
  function parse(result: string): Record<string, unknown> {
    const m = result.match(/<script[^>]*>\n([\s\S]*)\n<\/script>$/);
    expect(m).not.toBeNull();
    return JSON.parse(m![1]);
  }

  const SKOS_BROADER = 'http://www.w3.org/2004/02/skos/core#broader';
  const SKOS_PREF = 'http://www.w3.org/2004/02/skos/core#prefLabel';
  const XSD_DATETIME = 'http://www.w3.org/2001/XMLSchema#dateTime';
  const DCT_CREATED = 'http://purl.org/dc/terms/created';

  it('wraps a NamedNode object as { "@id": value } (relationship IRI)', () => {
    const target = 'https://pod.example.com/vault/wiki/concepts/memory.md#this';
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(SKOS_BROADER), namedNode(target)),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[SKOS_BROADER]).toEqual({ '@id': target });
  });

  it('emits a plain literal as a bare string (xsd:string carries no @type)', () => {
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(SKOS_PREF), literal('Agent Memory')),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[SKOS_PREF]).toBe('Agent Memory');
  });

  it('emits a typed literal as { "@value", "@type" }', () => {
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(DCT_CREATED), literal('2026-06-03T00:00:00Z', namedNode(XSD_DATETIME))),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[DCT_CREATED]).toEqual({ '@value': '2026-06-03T00:00:00Z', '@type': XSD_DATETIME });
  });

  it('emits a language literal as { "@value", "@language" }', () => {
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(SKOS_PREF), literal('Mémoire', 'fr')),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[SKOS_PREF]).toEqual({ '@value': 'Mémoire', '@language': 'fr' });
  });

  it('keeps @type values as bare IRI strings (not {@id} nodes)', () => {
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(RDF_TYPE), namedNode(WIKI_PAGE)),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json['@type']).toBe(WIKI_PAGE);
  });

  it('does not collapse a NamedNode object and a same-string literal', () => {
    // A relationship to an IRI that happens to read like a string value must
    // NOT serialize identically to a literal of that string.
    const both = 'https://pod.example.com/vault/wiki/x';
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(SKOS_BROADER), namedNode(both)),
      quad(namedNode(resourceIri), namedNode(SKOS_PREF), literal(both)),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[SKOS_BROADER]).toEqual({ '@id': both });
    expect(json[SKOS_PREF]).toBe(both);
  });

  it('groups multi-valued predicates into a JSON array of termType-aware nodes', () => {
    const a = 'https://pod.example.com/vault/wiki/a.md#this';
    const b = 'https://pod.example.com/vault/wiki/b.md#this';
    const triples: Quad[] = [
      quad(namedNode(resourceIri), namedNode(SKOS_BROADER), namedNode(a)),
      quad(namedNode(resourceIri), namedNode(SKOS_BROADER), namedNode(b)),
    ];
    const json = parse(new JsonLdScriptInjector().buildScriptTag(resourceIri, triples));
    expect(json[SKOS_BROADER]).toEqual([{ '@id': a }, { '@id': b }]);
  });
});
