import { describe, it, expect } from 'vitest';
import { NoOpPostProjectionHook } from '../src-cjs/NoOpPostProjectionHook.js';

describe('NoOpPostProjectionHook', () => {
  it('resolves without side effects', async () => {
    const hook = new NoOpPostProjectionHook();
    await expect(
      hook.onEdgesWritten({
        subject: 'https://example.org/wiki/concepts/x.md#this',
        edges: [
          { predicate: 'http://example.org/wiki#supports', object: 'https://example.org/y' },
        ],
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});
