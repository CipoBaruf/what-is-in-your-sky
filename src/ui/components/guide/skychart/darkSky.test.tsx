/**
 * R211, R214 (FR-DARK-1, FR-DARK-2; US-64 AC1): the dome, the polar chart, the
 * globe and the window with the Sun 40° up, on the app's own catalogue and scene source —
 * the deep surface, the faintest rung each one draws, and the Sun's dot.
 */
import { act, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTokens, TOKENS_PATH } from '../../../../../scripts/contrast';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { starCatalog } from '../../../../data/stars/catalog';
import { skyBodiesAt } from '../../../../lib/skyBodies';
import { RUNG_MAX_MAG } from '../../../../lib/starRungs';
import type { Observer } from '../../../../model';
import { starSource } from '../../live/starSource';
import { domeLayers } from './dome/domeLayers';
import { CHART_TOKENS, MEANINGS, readPalette } from './dome/palette';
import { SkyDome } from './dome/SkyDome';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { globeSky } from './globe/scene';
import { DOME_STAR_MAG, POLAR_STAR_MAG } from './layers';
import { SkyPolar } from './polar/SkyPolar';
import { createHandCamera } from './window/camera';
import { SkyWindow } from './window/SkyWindow';

const observer: Observer = { lat: -34.6, lon: -58.38, altM: 0, label: 'Buenos Aires', source: 'coords', timeZone: null };
/** The first minute of 2026-11-04's morning with the Sun at +40°. */
const NOON = ((): number => {
  let t = Date.parse('2026-11-04T10:00:00Z');
  while (skyBodiesAt(t, observer).sun.altDeg < 40) t += 60_000;
  return t;
})();
const PROBE = Array(20).fill('M').join('\n');
const pass = goldenPassFixture();
const catalog = starCatalog();
const { sun } = skyBodiesAt(NOON, observer);
const scene = starSource().sceneAt(observer, NOON);
const css = (file: string): string => readFileSync(`src/ui/components/guide/skychart/${file}`, 'utf8');

/** The faintest catalogue star above the horizon that a view capped at `cap` draws. */
const faintestUp = (cap: number): number =>
  Math.max(...Array.from(catalog.mag).filter((mag, i) => mag <= cap && (scene.stars?.positions.altDeg[i] ?? -90) >= 0));

