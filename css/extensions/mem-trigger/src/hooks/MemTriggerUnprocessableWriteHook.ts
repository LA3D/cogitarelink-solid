import type { IUnprocessableWriteHook } from './IUnprocessableWriteHook';
import { UnprocessableWriteDetector } from '../detectors/UnprocessableWriteDetector';
import type { EventEmitter } from '../EventEmitter';

export class MemTriggerUnprocessableWriteHook implements IUnprocessableWriteHook {
  private readonly detector: UnprocessableWriteDetector;
  private readonly emitter: EventEmitter;

  public constructor(detector: UnprocessableWriteDetector, emitter: EventEmitter) {
    this.detector = detector;
    this.emitter = emitter;
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
      await this.emitter.emit(turtle);
    }
  }
}
