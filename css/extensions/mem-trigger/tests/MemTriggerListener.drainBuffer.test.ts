import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import { pendingEventsBuffer } from '../src/PendingEventsBuffer';
import type { MonitoringStore, ResourceStore } from '@solid/community-server';

describe('MemTriggerListener.drainPendingEvents', () => {
  let emitSpy: ReturnType<typeof vi.fn>;
  let onChangeHandler: ((target: { path: string }, a: unknown, m: unknown) => void) | null = null;

  beforeEach(() => {
    emitSpy = vi.fn().mockResolvedValue(undefined);
    onChangeHandler = null;
    // Clear the module-level buffer between tests.
    pendingEventsBuffer.length = 0;
    // Stub fetch globally so Type Index loading (deferred lazy load) doesn't try real I/O.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '@prefix solid: <http://www.w3.org/ns/solid/terms#> .',
    }));
  });

  afterEach(() => {
    pendingEventsBuffer.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeListener(): MemTriggerListener {
    const monitoring = {
      on: vi.fn((evt: string, h: typeof onChangeHandler) => {
        if (evt === 'changed') onChangeHandler = h;
      }),
    } as unknown as MonitoringStore;
    const store = {} as unknown as ResourceStore;
    const listener = new MemTriggerListener(
      monitoring, store,
      'https://pod.vardeman.me/vault/wiki/.events/',
      'https://pod.vardeman.me/vault',
      12, 86400000, 3600000, [],
      'https://pod.vardeman.me/vault/settings/publicTypeIndex',
    );
    (listener as unknown as { emitter: { emit: typeof emitSpy } }).emitter = { emit: emitSpy };
    return listener;
  }

  it('drains buffered events on startup (handle())', async () => {
    pendingEventsBuffer.push('<turtle-event-1>', '<turtle-event-2>');

    const listener = makeListener();
    await listener.handle();
    // Let any post-handle drain microtasks settle.
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(emitSpy).toHaveBeenNthCalledWith(1, '<turtle-event-1>');
    expect(emitSpy).toHaveBeenNthCalledWith(2, '<turtle-event-2>');
    expect(pendingEventsBuffer.length).toBe(0);
    listener.finalize?.();
  });

  it("drains buffered events when a 'changed' event fires", async () => {
    const listener = makeListener();
    await listener.handle();
    expect(emitSpy).not.toHaveBeenCalled(); // buffer was empty at handle()

    // Now an UnprocessableWrite hook enqueues an event after a 422.
    pendingEventsBuffer.push('<turtle-event-from-rejected-write>');

    // A separate (successful) write fires the 'changed' event.
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).toHaveBeenCalledWith('<turtle-event-from-rejected-write>');
    expect(pendingEventsBuffer.length).toBe(0);
    listener.finalize?.();
  });

  it('does not double-drain when buffer is empty', async () => {
    const listener = makeListener();
    await listener.handle();
    onChangeHandler!({ path: 'https://pod.vardeman.me/vault/wiki/concepts/x.md' }, null, null);
    await new Promise((r) => setImmediate(r));

    expect(emitSpy).not.toHaveBeenCalled();
    listener.finalize?.();
  });
});
