import { describe, it, expect, vi } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';

// R-T4 / audit M1: the events container + Type Index URIs were hardcoded in
// mem-trigger.json (full literal IRIs) while the same block injected
// variable:baseUrl. Components.js can't concatenate strings, so derivation now
// happens in the listener from baseUrl + storagePath. Empty string ⇒ derive; a
// non-empty value ⇒ explicit override. This file pins both behaviours.
//
// Field access mirrors the other listener tests (cast to read private state).
function read(listener: MemTriggerListener) {
  const l = listener as unknown as { eventsContainer: string; typeIndexUri: string };
  return { eventsContainer: l.eventsContainer, typeIndexUri: l.typeIndexUri };
}

function build(opts: {
  baseUrl: string;
  eventsContainer?: string;
  typeIndexUri?: string;
  storagePath?: string;
}): MemTriggerListener {
  const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
  const store = {} as unknown as ResourceStore;
  const args: unknown[] = [
    monitoring,
    store,
    opts.eventsContainer ?? '', // derive
    opts.baseUrl,
    12,
    86400000,
    3600000,
    [],
    opts.typeIndexUri ?? '', // derive
  ];
  if (opts.storagePath !== undefined) args.push(opts.storagePath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (MemTriggerListener as any)(...args);
}

describe('MemTriggerListener IRI derivation (R-T4 / audit M1)', () => {
  it('derives events container + Type Index from baseUrl with the default /vault storagePath', () => {
    const listener = build({ baseUrl: 'https://pod.vardeman.me' });
    const { eventsContainer, typeIndexUri } = read(listener);
    expect(eventsContainer).toBe('https://pod.vardeman.me/vault/wiki/.events/');
    expect(typeIndexUri).toBe('https://pod.vardeman.me/vault/settings/publicTypeIndex');
  });

  it('honours a trailing slash on baseUrl', () => {
    const listener = build({ baseUrl: 'https://pod.vardeman.me/' });
    const { eventsContainer, typeIndexUri } = read(listener);
    expect(eventsContainer).toBe('https://pod.vardeman.me/vault/wiki/.events/');
    expect(typeIndexUri).toBe('https://pod.vardeman.me/vault/settings/publicTypeIndex');
  });

  it('derives from a custom storagePath', () => {
    const listener = build({ baseUrl: 'https://pod.example.org', storagePath: '/data' });
    const { eventsContainer, typeIndexUri } = read(listener);
    expect(eventsContainer).toBe('https://pod.example.org/data/wiki/.events/');
    expect(typeIndexUri).toBe('https://pod.example.org/data/settings/publicTypeIndex');
  });

  it('normalises a storagePath with a missing leading slash and a trailing slash', () => {
    const listener = build({ baseUrl: 'https://pod.example.org', storagePath: 'data/' });
    const { eventsContainer, typeIndexUri } = read(listener);
    expect(eventsContainer).toBe('https://pod.example.org/data/wiki/.events/');
    expect(typeIndexUri).toBe('https://pod.example.org/data/settings/publicTypeIndex');
  });

  it('lets an explicit eventsContainer / typeIndexUri override derivation', () => {
    const listener = build({
      baseUrl: 'https://pod.vardeman.me',
      eventsContainer: 'https://elsewhere.example/custom/.events/',
      typeIndexUri: 'https://elsewhere.example/custom/typeIndex',
    });
    const { eventsContainer, typeIndexUri } = read(listener);
    expect(eventsContainer).toBe('https://elsewhere.example/custom/.events/');
    expect(typeIndexUri).toBe('https://elsewhere.example/custom/typeIndex');
  });

  it('adds a trailing slash to an explicit eventsContainer that lacks one', () => {
    const listener = build({
      baseUrl: 'https://pod.vardeman.me',
      eventsContainer: 'https://elsewhere.example/custom/.events',
    });
    expect(read(listener).eventsContainer).toBe('https://elsewhere.example/custom/.events/');
  });
});
