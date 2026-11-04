import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PREFS_KEY } from '../../data/localPrefs';
import { appStore, usePrivacyNote } from '../../state';

/** R182 (FR-KEEP-4, D-1105): the privacy note's one selector, read by the footer and the location input (R190). */
describe('usePrivacyNote', () => {
  afterEach(() => {
    localStorage.clear();
    appStore.setState({ privacyNoteClosed: false });
  });

  it('FR-KEEP-4: is shown until closed, and close saves privacyNoteClosed for every later visit', () => {
    const { result } = renderHook(() => usePrivacyNote());
    expect(result.current.shown).toBe(true);
    act(() => {
      result.current.close();
    });
    expect(result.current.shown).toBe(false);
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')).toMatchObject({ privacyNoteClosed: true });
  });

  it('FR-KEEP-4: one close hides the note for every reader of the flag', () => {
    const footer = renderHook(() => usePrivacyNote());
    const input = renderHook(() => usePrivacyNote());
    act(() => {
      footer.result.current.close();
    });
    expect(input.result.current.shown).toBe(false);
  });
});
