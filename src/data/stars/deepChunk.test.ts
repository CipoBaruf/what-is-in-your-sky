import { afterEach, describe, expect, it, vi } from 'vitest';

/** R154 (FR-LOOK-8, D-973): the deep chunk's one loader and its reader. */
describe('deepChunk', () => {
  afterEach(() => {
    vi.doUnmock('./deep.json');
    vi.resetModules();
  });

  it('reads the integer columns into degrees and magnitudes', async () => {
    const { parseDeepCatalog } = await import('./deepChunk');
    const deep = parseDeepCatalog({ ra: [35_999, 0], dec: [-8_950, 1_234], mag: [46, 65], bv: [-3, 6] });
    expect(deep.size).toBe(2);
    expect([...deep.ra]).toEqual([359.99, 0]);
    expect([...deep.dec]).toEqual([-89.5, 12.34]);
    expect([...deep.mag].map((m) => Math.round(m * 10) / 10)).toEqual([4.6, 6.5]);
    expect([...deep.bv].map((b) => Math.round(b * 10) / 10)).toEqual([-0.3, 0.6]);
    expect(Object.isFrozen(deep)).toBe(true);
  });

  it('refuses a column of another length', async () => {
    const { parseDeepCatalog } = await import('./deepChunk');
    expect(() => parseDeepCatalog({ ra: [1, 2], dec: [1, 2], mag: [50], bv: [1, 2] })).toThrow(/one entry per star/);
  });

  it('loads the committed file once and hands every caller the same catalogue', async () => {
    const { loadDeepChunk } = await import('./deepChunk');
    const first = loadDeepChunk();
    expect(loadDeepChunk()).toBe(first);
    const deep = await first;
    expect(deep.size).toBe(7373);
    expect(deep.mag[0]).toBeCloseTo(4.6, 5);
    expect(await loadDeepChunk()).toBe(deep);
  });

  it('does not keep a file that fails to parse either: the next call tries again', async () => {
    vi.doMock('./deep.json', () => ({ default: { ra: [1, 2], dec: [1], mag: [50], bv: [6] } }));
    const { loadDeepChunk } = await import('./deepChunk');
    const first = loadDeepChunk();
    await expect(first).rejects.toThrow(/one entry per star/);
    const second = loadDeepChunk();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow(/one entry per star/);
  });

  it('does not keep a failed load, so the next call fetches again', async () => {
    let calls = 0;
    vi.doMock('./deep.json', () => {
      calls += 1;
      if (calls === 1) throw new Error('offline');
      return { default: { ra: [100], dec: [200], mag: [50], bv: [6] } };
    });
    const { loadDeepChunk } = await import('./deepChunk');
    await expect(loadDeepChunk()).rejects.toThrow();
    const deep = await loadDeepChunk();
    expect(deep.size).toBe(1);
    expect(calls).toBe(2);
  });
});
