import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, SPEEDS } from '../lib/playback';
import { GLOBE_ZOOM_MAX, GLOBE_ZOOM_MIN } from '../ui/components/guide/skychart/globe/constants';
import { WINDOW_FOV, WINDOW_FOV_MAX_DEG, WINDOW_FOV_MIN_DEG } from '../ui/components/guide/skychart/window/projection';
import {
  CHART_VIEWS,
  DEFAULT_CHART_VIEW,
  DEFAULT_FAINT_STARS,
  DEFAULT_GLOBE_TURN,
  DEFAULT_GLOBE_ZOOM,
  DEFAULT_NAMES,
  DEFAULT_PLAY_SPEED,
  DEFAULT_PRIVACY_NOTE_CLOSED,
  DEFAULT_STAR_LAYERS,
  DEFAULT_STARS_LAYER,
  DEFAULT_SUN_GLOW,
  DEFAULT_THEME,
  DEFAULT_WINDOW_FOV_DEG,
  GLOBE_ZOOM_RANGE,
  OPENING_SPEED,
  PLAY_SPEEDS,
  WINDOW_FOV_RANGE_DEG,
} from './prefs';

/** FR-KEEP-3 (D-1096): the first visit's defaults, row by row, phone and desk. */
describe('FR-KEEP-3: the first visit defaults', () => {
  it('FR-KEEP-3: view — the window on a phone, the globe on a desk', () => {
    expect(DEFAULT_CHART_VIEW).toEqual({ compact: 'window', wide: 'globe' });
    expect(CHART_VIEWS).toEqual(['dome', 'polar', 'window', 'globe']);
  });

  it('FR-KEEP-3: stars under the arcs, and the stars, figures and planets, on at both widths', () => {
    expect(DEFAULT_STARS_LAYER).toBe(true);
    expect(DEFAULT_STAR_LAYERS).toEqual({ stars: true, figures: true, planets: true });
  });

  it('FR-KEEP-3: names — on in the window and off in the polar chart on a phone, on on a desk (R160)', () => {
    expect(DEFAULT_NAMES).toEqual({ compact: { window: true, polar: false }, wide: true });
  });

  it('FR-KEEP-3: faint stars off; the globe turns with you', () => {
    expect(DEFAULT_FAINT_STARS).toBe(false);
    expect(DEFAULT_GLOBE_TURN).toBe('you');
  });

  it('FR-KEEP-3: zoom — the globe at 1× and the window at WINDOW_FOV', () => {
    expect(DEFAULT_GLOBE_ZOOM).toBe(1);
    expect(DEFAULT_WINDOW_FOV_DEG).toBe(WINDOW_FOV);
  });

  it('FR-KEEP-3: speed ×1 at every open; `play` starts at 2.13 rate until one is saved (D-1110)', () => {
    expect(OPENING_SPEED).toBe(1);
    expect(DEFAULT_PLAY_SPEED).toBe(DEFAULT_SPEED);
  });

  it('FR-KEEP-3: sun glow off, theme dark; FR-KEEP-4: the privacy note shown', () => {
    expect(DEFAULT_SUN_GLOW).toBe(false);
    expect(DEFAULT_THEME).toBe('dark');
    expect(DEFAULT_PRIVACY_NOTE_CLOSED).toBe(false);
  });

  it("D-1096: the ranges and the speeds restated here equal the chart's and the playback's", () => {
    expect(GLOBE_ZOOM_RANGE).toEqual([GLOBE_ZOOM_MIN, GLOBE_ZOOM_MAX]);
    expect(WINDOW_FOV_RANGE_DEG).toEqual([WINDOW_FOV_MIN_DEG, WINDOW_FOV_MAX_DEG]);
    expect(PLAY_SPEEDS).toEqual(SPEEDS);
  });
});
