import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../tests/support/catalogFixtures';
import { SAME_PASS_TOLERANCE_MS, findSelectedPass, passIdFromHash, usePassSelection } from './passSelection';

const pass = goldenPassFixture();
const clearHash = (): void => {
  window.history.replaceState(null, '', window.location.pathname);
};

describe('passIdFromHash', () => {
  it('reads #pass=<id> and nothing else', () => {
    expect(passIdFromHash('#pass=25544-1789120094063')).toBe('25544-1789120094063');
    expect(passIdFromHash('#pass=')).toBeNull();
    expect(passIdFromHash('')).toBeNull();
    expect(passIdFromHash('#other')).toBeNull();
  });
});

describe('findSelectedPass', () => {
  const other = { ...pass, id: '48274-1789120094063', noradId: 48274 };
  it('matches the exact id first', () => {
    expect(findSelectedPass([other, pass], pass.id)).toBe(pass);
    expect(findSelectedPass([pass], null)).toBeNull();
    expect(findSelectedPass([], pass.id)).toBeNull();
  });

  it('accepts the same object starting within the tolerance when the id has drifted (D-31)', () => {
    const shifted = { ...pass, id: `25544-${String(pass.start.t + 1000)}`, start: { ...pass.start, t: pass.start.t + 1000 } };
    expect(findSelectedPass([other, shifted], pass.id)).toBe(shifted);
    const far = { ...shifted, id: `25544-${String(pass.start.t + SAME_PASS_TOLERANCE_MS + 1)}`, start: { ...pass.start, t: pass.start.t + SAME_PASS_TOLERANCE_MS + 1 } };
    expect(findSelectedPass([other, far], pass.id)).toBeNull();
    expect(findSelectedPass([shifted], 'not-an-id')).toBeNull();
  });
});

describe('usePassSelection (D-13)', () => {
  afterEach(clearHash);

  it('starts from the hash, writes it on open and clears it on close', () => {
    window.location.hash = `#pass=${pass.id}`;
    const { result } = renderHook(() => usePassSelection());
    expect(result.current.selectedId).toBe(pass.id);

    act(() => {
      result.current.close();
    });
    expect(result.current.selectedId).toBeNull();
    expect(window.location.hash).toBe('');

    act(() => {
      result.current.open('48274-1');
    });
    expect(result.current.selectedId).toBe('48274-1');
    expect(window.location.hash).toBe('#pass=48274-1');
  });

  it('follows an external hash change (browser Back)', async () => {
    const { result } = renderHook(() => usePassSelection());
    expect(result.current.selectedId).toBeNull();
    await act(async () => {
      window.location.hash = `#pass=${pass.id}`;
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.selectedId).toBe(pass.id);
  });
});
