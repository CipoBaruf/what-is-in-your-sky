/**
 * R85 (F-81, FR-CAP-5, D-549): the legend as the short wide window's inventory. Each row's three times are
 * named in its accessible name wherever the legend is drawn; given an inventory, the list is clipped to what
 * `inventoryClip` says fits whole, the header row names the times, and `+n` counts the entries under the clip.
 */
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/useT';
import type { BodyLine, LegendRow } from '../../../../lib/legend';
import { inventoryClip } from '../../../screens/liveRows';
import { Legend, LegendInventoryContext, type LegendInventory } from './Legend';

const T = Date.UTC(2026, 8, 11, 9, 48, 24);

const row = (i: number): LegendRow => ({
  key: String.fromCharCode(65 + i),
  passId: `pass-${String(i)}`,
  name: `SAT ${String(i)}`,
  colorToken: 'series-1',
  riseMs: T + i * 600_000,
  peakMs: T + i * 600_000 + 14_000,
  endMs: T + i * 600_000 + 38_000,
  state: 'ahead',
  highlighted: true,
});

/** Five passes (two rows each) and the two bodies (one each): twelve rows, more than the seven the rail has. */
const rows = [0, 1, 2, 3, 4].map(row);
const bodies: BodyLine[] = [
  { body: 'sun', azDeg: 93, altDeg: -10.6 },
  { body: 'moon', azDeg: 200, altDeg: 20 },
];

const noop = (): void => undefined;

const legend = (inventory: LegendInventory | null, locale: 'en' | 'es' = 'en', listed: LegendRow[] = rows) =>
  render(
    <I18nProvider locale={locale}>
      <LegendInventoryContext.Provider value={inventory}>
        <Legend rows={listed} bodies={bodies} timeZone={null} highlightedPassId={null} onActivate={noop} onFocusRow={noop} />
      </LegendInventoryContext.Provider>
    </I18nProvider>,
  );

describe('<Legend>: the named times (FR-FLOW-13, D-852)', () => {
  it('writes the name and state, then "rise … · peak … · end …" on the second line, in both languages', () => {
    const { unmount } = legend(null);
    const en = screen.getByRole('button', { name: /^A\s*SAT 0\s*soon\s*rise 09:48:24\s*·\s*peak 09:48:38\s*·\s*end 09:49:02 UTC$/ });
    expect(en.querySelector('[class*="name"]')).toHaveTextContent(/^SAT 0 soon$/);
    expect(en.querySelector('[class*="times"]')).toHaveTextContent(/^rise 09:48:24\s*·\s*peak 09:48:38\s*·\s*end 09:49:02 UTC$/);
    expect(screen.queryByTestId('legend-inventory')).toBeNull();
    expect(screen.queryByTestId('legend-more')).toBeNull();
    unmount();
    legend(null, 'es');
    const es = screen.getByRole('button', { name: /^A\s*SAT 0\s*pronto\s*sale 09:48:24\s*·\s*máximo 09:48:38\s*·\s*termina 09:49:02 UTC$/ });
    expect(es.querySelector('[class*="name"]')).toHaveTextContent(/^SAT 0 pronto$/);
    expect(es.querySelector('[class*="times"]')).toHaveTextContent(/^sale 09:48:24\s*·\s*máximo 09:48:38\s*·\s*termina 09:49:02 UTC$/);
  });

  it('keeps the words on the pass detail’s dim rows, which drop the peak (FR-LEG-3)', () => {
    render(
      <I18nProvider locale="en">
        <Legend rows={[row(0), row(1)]} bodies={[]} timeZone={null} highlightedPassId={null} onActivate={noop} onFocusRow={noop} lead={{ passId: 'pass-0', node: <p>table</p> }} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /^B\s*SAT 1\s*soon\s*rise 09:58:24\s*·\s*end 09:59:02 UTC$/ })).toBeInTheDocument();
  });
});

