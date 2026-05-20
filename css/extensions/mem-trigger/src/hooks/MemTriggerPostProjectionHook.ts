import type { IPostProjectionHook } from './IPostProjectionHook';
import { ContradictionDetector } from '../detectors/ContradictionDetector';
import type { EventEmitter } from '../EventEmitter';

export class MemTriggerPostProjectionHook implements IPostProjectionHook {
  private readonly detector: ContradictionDetector;
  private readonly emitter: EventEmitter;

  public constructor(detector: ContradictionDetector, emitter: EventEmitter) {
    this.detector = detector;
    this.emitter = emitter;
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
      await this.emitter.emit(turtle);
    }
  }
}
