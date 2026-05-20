import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

const TYPE_INDEX_TTL = `
  @prefix solid: <http://www.w3.org/ns/solid/terms#> .
  <#concepts> a solid:TypeRegistration ;
    solid:instanceContainer </vault/wiki/concepts/> .
`;

function makeStore() {
  return {
    getRepresentation: vi.fn().mockResolvedValue({
      data: Readable.from([TYPE_INDEX_TTL]),
      metadata: { contentType: 'text/turtle' },
    }),
  } as unknown as ResourceStore;
}

describe('MemTriggerListener.tickReflection', () => {
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => { emitSpy = vi.fn().mockResolvedValue(undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('emits ReflectionDue for subjects with activity past the interval', async () => {
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,
      200,    // reflectionIntervalMs — short for test
      100,    // reflectionTickRateMs — short for test
      [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();

    // Pre-populate lastActivity for two subjects, well in the past.
    const long_ago = new Date(Date.now() - 1000);
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/a.md', long_ago,
    );
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/b.md', long_ago,
    );

    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).toHaveBeenCalledTimes(2);

    listener.finalize?.();
  });

  it('does not emit again on second tick without new activity', async () => {
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 200, 100, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();

    const long_ago = new Date(Date.now() - 1000);
    (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity.set(
      'https://pod.vardeman.me/vault/wiki/concepts/a.md', long_ago,
    );

    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).toHaveBeenCalledTimes(1);

    emitSpy.mockClear();
    await (listener as unknown as { tickReflection(): Promise<void> }).tickReflection();
    expect(emitSpy).not.toHaveBeenCalled();

    listener.finalize?.();
  });

  it('finalize() clears the reflection interval', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;
    const listener = new MemTriggerListener(
      monitoring, makeStore(),
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 200, 100, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    await listener.handle();
    expect(setIntervalSpy).toHaveBeenCalled();

    listener.finalize?.();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
