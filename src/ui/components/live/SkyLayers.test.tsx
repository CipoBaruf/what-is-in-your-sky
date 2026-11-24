/**
 * R222 (FR-LAND-3, FR-STAR-3 as amended, FR-KEEP-1; D-1240): the live page's `Turn` and `Layers` — the row split, the
 * names' default by view, the kept choices and the failed deep load that unpresses `faint` for the visit alone.
 */
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { STARS_PAGE_CATALOGS } from '../../../i18n/starsPageT';
import { en } from '../../../i18n/en';
import type { Locale } from '../../../model';
import { appStore } from '../../../state';
import { firstRowCount, LayersGroup, TurnGroup, useSkyLayers, type SkyLayersState } from './SkyLayers';

const initial = appStore.getInitialState();

afterEach(() => {
  appStore.setState(initial, true);
});

describe('firstRowCount (FR-FLOW-8, D-1249)', () => {
  it('fits three of the four layers on the first row in both languages at 32 cells, and two a quarter cell short', () => {
    const count = (locale: Locale, budget: number) => firstRowCount(Object.values(STARS_PAGE_CATALOGS[locale].layers), budget);
    expect(count('en', 32)).toBe(3);
    expect(count('es', 32)).toBe(3);
    // `stars figures planets` is 25.5 cells and `estrellas figuras planetas` 30.5.
    expect([count('en', 25.5), count('en', 25.25)]).toEqual([3, 2]);
    expect([count('es', 30.5), count('es', 30.25)]).toEqual([3, 2]);
    expect(count('en', 1)).toBe(1);
  });
});

describe('useSkyLayers (FR-LAND-3, FR-KEEP-1)', () => {
  it('draws the names on every view but the polar chart until tapped, then the tap holds for every view', () => {
    const { result, rerender } = renderHook(({ view }) => useSkyLayers(view), { initialProps: { view: 'window' as 'window' | 'polar' | 'globe' } });
    expect(result.current.layers).toEqual({ stars: true, figures: true, planets: true, names: true });
    rerender({ view: 'polar' });
    expect(result.current.layers.names).toBe(false);
    act(() => {
      result.current.toggle('names');
    });
    expect(result.current.layers.names).toBe(true);
    rerender({ view: 'globe' });
    expect(result.current.layers.names).toBe(true);
    expect(appStore.getState().namesChoice).toBe(true);
    act(() => {
      result.current.toggle('planets');
    });
    expect(appStore.getState().starLayers).toEqual({ stars: true, figures: true, planets: false });
  });

  it('unpresses faint for the visit when the deep load fails, and a press asks again', () => {
    const { result } = renderHook(() => useSkyLayers('globe'));
    act(() => {
      result.current.setFaint(true);
    });
    expect(result.current.faint).toBe(true);
    act(() => {
      result.current.onFaintFailed();
    });
    expect(result.current.faint).toBe(false);
    expect(appStore.getState().faintStars).toBe(true);
    act(() => {
      result.current.setFaint(true);
    });
    expect(result.current.faint).toBe(true);
  });
});

function Layers({ withFaint }: { withFaint: boolean }) {
  const state: SkyLayersState = useSkyLayers('window');
  return (
    <LayersGroup state={state} withFaint={withFaint}>
      <span data-testid="own">own</span>
    </LayersGroup>
  );
}

describe('LayersGroup and TurnGroup (FR-LAND-3)', () => {
  it('draws the four switches over two rows, faint with the globe, then the page’s own row', () => {
    const { rerender } = render(<Layers withFaint={false} />);
    const rows = screen.getAllByTestId('stars-layers-row');
    expect(rows.map((row) => [...row.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer')))).toEqual([['stars', 'figures', 'planets'], ['names']]);
    expect(within(screen.getByTestId('live-layers-own')).getByTestId('own')).toBeInTheDocument();
    rerender(<Layers withFaint />);
    const faint = screen.getByRole('button', { name: en.globe.faint });
    expect(faint).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(faint);
    expect(appStore.getState().faintStars).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.layers.stars }));
    expect(appStore.getState().starLayers.stars).toBe(false);
  });

  it('turns with you or with the stars', () => {
    let turned: string | null = null;
    render(
      <TurnGroup
        turn="you"
        onTurn={(turn) => {
          turned = turn;
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: en.globe.turnHeading })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.globe.turn.stars }));
    expect(turned).toBe('stars');
  });
});
