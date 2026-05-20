import { getLoggerFor } from 'global-logger-factory';
import { IUnprocessableWriteHook } from './IUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../detectors/UnprocessableWriteDetector';
import { pendingEventsBuffer } from '../PendingEventsBuffer';

/**
 * Hook fired by ShaclValidator on SHACL-rejected writes. Builds a
 * mem:UnprocessableWrite Turtle event and pushes it to the module-level
 * pending-events buffer. MemTriggerListener (an Initializer — runs after
 * ResourceStore is finalized) drains the buffer to the Pod.
 *
 * The buffer design breaks the Components.js circular dependency that would
 * arise if this class held a direct ResourceStore reference (ShaclValidator
 * is instantiated before ResourceStore is fully constructed).
 *
 * T11: buffer-enqueue wired. T12: MemTriggerListener buffer-drain wired.
 */
export class MemTriggerUnprocessableWriteHook extends IUnprocessableWriteHook {
  private readonly logger = getLoggerFor(this);
  private readonly detector: UnprocessableWriteDetector;

  public constructor(detector: UnprocessableWriteDetector) {
    super();
    this.detector = detector;
  }

  public async onShaclRejection(input: {
    targetUri: string;
    validationReport: string;
    writerWebId?: string;
    timestamp: Date;
  }): Promise<void> {
    const turtle = this.detector.buildEvent({
      targetUri: input.targetUri,
      validationReport: input.validationReport,
      writerWebId: input.writerWebId,
      timestamp: input.timestamp,
    });
    if (turtle !== null) {
      pendingEventsBuffer.push(turtle);
      this.logger.info(
        `MemTriggerUnprocessableWriteHook: queued UnprocessableWrite event for ${input.targetUri} (buffer size=${pendingEventsBuffer.length})`,
      );
    }
  }
}
