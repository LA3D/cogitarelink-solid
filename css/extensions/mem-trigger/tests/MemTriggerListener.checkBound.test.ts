import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';

function buildContainerTurtle(childCount: number): string {
  const ldpContains = Array.from({ length: childCount }, (_, i) =>
    `<https://pod.vardeman.me/vault/wiki/concepts/child-${i}.md>`).join(',\n    ');
  return `
    @prefix ldp: <http://www.w3.org/ns/ldp#> .
    <https://pod.vardeman.me/vault/wiki/concepts/> ldp:contains
      ${ldpContains} .
  `;
}

const EMPTY_TYPE_INDEX_TTL = '@prefix solid: <http://www.w3.org/ns/solid/terms#> .';

const CONCEPTS_TYPE_INDEX_TTL = `
  @prefix solid: <http://www.w3.org/ns/solid/terms#> .
  <#concepts> a solid:TypeRegistration ;
    solid:instanceContainer </vault/wiki/concepts/> .
`;

/**
 * Sets up a global fetch mock. The mockFn receives path and returns turtle.
 * Defaults: typeIndex returns empty TTL, containers return the provided turtle.
 */
function setupFetch(containerTurtle: string): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('publicTypeIndex')) {
      return { ok: true, status: 200, text: async () => EMPTY_TYPE_INDEX_TTL };
    }
    return { ok: true, status: 200, text: async () => containerTurtle };
  }));
}

/** Set up fetch so that Type Index returns concepts registration. */
function setupFetchWithTypeIndex(containerTurtle: string): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('publicTypeIndex')) {
      return { ok: true, status: 200, text: async () => CONCEPTS_TYPE_INDEX_TTL };
    }
    return { ok: true, status: 200, text: async () => containerTurtle };
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    mockStore = {
      setRepresentation: vi.fn().mockResolvedValue(undefined),
    } as unknown as ResourceStore;
  });

  it('emits BoundExceeded when parent container exceeds threshold', async () => {
    setupFetch(buildContainerTurtle(13));

    const listener = new MemTriggerListener(
      mockMonitoring,
      mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12,         // boundThreshold
      86400000,   // reflectionIntervalMs
      3600000,    // reflectionTickRateMs
      [],         // contradictoryPairs
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    // Inject spy emitter
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    // Override startupTime to 0 so grace period is already past
    (listener as unknown as { startupTime: number }).startupTime = 0;

    await listener.handle();
    expect(onChangeHandler).not.toBeNull();
    onChangeHandler!(
      { path: 'https://pod.vardeman.me/vault/wiki/concepts/new-resource.md' },
      null,
      null,
    );
    // Drain chain
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).toHaveBeenCalledOnce();
    const turtle = emitSpy.mock.calls[0][0] as string;
    expect(turtle).toContain('mem:BoundExceeded');
  });

  it('does not emit when childCount equals threshold', async () => {
    setupFetch(buildContainerTurtle(12));

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    (listener as unknown as { startupTime: number }).startupTime = 0;

    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/new.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('skips writes to .events/ parent', async () => {
    setupFetch(buildContainerTurtle(20));

    const listener = new MemTriggerListener(
      mockMonitoring, mockStore,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    (listener as unknown as { startupTime: number }).startupTime = 0;

    await listener.handle();

    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/.events/x.ttl' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
  });
});

describe('MemTriggerListener.handle: durable-container loading and activity tracking', () => {
  it('loads durable containers from Type Index on first onChange after grace period', async () => {
    setupFetchWithTypeIndex(buildContainerTurtle(0));

    const store = {
      setRepresentation: vi.fn().mockResolvedValue(undefined),
    } as unknown as ResourceStore;
    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
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
    // Override startupTime so grace period is past
    (listener as unknown as { startupTime: number }).startupTime = 0;

    await listener.handle();

    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const set = (listener as unknown as { durableContainers: Set<string> }).durableContainers;
    expect(set.has('/vault/wiki/concepts/')).toBe(true);
  });

  it('tracks lastActivity for writes under durable containers (after containers load)', async () => {
    setupFetchWithTypeIndex(buildContainerTurtle(0));

    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      setRepresentation: vi.fn().mockResolvedValue(undefined),
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
    (listener as unknown as { startupTime: number }).startupTime = 0;
    await listener.handle();

    // First onChange: triggers loadDurableContainers in the chain. isDurableTarget
    // is checked synchronously BEFORE the chain completes, so lastActivity is not set yet.
    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/first.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // durableContainers is now loaded (/vault/wiki/concepts/ registered).
    const set = (listener as unknown as { durableContainers: Set<string> }).durableContainers;
    expect(set.has('/vault/wiki/concepts/')).toBe(true);

    // Second onChange: isDurableTarget now correctly returns true → lastActivity is set.
    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.has('https://pod.vardeman.me/vault/wiki/concepts/x.md')).toBe(true);
  });

  it('does NOT track lastActivity for writes outside durable containers', async () => {
    setupFetchWithTypeIndex(buildContainerTurtle(0));

    let handler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;
    const store = {
      setRepresentation: vi.fn().mockResolvedValue(undefined),
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
    (listener as unknown as { startupTime: number }).startupTime = 0;
    await listener.handle();

    // First onChange: triggers loadDurableContainers (concepts/ is registered)
    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/first.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Second onChange for concepts/ — now tracked (isDurableTarget returns true)
    handler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Third onChange for working/ — not in durable containers
    handler!({ path: 'https://pod.vardeman.me/vault/wiki/working/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const activity = (listener as unknown as { lastActivity: Map<string, Date> }).lastActivity;
    expect(activity.has('https://pod.vardeman.me/vault/wiki/working/x.md')).toBe(false);
    // concepts/ write IS tracked (after containers loaded)
    expect(activity.has('https://pod.vardeman.me/vault/wiki/concepts/x.md')).toBe(true);
  });
});