describe('<Legend> as the short wide inventory (F-81)', () => {

  it('clips the list to whole entries and counts the rest in the +n line', () => {
    const budget = 8;
    legend({ clip: (entryRows) => inventoryClip(entryRows, budget), moreLabel: (n) => `+${String(n)} more` });
    const list = screen.getByTestId('chart-legend');
    // Eight rows: one for the line, six for the list — three passes whole, a seventh row too few for a fourth.
    // Two passes and both bodies are under it.
    expect(list).toHaveAttribute('data-clip-rows', '6');
    expect(list.style.getPropertyValue('--inventory-rows')).toBe('6');
    expect(screen.getByTestId('legend-more')).toHaveTextContent(/^\+4 more$/);
    // D-863: no header row over the times — each row names its own (FR-FLOW-13).
    expect(screen.queryByTestId('legend-times-header')).toBeNull();
    // and its rows keep rise and end, the zone once: the line does not wrap there.
    expect(within(list).getAllByRole('button')[0]?.querySelector('[class*="times"]')).toHaveTextContent(/^rise 09:48:24\s*·\s*end 09:49:02 UTC$/);
    // Every entry is still in the list — the clip is a height, and the list scrolls to them.
    expect(within(list).getAllByRole('listitem')).toHaveLength(rows.length + bodies.length);
  });

  it('draws no +n line when everything fits', () => {
    legend({ clip: (entryRows) => inventoryClip(entryRows, 21), moreLabel: (n) => `+${String(n)} more` });
    expect(screen.getByTestId('chart-legend')).toHaveAttribute('data-clip-rows', '12');
    expect(screen.queryByTestId('legend-more')).toBeNull();
  });
});

describe('<Legend>: rows you pick (FR-CTRL-15)', () => {
  it('FR-CTRL-15: a row is a frameless button, the pinned one aria-pressed, a press pins it', () => {
    const onActivate = vi.fn();
    render(
      <I18nProvider locale="en">
        <Legend rows={rows.slice(0, 2)} bodies={[]} timeZone={null} highlightedPassId="pass-1" onActivate={onActivate} onFocusRow={noop} />
      </I18nProvider>,
    );
    const [first, second] = within(screen.getByTestId('chart-legend')).getAllByRole('button');
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    if (!first) throw new Error('no row');
    fireEvent.click(first);
    expect(onActivate).toHaveBeenCalledWith('pass-0');
  });

  it('FR-CTRL-15: the pinned name keeps its colour — the stylesheet paints no name in the accent', () => {
    expect(readFileSync('src/ui/components/guide/skychart/Legend.module.css', 'utf8')).not.toMatch(/--accent/);
  });
});

describe('<Legend upOnly> (FR-NOW-2, D-1239)', () => {
  const up = (i: number, at: { azDeg: number; elDeg: number } | null): LegendRow => ({ ...row(i), state: 'live', at });
  const upLegend = (listed: LegendRow[], locale: 'en' | 'es' = 'en', lines: BodyLine[] = bodies) =>
    render(
      <I18nProvider locale={locale}>
        <Legend rows={listed} bodies={lines} timeZone={null} highlightedPassId={null} onActivate={noop} onFocusRow={noop} upOnly />
      </I18nProvider>,
    );
  const lineText = (el: Element): string[] => [...el.querySelectorAll('[class*="name"], [class*="point"], [class*="height"]')].map((cell) => cell.textContent);

  it('FR-NOW-2: with no satellite up, says so first, then the Moon and the Sun, in both languages', () => {
    const { unmount } = upLegend([up(0, { azDeg: 100, elDeg: -3 }), up(1, null)]);
    const list = screen.getByTestId('chart-legend');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['No satellite up', 'MoonSSW20° up', 'SunE11° below']);
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('legend-up-none')).toBe(items[0]);
    unmount();
    upLegend([], 'es');
    expect(within(screen.getByTestId('chart-legend')).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ningún satélite arriba', 'LunaSSW20° arriba', 'SolE11° abajo']);
  });

  it('FR-NOW-2: with one up, lists it as a row you pick with its point and height, the columns as wide as their widest entry', () => {
    upLegend([up(0, { azDeg: 45, elDeg: 30.2 }), up(1, { azDeg: 300, elDeg: -2 })]);
    const list = screen.getByTestId('chart-legend');
    expect(screen.queryByTestId('legend-up-none')).toBeNull();
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    const [only] = buttons;
    if (!only) throw new Error('no row');
    expect(only).toHaveAttribute('data-pass-id', 'pass-0');
    expect(only).toHaveAttribute('aria-pressed', 'false');
    expect(lineText(only)).toEqual(['SAT 0', 'NE', '30° up']);
    const bodiesListed = list.querySelectorAll('[data-body]');
    expect([...bodiesListed].map((item) => item.getAttribute('data-body'))).toEqual(['moon', 'sun']);
    // `SSW` and `11° below` are the widest entries.
    expect(list.style.getPropertyValue('--up-point')).toBe('3ch');
    expect(list.style.getPropertyValue('--up-height')).toBe('9ch');
  });
});
