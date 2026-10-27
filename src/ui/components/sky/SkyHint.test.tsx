// @vitest-environment jsdom
/**
 * R132 (FR-FLOW-6, D-848): the hand hint in the reader's terms — worded by the
 * pointer, the follow clause on a coarse pointer with a key, the drag clause
 * alone on the dome and the polar chart, both languages, and gone for good
 * once a first gesture on any view sets `skyHintSeen` through
 * `useChartHand`'s slot.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { appStore } from '../../../state';
import { useChartHand } from '../guide/skychart/useChartHand';
import { SkyHint, type SkyHintProps } from './SkyHint';

let media: MatchMediaStub | null = null;
const initial = appStore.getInitialState();

afterEach(() => {
  cleanup();
  media?.restore();
  media = null;
  appStore.setState(initial, true);
});

const hint = (props: SkyHintProps, locale: Locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <SkyHint {...props} />
    </I18nProvider>,
  );

describe('<SkyHint> (FR-FLOW-6)', () => {
  it('words the window’s line for a mouse, and for a touch screen, reading the pointer once', () => {
    media = stubMatchMedia(1280);
    hint({ view: 'window' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag or use the arrow keys · ctrl + wheel to zoom · click a star');
    expect(screen.getByTestId('sky-hint')).toHaveAttribute('data-pointer', 'fine');
    cleanup();
    media.setCoarsePointer(true);
    hint({ view: 'window' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag to look · pinch to zoom · tap a star');
    expect(screen.getByTestId('sky-hint')).toHaveAttribute('data-pointer', 'coarse');
  });

  it('ends the coarse line with the follow clause where the live page names a key, and leaves the fine line alone (FR-SKY-13)', () => {
    media = stubMatchMedia(390);
    media.setCoarsePointer(true);
    hint({ view: 'window', followKey: 'A' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag to look · pinch to zoom · tap a star · tap A to follow');
    cleanup();
    media.setCoarsePointer(false);
    hint({ view: 'window', followKey: 'A' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag or use the arrow keys · ctrl + wheel to zoom · click a star');
  });

  it('gives the dome and the polar chart the drag clause alone', () => {
    media = stubMatchMedia(1280);
    hint({ view: 'dome' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Drag or use the arrow keys$/);
    cleanup();
    media.setCoarsePointer(true);
    hint({ view: 'polar', followKey: 'A' });
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Drag to look · tap A to follow$/);
  });

  it('speaks Spanish', () => {
    media = stubMatchMedia(390);
    media.setCoarsePointer(true);
    hint({ view: 'window', followKey: 'B' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Arrastrá para mirar · pellizcá para acercar · tocá una estrella · tocá B para seguir');
    cleanup();
    media.setCoarsePointer(false);
    hint({ view: 'dome' }, 'es');
    expect(screen.getByTestId('sky-hint')).toHaveTextContent(/^Arrastrá o usá las flechas$/);
  });

  it('is gone for good after the first gesture on any view, which the slot reports and the prefs keep (D-848)', () => {
    media = stubMatchMedia(390);
    hint({ view: 'window' });
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
