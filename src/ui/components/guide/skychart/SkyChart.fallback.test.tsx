/**
 * D-789 (R121 review): while the window's chunk loads, the fallback frame is
 * already the window's — `handWindow` set where the window will be laid out in
 * the page's box — so the wide box is cut to the window's shape from the first
 * frame and does not jump from the dome's aspect when the chunk lands. The
 * chunk is held here (a module that never arrives), so the fallback is all
 * there is to read.
 */
import { render, screen as rtl } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { stubMatchMedia, WIDE_PX } from '../../../../../tests/support/matchMedia';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { SkyChart } from './SkyChart';

vi.mock('./window/SkyWindow', () => new Promise(() => undefined));

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

afterEach(() => {
  appStore.setState(initial, true);
  window.localStorage.clear();
});

describe('the window’s fallback frame (FR-SKY-2, D-789)', () => {
  it('is the window’s box while the chunk loads on wide', () => {
    const media = stubMatchMedia(WIDE_PX);
    try {
      appStore.getState().setChartView('window');
      render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      expect(rtl.getByTestId('window-loading')).toBeInTheDocument();
      const frame = rtl.getByTestId('chart-frame');
      expect(frame).toHaveAttribute('data-hand-window', 'true');
      expect(frame.style.getPropertyValue('--chart-box-aspect')).toBe((1024 / 768).toFixed(4));
    } finally {
      media.restore();
    }
  });
});
