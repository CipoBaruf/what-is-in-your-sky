/**
 * FR-THEME-1 (R20; R156's Auto withdrawn in v2.12, D-1020): the two palettes. `applyTheme` writes `data-theme` only on
 * a change, and the shell's `useThemeTick` follows the saved preference at once, with no timer.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../state';
import { applyTheme } from './theme';
import { useThemeTick } from './useThemeTick';

const initial = appStore.getInitialState();

afterEach(() => {
  delete document.documentElement.dataset['theme'];
  appStore.setState(initial, true);
  vi.restoreAllMocks();
});

describe('applyTheme', () => {
  it('writes the palette on the root, and nothing when it is already there', () => {
    applyTheme('night');
    expect(document.documentElement.dataset['theme']).toBe('night');
    const set = vi.spyOn(document.documentElement, 'setAttribute');
    applyTheme('night');
    expect(set).not.toHaveBeenCalled();
    applyTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});

describe('useThemeTick (the shell’s one call)', () => {
  it('follows a change of preference at once and keeps no timer', () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    appStore.setState({ theme: 'dark' });
    renderHook(() => {
      useThemeTick();
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    act(() => {
      appStore.getState().setTheme('night');
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(interval).not.toHaveBeenCalled();
  });
});
