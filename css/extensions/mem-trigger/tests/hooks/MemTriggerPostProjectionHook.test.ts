import { describe, it, expect, vi } from 'vitest';
import { MemTriggerPostProjectionHook } from '../../src/hooks/MemTriggerPostProjectionHook';
import { ContradictionDetector } from '../../src/detectors/ContradictionDetector';
import type { EventEmitter } from '../../src/EventEmitter';

const WIKI_SUPPORTS = 'https://pod.vardeman.me/vault/ontology/wiki#supports';
const WIKI_CRITICIZES = 'https://pod.vardeman.me/vault/ontology/wiki#criticizes';

describe('MemTriggerPostProjectionHook', () => {
  it('emits a mem:ContradictionDetected event when conflicting edges target same object', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new ContradictionDetector({
      contradictoryPairs: [[WIKI_SUPPORTS, WIKI_CRITICIZES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector, emitter);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: WIKI_CRITICIZES, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
      ],
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(emitter.emit).toHaveBeenCalledOnce();
    const turtle = (emitter.emit as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(turtle).toContain('mem:ContradictionDetected');
  });

  it('does not emit when edges are non-conflicting', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new ContradictionDetector({
      contradictoryPairs: [[WIKI_SUPPORTS, WIKI_CRITICIZES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector, emitter);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: WIKI_SUPPORTS, object: 'https://pod.vardeman.me/vault/wiki/concepts/z.md#this' },
      ],
      timestamp: new Date(),
    });

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
