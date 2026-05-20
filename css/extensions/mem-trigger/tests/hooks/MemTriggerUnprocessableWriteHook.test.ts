import { describe, it, expect, vi } from 'vitest';
import { MemTriggerUnprocessableWriteHook } from '../../src/hooks/MemTriggerUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../../src/detectors/UnprocessableWriteDetector';
import type { EventEmitter } from '../../src/EventEmitter';

describe('MemTriggerUnprocessableWriteHook', () => {
  it('emits a mem:UnprocessableWrite event on rejection', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector, emitter);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '@prefix sh: <http://www.w3.org/ns/shacl#> . [] a sh:ValidationReport ; sh:conforms false .',
      writerWebId: 'https://pod.vardeman.me/vault/profile/card#me',
      timestamp: new Date('2026-05-20T12:00:00Z'),
    });

    expect(emitter.emit).toHaveBeenCalledOnce();
    const turtle = (emitter.emit as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(turtle).toContain('mem:UnprocessableWrite');
    expect(turtle).toContain('https://pod.vardeman.me/vault/wiki/concepts/x.md');
  });

  it('does not emit when validationReport is empty', async () => {
    const emitter = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventEmitter;
    const detector = new UnprocessableWriteDetector();
    const hook = new MemTriggerUnprocessableWriteHook(detector, emitter);

    await hook.onShaclRejection({
      targetUri: 'https://pod.vardeman.me/vault/wiki/concepts/x.md',
      validationReport: '',
      timestamp: new Date(),
    });

    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
