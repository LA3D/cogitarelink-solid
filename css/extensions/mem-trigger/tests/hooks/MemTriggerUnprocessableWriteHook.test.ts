import { describe, it, expect, beforeEach } from 'vitest';
import { MemTriggerUnprocessableWriteHook } from '../../src/hooks/MemTriggerUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../../src/detectors/UnprocessableWriteDetector';
import { pendingEventsBuffer } from '../../src/PendingEventsBuffer';

describe('MemTriggerUnprocessableWriteHook', () => {
  beforeEach(() => {
    // Clear the module-level buffer before each test
    pendingEventsBuffer.length = 0;
  });

  it('enqueues a mem:UnprocessableWrite event to pendingEventsBuffer on rejection', async () => {
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport ; sh:conforms false .',
      writerWebId: 'https://pod.vardeman.me/vault/profile/card#me',
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(pendingEventsBuffer).toHaveLength(1);
    const turtle = pendingEventsBuffer[0];
    expect(turtle).toContain('mem:UnprocessableWrite');
    expect(turtle).toContain('https://pod.vardeman.me/vault/wiki/concepts/x.md');
  });

  it('does not enqueue when validationReport is empty', async () => {
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '',
      timestamp: new Date(),
    });

    expect(pendingEventsBuffer).toHaveLength(0);
  });
});
