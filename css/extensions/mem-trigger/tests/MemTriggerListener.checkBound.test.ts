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
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path.includes('publicTypeIndex')) {
          return Promise.resolve({
            data: Readable.from(['@prefix solid: <http://www.w3.org/ns/solid/terms#> .']),
            metadata: { contentType: 'text/turtle' },
          });
        }
        return Promise.resolve({
          data: Readable.from([buildContainerTurtle(13)]),
          metadata: { contentType: 'text/turtle' },
        });
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring,
      mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,         // boundThreshold
      86400000,   // reflectionIntervalMs (unused this test)
      3600000,    // reflectionTickRateMs
      [],         // contradictoryPairs
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',  // typeIndexUri
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
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path.includes('publicTypeIndex')) {
          return Promise.resolve({
            data: Readable.from(['@prefix solid: <http://www.w3.org/ns/solid/terms#> .']),
            metadata: { contentType: 'text/turtle' },
          });
        }
        return Promise.resolve({
          data: Readable.from([buildContainerTurtle(12)]),
          metadata: { contentType: 'text/turtle' },
        });
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/new.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('skips writes to .events/ parent', async () => {
    mockStore = {
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path.includes('publicTypeIndex')) {
          return Promise.resolve({
            data: Readable.from(['@prefix solid: <http://www.w3.org/ns/solid/terms#> .']),
            metadata: { contentType: 'text/turtle' },
          });
        }
        return Promise.resolve({
          data: Readable.from([buildContainerTurtle(20)]),
          metadata: { contentType: 'text/turtle' },
        });
      }),
    } as unknown as ResourceStore;

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    // Record call count after handle() (one call to load Type Index).
    await listener.handle();
    const callsAfterHandle = (mockStore.getRepresentation as ReturnType<typeof vi.fn>).mock.calls.length;

    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/.events/x.ttl' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
    // No additional getRepresentation calls: .events/ path skipped before checkBound.
    expect((mockStore.getRepresentation as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterHandle);
  });
});

describe('MemTriggerListener.handle: durable-container loading and activity tracking', () => {
  it('loads durable containers from Type Index at handle()', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    const store = {
      getRepresentation: vi.fn().mockResolvedValue({
        data: Readable.from([TYPE_INDEX_TTL]),
        metadata: { contentType: 'text/turtle' },
      }),
    } as unknown as ResourceStore;
    const monitoring = { on: vi.fn() } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    await listener.handle();

    const set = (listener as unknown as { durableContainers: Set<string> }).durableContainers;
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });

  it('tracks lastActivity for writes under durable containers', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path.includes('publicTypeIndex')) {
          return Promise.resolve({
            data: Readable.from([TYPE_INDEX_TTL]),
            metadata: { contentType: 'text/turtle' },
          });
        }
        return Promise.resolve({
          data: Readable.from([buildContainerTurtle(0)]),
          metadata: { contentType: 'text/turtle' },
        });
      }),
    } as unknown as ResourceStore;
    const monitoring = {
      on: vi.fn((evt: string, h: typeof handler) => { if (evt === 'changed') handler = h; }),
    } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    await listener.handle();

    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.has('https://pod.vardeman.me/vault/wiki/concepts/x.md')).toBe(true);
  });

  it('does NOT track lastActivity for writes outside durable containers', async () => {
    const TYPE_INDEX_TTL = `
      @prefix solid: <http://www.w3.org/ns/solid/terms#> .
      <#concepts> a solid:TypeRegistration ;
        solid:instanceContainer </vault/wiki/concepts/> .
    `;
    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      getRepresentation: vi.fn().mockImplementation(({ path }: { path: string }) =>
        path.includes('publicTypeIndex')
          ? Promise.resolve({ data: Readable.from([TYPE_INDEX_TTL]), metadata: { contentType: 'text/turtle' } })
          : Promise.resolve({ data: Readable.from([buildContainerTurtle(0)]), metadata: { contentType: 'text/turtle' } }),
      ),
    } as unknown as ResourceStore;
    const monitoring = {
      on: vi.fn((evt: string, h: typeof handler) => { if (evt === 'changed') handler = h; }),
    } as unknown as MonitoringStore;

    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    await listener.handle();

    handler!({ path: 'https://pod.vardeman.me/vault/wiki/working/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.size).toBe(0);
  });
});
