/**
 * Module-level pending-events buffer. Breaks the Components.js circular
 * dependency that would occur if MemTriggerUnprocessableWriteHook held a
 * ResourceStore reference (ShaclValidator is constructed before ResourceStore
 * is finalized).
 *
 * Pattern: hook enqueues Turtle strings here; MemTriggerListener.handle()
 * (an Initializer — runs after ResourceStore is ready) drains the queue on
 * startup and subscribes to flush on each 'changed' event.
 *
 * T11 note: draining is wired in T12. For T11 the buffer just accumulates;
 * events are not yet written to the Pod. The Override is confirmed working if
 * CSS boots and SHACL-failing writes enqueue here (visible in logs).
 */
export const pendingEventsBuffer: string[] = [];
