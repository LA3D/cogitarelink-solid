import { IPostProjectionHook } from './IPostProjectionHook';
import { ContradictionDetector } from '../detectors/ContradictionDetector';
import { pendingEventsBuffer } from '../PendingEventsBuffer';

/**
 * Hook fired by MarkdownProjectionListener after .meta projection completes.
 * Runs ContradictionDetector over the projected <#this>-subject edges; pushes
 * any emitted Turtle to the module-level pendingEventsBuffer. MemTriggerListener
 * (an Initializer, runs after ResourceStore is finalized) drains the buffer.
 *
 * Uses the same buffer pattern as MemTriggerUnprocessableWriteHook to keep
 * substrate event emission centralized and avoid Components.js circular DI.
 */
export class MemTriggerPostProjectionHook extends IPostProjectionHook {
  private readonly detector: ContradictionDetector;

  public constructor(detector: ContradictionDetector) {
    super();
    this.detector = detector;
  }

  public async onEdgesWritten(input: {
    subject: string;
    edges: Array<{ predicate: string; object: string }>;
    timestamp: Date;
  }): Promise<void> {
    const turtle = this.detector.maybeEmit({
      subject: input.subject,
      edges: input.edges,
      now: input.timestamp,
    });
    if (turtle !== null) {
      pendingEventsBuffer.push(turtle);
    }
  }
}