describe('the sky at a Sun altitude of +40° (FR-DARK-1, FR-DARK-2)', () => {
  beforeEach(() => {
    expect(sun.altDeg).toBeCloseTo(40, 0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('the dome: the deep surface, its faintest star, and the Sun’s dot', () => {
    const tokens = readTokens(readFileSync(TOKENS_PATH, 'utf8'), 'dark');
    const probe = document.createElement('span');
    for (const meaning of MEANINGS) probe.style.setProperty(CHART_TOKENS[meaning], tokens.get(CHART_TOKENS[meaning].slice(2)) ?? '');
    const palette = readPalette(document.body.appendChild(probe));
    probe.remove();
    const layers = domeLayers({ passes: [pass], highlightedPassId: pass.id, palette, sun, camera: { rotYDeg: 0, tiltDeg: 45 }, measure: () => ({ halfWidth: 0.08, halfHeight: 0.03 }) });
    const colours = (id: string): (string | undefined)[] => [...new Set([...layers.base, ...layers.lines].find((mesh) => mesh.id === id)?.polygons.map((poly) => poly.color))];
    expect(layers.base.map((mesh) => mesh.id)).toEqual(['ground', 'bowl']);
    expect(colours('bowl')).toEqual([tokens.get('chart-sky-deep')]);
    expect(colours('sun')).toEqual([tokens.get('chart-sun')]);

    // glyphcss measures its cell from a `<pre>` of twenty `M`s, which jsdom does not lay out.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const base = this.closest('[data-layer="base"]') !== null;
      const [width, height] = this.tagName === 'PRE' && this.textContent === PROBE ? (base ? [13, 520] : [6.5, 260]) : this.classList.contains('glyph-output') ? [390, 390] : [0, 0];
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) };
    });
    const draw = (withSun: boolean): HTMLElement =>
      render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={scene} {...(withSun ? { sun } : {})} />).container;
    const lit = draw(true);

    const drawn = [...lit.querySelectorAll('[data-star]')].map((el) => catalog.mag[Number(el.getAttribute('data-star'))] ?? 99);
    expect(Math.max(...drawn)).toBe(faintestUp(DOME_STAR_MAG));

    const lines = (container: HTMLElement): string | null | undefined => container.querySelector('[data-layer="lines"] pre.glyph-output')?.textContent;
    expect(lines(lit)).not.toBe(lines(draw(false)));
  });

  it('the polar chart: the deep surface, the faintest rung, and the Sun’s dot', async () => {
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={scene} sun={sun} />);
    await act(async () => {
      await import('./polar/PolarStars');
    });
    expect(container.querySelector('[data-sky-surface]')).not.toBeNull();
    expect(css('polar/SkyPolar.module.css')).toMatch(/\.surface \{[^}]*fill: var\(--chart-sky-deep\);/);

    const dots = [...container.querySelectorAll('[data-dots]')].flatMap((path) => (path.getAttribute('data-stars') ?? '').split(' '));
    const faintest = Math.max(...dots.map((i) => catalog.mag[Number(i)] ?? 99));
    // Past the fourth rung's bound: the last rung is drawn, to the chart's own cap.
    expect(faintest).toBeGreaterThan(RUNG_MAX_MAG.at(-2) ?? 99);
    expect(faintest).toBeLessThanOrEqual(POLAR_STAR_MAG);

    expect(container.querySelector('[data-body="sun"] circle[data-marker="sun"]')).not.toBeNull();
  });

  it('the globe: the deep surface, the faintest rung at full strength, and the Sun’s dot', () => {
    const sky = globeSky(observer, NOON);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Over the place with the stars' turn off, the zenith faces the reader, and so does a Sun 40° up.
    const globe = new GlobeRenderer(svg, catalog, { place: observer, t: NOON, turn: 'you', lon: 0, lat: 90, zoom: 1, layers: { stars: true, figures: true, planets: true, names: false }, faint: false, lang: 'en', width: 800, height: 600, named: null });
    globe.draw();
    expect(css('globe/SkyGlobe.module.css')).toMatch(/\.disc \{[^}]*fill: var\(--chart-sky-deep\);/);
    expect(svg.querySelector('[data-disc]')).not.toHaveAttribute('data-tint');

    const drawn = globe.hits.slice(0, catalog.size).flatMap((hit, i) => (hit ? [catalog.mag[i] ?? 99] : []));
    expect(Math.max(...drawn)).toBeGreaterThan(RUNG_MAX_MAG.at(-2) ?? 99);
    for (const group of ['[data-figure-lines]', '[data-dots]', '[data-stars]']) expect(svg.querySelector(group), group).not.toHaveAttribute('opacity');

    expect(sky.sun.altDeg).toBeCloseTo(40, 0);
    expect(svg.querySelector('[data-body="sun"]')).toHaveAttribute('visibility', 'visible');
    globe.dispose();
  });

  it('the window: the deep surface, the deep stars past the last rung, and the Sun’s dot', async () => {
    // At the Sun, zoomed to the narrowest field, where FR-LOOK-9's row reaches into the deep catalogue.
    const camera = createHandCamera({ azDeg: sun.azDeg, altDeg: sun.altDeg, fovDeg: 20 });
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={camera} scene={scene} sun={sun} />);
    expect(container.querySelector('[data-sky-surface]')).not.toHaveAttribute('data-tint');
    expect(css('window/SkyWindow.module.css')).toMatch(/\.surface \{[^}]*fill: var\(--chart-sky-deep\);/);

    expect(container.querySelector('[data-marks] > [data-star]:not([visibility="hidden"])')).not.toBeNull();
    await waitFor(
      () => {
        expect(container.querySelector('[data-deep-pool] > circle:not([visibility="hidden"])')).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const dot = container.querySelector('[data-body="sun"]');
    expect(dot).toHaveAttribute('data-in-view', 'true');
    expect(dot?.querySelector('circle[data-marker="sun"]')).not.toBeNull();
  });

  it('FR-DARK-2: the window draws no dot for a Sun that is down', () => {
    const { container } = render(<SkyWindow passes={[pass]} observer={observer} highlightedPassId={pass.id} camera={createHandCamera({ azDeg: sun.azDeg, altDeg: 5 })} sun={{ ...sun, altDeg: -1 }} />);
    expect(container.querySelector('[data-body="sun"]')).toBeNull();
  });
});
