/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10; US-15 AC1, AC2,
 * AC9) on the production build, with the R1 fixtures at Neuquén and the clock
 * installed ten seconds into the golden ISS pass — the instant `now-panel.spec`
 * pins the Now panel at, so the two counts can be held to each other.
 *
 *   - `#live` fills the viewport with the dome and nothing scrolls; the strip
 *     shows its five fields; the count is the Now panel's; Esc, the return
 *     control, the header and the Now panel each go one way or the other;
 *   - a `#live?…` URL in a fresh context sets the observer (rounded label,
 *     source coords) and the shown instant; a `t` that cannot be read falls
 *     back to real time;
 *   - both inert states are one line and the return control;
 *   - the captures the PR carries, at both widths, in both themes, and in
 *     Spanish at the phone width.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number }; peak: { t: number }; end: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);
/**
 * The strip's time field for real time at `t`, to the ten-second tick the page reads the clock at
 * (FR-VIS-5): whether the page mounted before or after the second `domeDrawn` lets run is not the point.
 */
const realTimeField = (t: number): RegExp => new RegExp(`^Time ${new Date(t).toISOString().slice(0, 10)} ${hhmmss(t).slice(0, 7)}\\d UTC$`);

const golden = (): { start: number; peak: number; end: number } => {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  return { start: pass.start.t, peak: pass.peak.t, end: pass.end.t };
};
/** Ten seconds into the golden pass: the ISS is the one satellite up (now-panel.spec.ts). */
const T = golden().start + 10_000;

const LABEL = {
  en: { coords: 'Coordinates (lat, lon)', now: 'Right now', visible: /(\d+) satellites? visible right now/, live: 'Live sky', fromNow: 'Watch the sky live', back: '← Back', theme: 'Theme', night: 'Night', dark: 'Dark' },
  es: { coords: 'Coordenadas (lat, lon)', now: 'Ahora mismo', visible: /(\d+) satélites? visibles? ahora mismo/, live: 'Cielo en vivo', fromNow: 'Ver el cielo en vivo', back: '← Volver', theme: 'Tema', night: 'Nocturno', dark: 'Oscuro' },
} as const;

async function stubNetwork(page: Page, elements: 'fixtures' | 'down' = 'fixtures'): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    if (elements === 'down') {
      await route.abort('failed');
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // No forecast: the zone stays unknown, the clocks read UTC and the clouds are unknown (weather.spec.ts covers the forecast).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
}

/**
 * The app at `t` with the fixtures, Neuquén typed in, and the Now panel's verdict for that instant.
 * `wholeList` waits for the 72 h search to finish first, so a capture shows every arc of the coming night
 * rather than the first few to stream in.
 */
async function homeAt(page: Page, t: number, locale: 'en' | 'es' = 'en', wholeList = false): Promise<number> {
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await stubNetwork(page);
  await page.goto('/');
  if (locale === 'es') await page.getByRole('banner').getByRole('button', { name: 'Español' }).click();
  await page.getByLabel(LABEL[locale].coords).fill(NEUQUEN);
  const panel = page.getByRole('region', { name: LABEL[locale].now });
  await expect(panel.getByRole('status')).toHaveText(LABEL[locale].visible, { timeout: 60_000 });
  if (wholeList) {
    const passes = page.getByRole('region', { name: locale === 'es' ? 'Próximos pases' : 'Upcoming passes' });
    await expect(passes.getByRole('status')).toHaveText(/\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/, { timeout: 60_000 });
  }
  const match = LABEL[locale].visible.exec((await panel.getByRole('status').textContent()) ?? '');
  return Number(match?.[1] ?? '0');
}

/**
 * The live page with its dome drawn. React reveals a lazy chunk behind its
 * Suspense fallback on a timer (its 300 ms fallback throttle), and the chart
 * chunk, the raster font and the first rasterisation wait on timers too — all
 * of them held by the installed clock. A single `runFor` before the expectation
 * is a race: when the chunk lands after it, the reveal timer is set on a clock
 * nobody advances again and the page stays on its fallback (main CI, run
 * 33943966372). So the clock is ticked until each expectation holds, in steps
 * small enough to keep the shown instant inside the ten-second bucket the
 * strip assertions read (`realTimeField`).
 */
async function domeDrawn(page: Page): Promise<void> {
  // `getAttribute` would wait for the element and hold the poll on its first tick; `count` does not.
  const livePage = page.getByTestId('live-page');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return (await livePage.count()) === 0 ? null : livePage.getAttribute('data-state');
    }, { timeout: 30_000 })
    .toBe('live');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId('live-dome').locator('[data-layer="lines"] pre.glyph-output').isVisible();
    }, { timeout: 30_000 })
    .toBe(true);
}

/** The five fields, each with a value that is not the pending ellipsis. */
async function stripFilled(page: Page): Promise<void> {
  for (const field of ['time', 'sky', 'cloud', 'count', 'moon']) {
    await expect(page.getByTestId(`live-${field}`)).toBeVisible();
    await expect(page.getByTestId(`live-${field}`)).not.toContainText('…', { timeout: 30_000 });
  }
}

