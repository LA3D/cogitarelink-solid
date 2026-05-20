import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';
import { Readable } from 'node:stream';

function buildContainerTurtle(childCount: number): string {
  const ldpContains = Array.from({ length: childCount }, (_, i) =>
    `<https://pod.vardeman.me/vault/wiki/concepts/child-${i}.md>`).join(',\n    ');
  return `
    @prefix ldp: <http://www.w3.org/ns/ldp#> .
    <https://pod.vardeman.me/vault/wiki/concepts/> ldp:contains
      ${ldpContains} .
  `;
}

describe('MemTriggerListener.checkBound', () => {
  let mockStore: ResourceStore;
  let mockMonitoring: MonitoringStore;
  let onChangeHandler: ((target: { path: string }, activity: unknown, metadata: unknown) => void) | null = null;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn().mockResolvedValue(undefined);
    onChangeHandler = null;
    mockMonitoring = {
      on: vi.fn((event: string, handler: typeof onChangeHandler) => {
        if (event === 'changed') onChangeHandler = handler;
      }),
    } as unknown as MonitoringStore;
  });

  it('emits BoundExceeded when parent container exceeds threshold', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(13)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring,
      mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,         // boundThreshold
      86400000,   // reflectionIntervalMs (unused this test)
      [],         // contradictoryPairs
    );
    // Inject spy emitter
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };

    await listener.handle();
    expect(onChangeHandler).not.toBeNull();
    onChangeHandler!(
      { path: 'https://pod.vardeman.me/vault/wiki/concepts/new-resource.md' },
      null,
      null,
    );
    // Drain chain
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).toHaveBeenCalledOnce();
    const turtle = emitSpy.mock.calls[0][0] as string;
    expect(turtle).toContain('mem:BoundExceeded');
  });

  it('does not emit when childCount equals threshold', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(12)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/new.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('skips writes to .events/ parent', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([buildContainerTurtle(20)]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, [],
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/.events/x.ttl' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
    expect(mockStore.getRepresentation).not.toHaveBeenCalled();
  });
});
