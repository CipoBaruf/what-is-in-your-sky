// @vitest-environment jsdom
/**
 * R132 (FR-FLOW-6, D-848), R214 (FR-CTRL-9, D-1241): the hint in the reader's terms — worded by the pointer, turn and
 * zoom on the window and the globe until the first drag or zoom sets the device's key; the dome's drag clause, with
 * the follow clause on a coarse pointer with a key, until a first gesture sets `skyHintSeen` through `useChartHand`'s
 * slot; nothing on the polar chart (no drag, D-864); both languages.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { appStore } from '../../../state';
import { useChartHand } from '../guide/skychart/useChartHand';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { HINT_TOUCH_CLAUSES } from '../../../lib/layout';
import { markZoomHintDone, SkyHint, skyHintLine, useSkyHintShown, type SkyHintProps } from './SkyHint';

let media: MatchMediaStub | null = null;
const initial = appStore.getInitialState();

afterEach(() => {
  cleanup();
  media?.restore();
  media = null;
  appStore.setState(initial, true);
  localStorage.clear();
});

const hint = (props: SkyHintProps, locale: Locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <SkyHint {...props} />
    </I18nProvider>,
  );

describe('<SkyHint> (FR-FLOW-6)', () => {
  it('FR-CTRL-9: words the window’s and the globe’s line for a mouse, and for a touch screen, reading the pointer once', () => {
    media = stubMatchMedia(1280);
    for (const view of ['window', 'globe'] as const) {
      media.setCoarsePointer(false);
      hint({ view, followKey: 'A' });
      expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^drag to turn · scroll to zoom$/);
      expect(screen.getByTestId('sky-hint')).toHaveAttribute('data-pointer', 'fine');
      cleanup();
      media.setCoarsePointer(true);
      // D-1241: the second clause follows the pointer; no follow clause in its place.
      hint({ view, followKey: 'A' });
      expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^drag to turn · pinch to zoom$/);
      expect(screen.getByTestId('sky-hint')).toHaveAttribute('data-pointer', 'coarse');
      cleanup();
    }
  });

  it('gives the dome the drag clause alone, and the polar chart, which has no drag, no hint (D-864)', () => {
    media = stubMatchMedia(1280);
    hint({ view: 'dome' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Drag or use the arrow keys$/);
    cleanup();
    media.setCoarsePointer(true);
    hint({ view: 'dome', followKey: 'A' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Drag to look · tap A to follow$/);
    cleanup();
    hint({ view: 'polar', followKey: 'A' });
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(renderHook(() => useSkyHintShown('polar')).result.current).toBe(false);
    expect(renderHook(() => useSkyHintShown('dome')).result.current).toBe(true);
  });

  it('speaks Spanish', () => {
    media = stubMatchMedia(390);
    media.setCoarsePointer(true);
    hint({ view: 'dome', followKey: 'B' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Arrastrá para mirar · tocá B para seguir$/);
    cleanup();
    hint({ view: 'window' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^arrastrá para girar · pellizcá para acercar$/);
    cleanup();
    media.setCoarsePointer(false);
    hint({ view: 'window' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^arrastrá para girar · rueda para acercar$/);
    cleanup();
    hint({ view: 'dome' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Arrastrá o usá las flechas$/);
  });

  it('skyHintLine: at most HINT_TOUCH_CLAUSES clauses on touch, in both languages, for every view and follow (FR-PHONE-5, D-966)', () => {
    for (const words of [en.window.skyHint, es.window.skyHint]) {
      for (const view of ['window', 'dome'] as const) {
        for (const follow of [null, 'A']) {
          const line = skyHintLine(words, view, 'coarse', { follow });
          expect(line.split(' · ').length, line).toBeLessThanOrEqual(HINT_TOUCH_CLAUSES);
          expect(line.startsWith(view === 'window' ? words.turn : words.drag.coarse)).toBe(true);
          expect(line).not.toMatch(/tap a star|tocá una estrella/);
        }
      }
      expect(skyHintLine(words, 'window', 'coarse', { follow: null })).toBe(`${words.turn} · ${words.zoom.coarse}`);
      expect(skyHintLine(words, 'dome', 'coarse', { follow: null })).toBe(words.drag.coarse);
      expect(skyHintLine(words, 'window', 'fine', { follow: 'A' })).toBe(`${words.turn} · ${words.zoom.fine}`);
    }
  });

  it('FR-CTRL-9: is gone from the window and the globe, and after a reload, once the device’s key is set', () => {
    media = stubMatchMedia(1280);
    hint({ view: 'window' });
    // A tap sets the dome's pref and leaves this line.
    act(() => {
      appStore.getState().setSkyHintSeen(true);
    });
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    act(() => {
      markZoomHintDone();
    });
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(localStorage.getItem('wiys:hint:globe:v1')).toBe('1');
    cleanup();
    for (const view of ['window', 'globe'] as const) expect(renderHook(() => useSkyHintShown(view)).result.current).toBe(false);
  });

  it('leaves the dome for good after the first gesture on any view, which the slot reports and the prefs keep (D-848)', () => {
    media = stubMatchMedia(390);
    hint({ view: 'dome' });
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    const { result } = renderHook(() => useChartHand());
    act(() => {
      result.current.slot.gesture();
    });
    expect(appStore.getState().skyHintSeen).toBe(true);
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ skyHintSeen: true });
    // A second gesture writes nothing new.
    act(() => {
      result.current.slot.gesture();
    });
    expect(appStore.getState().skyHintSeen).toBe(true);
    cleanup();
    hint({ view: 'dome' });
    expect(screen.queryByTestId('sky-hint')).toBeNull();
  });
});
