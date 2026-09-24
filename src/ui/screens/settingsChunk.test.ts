/**
 * R93 (D-545): the one place that fetches the settings chunk. The shared promise is what makes the route,
 * the header's link and the idle prefetch one request — and it is also what would make a single failed
 * request permanent, so the failure is the part worth pinning.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const loader = vi.hoisted(() => ({ calls: 0, fail: true }));
vi.mock('./Settings', async () => {
  loader.calls += 1;
  if (loader.fail) return Promise.reject(new Error('chunk unreachable'));
  return { Settings: () => null };
});

describe('loadSettingsChunk (D-545)', () => {
  afterEach(() => {
    vi.resetModules();
    loader.calls = 0;
    loader.fail = true;
  });

  it('asks again after a failed fetch, rather than keeping the rejection for ever', async () => {
    const { loadSettingsChunk } = await import('./settingsChunk');
    await expect(loadSettingsChunk()).rejects.toThrow();
    expect(loader.calls).toBe(1);
    // The dropped request is not a verdict: the next tap on `[ settings ]` reaches the network again.
    loader.fail = false;
    await expect(loadSettingsChunk()).resolves.toBeDefined();
    expect(loader.calls).toBe(2);
    // And once it holds, it is the one request the three callers share.
    await Promise.all([loadSettingsChunk(), loadSettingsChunk()]);
    expect(loader.calls).toBe(2);
  });

});
