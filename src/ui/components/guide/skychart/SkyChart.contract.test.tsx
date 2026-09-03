/**
 * PLAN §8.1, §9.1 "Sky chart contract" (R13): every registered view,
 * mounted through `SkyChart` with the same `SkyChartProps` fixture, exposes
 * the same caption (the FR-GUIDE-1 sentence), the same labelled anchors (N,
 * E, S, W, the pass name, the peak), fires `onSelectPass` with the pass id,
 * hides its drawing from assistive technology (FR-GUIDE-7) and draws no
 * canvas (FR-GUIDE-5). R15 adds the dome to `SKY_CHART_VIEWS` and this
 * file covers it unchanged.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../../../tests/support/fixtures';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { SKY_CHART_VIEWS, SkyChart } from './SkyChart';
import type { SkyChartProps } from './SkyChart.types';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { asComputed: string };
const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

const ANCHORS = ['N', 'E', 'S', 'W'];

describe.each(SKY_CHART_VIEWS)('<SkyChart> contract: $id view', (view) => {
  beforeEach(() => {
    appStore.getState().setChartView(view.id);
  });
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  const props = (extra: Partial<SkyChartProps> = {}): SkyChartProps => ({ passes: [pass], observer, highlightedPassId: pass.id, ...extra });

  it('mounts the chosen view in a figure whose caption is the guide sentence', () => {
    render(<SkyChart {...props()} />);
    const figure = screen.getByRole('figure');
    expect(figure).toHaveAttribute('data-view', view.id);
    expect(within(figure).getByTestId('guide-sentence').textContent).toBe(golden.asComputed);
    expect(figure.querySelector('figcaption')).toContainElement(within(figure).getByTestId('guide-sentence'));
  });

  it('labels N, E, S, W, the pass and its peak; the drawing is aria-hidden and is not a canvas', async () => {
    const { container } = render(<SkyChart {...props()} />);
    const drawing = container.querySelector('[data-drawing]');
    expect(drawing).not.toBeNull();
    expect(drawing).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('canvas')).toBeNull();
    for (const label of ANCHORS) {
      const anchor = container.querySelector(`[data-anchor="${label}"]`);
      expect(anchor, label).not.toBeNull();
      expect(anchor?.textContent).toBe(label);
    }
    const name = container.querySelector('[data-anchor="pass"]');
    expect(name?.textContent).toContain(pass.name);
    expect(name?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', pass.id);
    expect(container.querySelector('[data-anchor="peak"]')?.textContent).toBe('max 10°');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports the pass id through onSelectPass', () => {
    const onSelectPass = vi.fn();
    const { container } = render(<SkyChart {...props({ onSelectPass })} />);
    const arc = container.querySelector(`[data-pass-id="${pass.id}"]`);
    if (!arc) throw new Error('no pass element');
    fireEvent.click(arc);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
  });

  it('captions the highlighted pass among several, and says so when there is none to draw', () => {
    const other = { ...pass, id: 'other', name: 'Tiangong', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
    const { rerender } = render(<SkyChart {...props({ passes: [other, pass] })} />);
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.asComputed);
    rerender(<SkyChart {...props({ passes: [] , highlightedPassId: null })} />);
    expect(screen.getByRole('figure')).toHaveTextContent('No pass to draw.');
  });
});

describe('<SkyChart> view choice (US-6 AC5)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('falls back to the first registered view for a preference no view claims, and shows the view toggle only with more than one view', () => {
    appStore.getState().setChartView('dome');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const registered = SKY_CHART_VIEWS.map((view) => view.id);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', registered.includes('dome') ? 'dome' : registered[0]);
    if (SKY_CHART_VIEWS.length > 1) expect(screen.getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
    else expect(screen.queryByRole('group', { name: 'Chart view' })).toBeNull();
  });
});
