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
});
