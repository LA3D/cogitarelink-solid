import { describe, it, expect, vi } from 'vitest';
import { loadDurableContainers } from '../src/loadDurableContainers';
import type { ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

const TYPE_INDEX_TURTLE = `
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .

<#concepts> a solid:TypeRegistration ;
  solid:forClass wiki:Concept ;
  solid:instanceContainer </vault/wiki/concepts/> .

<#sources> a solid:TypeRegistration ;
  solid:forClass wiki:Source ;
  solid:instanceContainer </vault/wiki/sources/> .

<#people> a solid:TypeRegistration ;
  solid:forClass wiki:Person ;
  solid:instanceContainer </vault/wiki/people/> .
`;

describe('loadDurableContainers', () => {
  it('parses solid:instanceContainer values from a Type Index Turtle document', async () => {
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([TYPE_INDEX_TURTLE]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(3);
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
    expect(set.has('/vault/wiki/sources/')).toBe(true);
    expect(set.has('/vault/wiki/people/')).toBe(true);
  });

  it('returns empty set when Type Index read fails', async () => {
    const store = {
      getRepresentation: vi.fn().mockRejectedValue(new Error('Not found')),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(0);
  });

  it('normalizes container URIs to trailing-slash form', async () => {
    const turtleNoSlash = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#x> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts> .
    `;
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([turtleNoSlash]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const set = await loadDurableContainers(store, 'https://pod.vardeman.me/vault/settings/publicTypeIndex');
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });
});