test.describe('the live page', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fills the viewport with the dome, shows the five fields, and counts what the Now panel counts', async ({ page }) => {
    const panelCount = await homeAt(page, T);
    expect(panelCount).toBe(1);

    await page.getByTestId('live-link').click();
    await expect(page).toHaveURL(/#live$/);
    await domeDrawn(page);

    // FR-LIVE-1: the page is the viewport — as tall as it, and nothing to scroll.
    const box = await page.getByTestId('live-page').boundingBox();
    expect(box?.height).toBe(844);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.getByRole('banner')).toHaveCount(0);
    // The dome is the whole width inside the two cells of side padding, and most of the height.
    const dome = await page.getByTestId('live-dome').boundingBox();
    expect(dome?.width).toBeGreaterThan(390 - 4 * 9.6 - 1);
    expect(dome?.height).toBeGreaterThan(400);

    // FR-LIVE-3: the five fields.
    await stripFilled(page);
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
    await expect(page.getByTestId('live-sky')).toHaveText(/Sky (dark|bright twilight|day)/);
    await expect(page.getByTestId('live-cloud')).toHaveText('Clouds Weather unknown');
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', String(panelCount));
    await expect(page.getByTestId('live-moon')).toHaveText(/Moon (new|waxing crescent|first quarter|waxing gibbous|full|waning gibbous|last quarter|waning crescent), \d+ % lit/);
    // FR-LIVE-2 / FR-LIVE-10: the ISS is drawn on the chart, by the chart, named at its rise. (The search
    // window starts at now, so the pass under way is listed from this instant and its id is not the golden one.)
    await expect(page.getByTestId('live-dome').locator('[data-pass-id]').first()).toBeAttached();
    await expect(page.getByTestId('live-dome').locator('[data-pass-id^="25544-"]')).toHaveCount(1);
    // FR-SHARE-1's live form.
    await expect(page.getByRole('button', { name: 'Share this sky' })).toBeVisible();

    // Esc returns to the home page, with the same observer and no hash.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('live-page')).toHaveCount(0);

    // …and the Now panel's link opens it again; the return control closes it.
    await page.getByTestId('now-live-link').click();
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('region', { name: LABEL.en.now })).toBeVisible();
  });

  test('a #live?… URL sets the observer and the shown instant, and a bad t falls back to real time (FR-LIVE-9)', async ({ page }) => {
    const { peak } = golden();
    await page.clock.install({ time: T });
    await page.clock.pauseAt(T);
    await stubNetwork(page);
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=${new Date(peak).toISOString().replace('.000Z', 'Z')}`);

    // The observer came out of the link: rounded label, no saved location involved (a fresh context has none).
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await domeDrawn(page);
    // The shown instant is the link's, not the clock's.
    await expect(page.getByTestId('live-time')).toHaveText(`Time ${new Date(peak).toISOString().slice(0, 10)} ${hhmmss(peak)} UTC`);
    // At the peak the ISS is up: one marker, once the passes are in.
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', '1', { timeout: 60_000 });
    await stripFilled(page);
    // Real time was not touched by the link.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: LABEL.en.now })).toContainText(`as of ${hhmmss(T)} UTC`, { timeout: 60_000 });
    await expect(page.getByTestId('active-location')).toContainText('−38.93, −67.99');

    // A t that names no instant: the place is kept and the instant is real time. (A hash-only
    // navigation stays in the document; the reload is what makes it a fresh arrival on the link.)
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=soon`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    // Real time: the installed clock, not the link.
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
  });

  test('is inert with one line and the return control without an observer, and without elements (FR-LIVE-1)', async ({ page }) => {
    await page.clock.setFixedTime(T);
    await stubNetwork(page, 'down');
    await page.goto('/#live');
    const inert = page.getByTestId('live-inert');
    await expect(inert).toHaveText('The live sky needs somewhere to look from: a place name or coordinates on the home page.');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'inert');
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await expect(page.getByTestId('status-strip')).toHaveCount(0);
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('banner')).toBeVisible();

    // An observer from a link, and CelesTrak down with nothing cached: no elements, so nothing to draw.
    // A hash-only navigation stays in the document, so the page is reloaded for `startApp` to read the link.
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await expect(inert).toHaveText('No orbital elements yet, so there is nothing to draw.', { timeout: 30_000 });
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
  });
});

/**
 * The captures for the PR: the live page at both widths, in both themes, in
 * English, and in Spanish at the phone width — the ISS up and marked, the
 * coming night's arcs in their series colours, the strip under the dome.
 */
for (const width of [390, 1280] as const) {
  test(`captures at ${String(width)} px, in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-dark-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.night }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-night-en.png` });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.dark }).click();
  });
}

test('captures in Spanish at 390 px: no English on the page (FR-I18N-2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T, 'es', true);
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('live-link')).toHaveCount(0);
  await domeDrawn(page);
  await stripFilled(page);
  await expect(page.getByRole('button', { name: LABEL.es.back })).toBeVisible();
  await expect(page.getByTestId('status-strip')).toHaveAttribute('aria-label', 'Estado del cielo');
  await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo claro|de día)/);
  await expect(page.getByTestId('live-cloud')).toHaveText('Nubes Clima desconocido');
  await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/r32-live-390-dark-es.png' });
});
