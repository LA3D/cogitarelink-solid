import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadDurableContainers } from '../src/loadDurableContainers';

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

function mockFetch(turtle: string, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => turtle,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDurableContainers', () => {
  it('parses solid:instanceContainer values from a Type Index Turtle document', async () => {
    mockFetch(TYPE_INDEX_TURTLE);

    const set = await loadDurableContainers('https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(3);
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
    expect(set.has('/vault/wiki/sources/')).toBe(true);
    expect(set.has('/vault/wiki/people/')).toBe(true);
  });

  it('returns empty set when Type Index fetch fails with network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const set = await loadDurableContainers('https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(0);
  });

  it('returns empty set when Type Index returns non-OK HTTP status', async () => {
    mockFetch('', 404);

    const set = await loadDurableContainers('https://pod.vardeman.me/vault/settings/publicTypeIndex');

    expect(set.size).toBe(0);
  });

  it('normalizes container URIs to trailing-slash form', async () => {
    const turtleNoSlash = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#x> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts> .
    `;
    mockFetch(turtleNoSlash);

    const set = await loadDurableContainers('https://pod.vardeman.me/vault/settings/publicTypeIndex');
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });
});
