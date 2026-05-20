import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemTriggerPostProjectionHook } from '../../src/hooks/MemTriggerPostProjectionHook';
import { ContradictionDetector } from '../../src/detectors/ContradictionDetector';
import { pendingEventsBuffer } from '../../src/PendingEventsBuffer';

// Actual URIs emitted by MarkdownProjectionListener for [[X]]{.supports}/{.criticizes}
// wikilinks — per wikilinkProjection.ts HINT_TO_PROJECTION map (CITO namespace).
const CITO_AGREES = 'http://purl.org/spar/cito/agreesWith';
const CITO_DISAGREES = 'http://purl.org/spar/cito/disagreesWith';

describe('MemTriggerPostProjectionHook', () => {
  beforeEach(() => { pendingEventsBuffer.length = 0; });
  afterEach(() => { pendingEventsBuffer.length = 0; });

  it('enqueues a mem:ContradictionDetected event when conflicting edges target same object', async () => {
    const detector = new ContradictionDetector({
      contradictoryPairs: [[CITO_AGREES, CITO_DISAGREES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: CITO_AGREES, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: CITO_DISAGREES, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
      ],
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(pendingEventsBuffer.length).toBe(1);
    expect(pendingEventsBuffer[0]).toContain('mem:ContradictionDetected');
  });

  it('does not enqueue when edges are non-conflicting', async () => {
    const detector = new ContradictionDetector({
      contradictoryPairs: [[CITO_AGREES, CITO_DISAGREES]],
    });
    const hook = new MemTriggerPostProjectionHook(detector);

    await hook.onEdgesWritten({
      subject: 'https://pod.vardeman.me/vault/wiki/concepts/x.md#this',
      edges: [
        { predicate: CITO_AGREES, object: 'https://pod.vardeman.me/vault/wiki/concepts/y.md#this' },
        { predicate: CITO_AGREES, object: 'https://pod.vardeman.me/vault/wiki/concepts/z.md#this' },
      ],
      timestamp: new Date(),
    });

    expect(pendingEventsBuffer.length).toBe(0);
  });
});
