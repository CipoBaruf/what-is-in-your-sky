/**
 * R85 (F-81, FR-CAP-5, D-549): the legend as the short wide window's inventory. Each row's three times are
 * named in its accessible name wherever the legend is drawn; given an inventory, the list is clipped to what
 * `inventoryClip` says fits whole, the header row names the times, and `+n` counts the entries under the clip.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('<Legend> as the short wide inventory (F-81)', () => {
  it('names the three times in each row’s accessible name, in both languages, without an inventory too', () => {
    // jsdom lays nothing out, so the name's pieces meet without the spaces a browser puts between the row's boxes.
    const { unmount } = legend(null);
    expect(screen.getByRole('button', { name: /^A\s*SAT 0\s*rise\s*09:48:24 UTC\s*peak\s*09:48:38 UTC\s*end\s*09:49:02 UTC\s*soon$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('legend-inventory')).toBeNull();
    expect(screen.queryByTestId('legend-more')).toBeNull();
    unmount();
    legend(null, 'es');
    expect(screen.getByRole('button', { name: /^A\s*SAT 0\s*sale\s*09:48:24 UTC\s*culmina\s*09:48:38 UTC\s*termina\s*09:49:02 UTC\s*pronto$/ })).toBeInTheDocument();
  });

  it('clips the list to whole entries and counts the rest in the +n line', () => {
    const budget = 8;
    legend({ clip: (entryRows, headerRows) => inventoryClip(entryRows, budget - headerRows), moreLabel: (n) => `+${String(n)} more` });
    const list = screen.getByTestId('chart-legend');
    // Eight rows: one for the header, one for the line, six for the list — three passes whole. Two passes and both bodies are under it.
    expect(list).toHaveAttribute('data-clip-rows', '6');
    expect(list.style.getPropertyValue('--inventory-rows')).toBe('6');
    expect(screen.getByTestId('legend-more')).toHaveTextContent(/^\+4 more$/);
    // The header row is drawn, not read: the names carry the words already.
    const header = screen.getByTestId('legend-times-header');
    expect(header).toHaveAttribute('aria-hidden', 'true');
    expect([...header.children].map((cell) => cell.textContent)).toEqual(['rise', 'peak', 'end']);
    expect([...header.children].map((cell) => (cell as HTMLElement).style.minWidth)).toEqual(['12ch', '12ch', '12ch']);
    // Every entry is still in the list — the clip is a height, and the list scrolls to them.
    expect(within(list).getAllByRole('listitem')).toHaveLength(rows.length + bodies.length);
  });

  it('draws no +n line when everything fits', () => {
    legend({ clip: (entryRows, headerRows) => inventoryClip(entryRows, 21 - headerRows), moreLabel: (n) => `+${String(n)} more` });
    expect(screen.getByTestId('chart-legend')).toHaveAttribute('data-clip-rows', '12');
    expect(screen.queryByTestId('legend-more')).toBeNull();
  });

  it('keeps the header’s row for the list when no listed row has times', () => {
    // Hidden objects (`lib/legend.ts`) are listed after the passes with no times, and alone they draw no header.
    const hidden = [0, 1, 2, 3, 4].map((i) => ({ ...row(i), riseMs: null, peakMs: null, endMs: null }));
    const budget = 9;
    legend({ clip: (entryRows, headerRows) => inventoryClip(entryRows, budget - headerRows), moreLabel: (n) => `+${String(n)} more` }, 'en', hidden);
    expect(screen.queryByTestId('legend-times-header')).toBeNull();
    // All nine rows are the list's: four markers whole, one for the `+n` line. Reserving the header's row too
    // would have ended the list a marker earlier, at six rows and `+4 more`.
    expect(screen.getByTestId('chart-legend')).toHaveAttribute('data-clip-rows', '8');
    expect(screen.getByTestId('legend-more')).toHaveTextContent(/^\+3 more$/);
  });
});
