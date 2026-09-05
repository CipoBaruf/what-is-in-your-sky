/**
 * R36: the v1 capture set (SPEC §9 Phase 2 — "Desktop and phone captures for
 * every screen in both languages and both themes"). `captureSet.ts` says what
 * the set is and `tests/docs/captures.test.ts` checks the directory against it;
 * this file is what fills it, off one build, in one naming scheme.
 *
 *   npx playwright test v1-captures --project=chromium
 *
 * Evidence for the release, not a test: every assertion here is only there so
 * a file cannot end up being a picture of a page that had not finished loading.
 *
 * **One capture per test, and never two on one page.** `page.clock.install`
 * may be called once per page and `addInitScript` accumulates, so a test that
 * shot two themes would be relying on the second seed running last. Sixty
 * tests each doing one load cost nothing extra — Playwright runs them across
 * its workers — and each one either produces its file or fails saying so.
 *
 * **The theme and the language are seeded, never clicked.** Both live in
 * `wiys:prefs:v1`, and `main.tsx` writes `lang` and `data-theme` from them
 * before the first render (D-70), so an init script gets the whole 2 × 2
 * without a toggle, without the localised names of the toggles, and without a
 * half-switched frame. The observer and the saved places are seeded the same
 * way where the screen needs them (the R28 precedent): the round trip through
 * the panel is another spec's job, and a capture run that waited for three
 * recomputes to photograph a list would be paying a minute for a picture.
 *
 * **Two places, because the screens want different skies.** The chart screens
 * are `live-captures.spec.ts`'s Paris moment — the one instant in the committed
 * fixtures where a pass is under way, the Moon is 60° up and the Sun is inside
 * FR-DOME-6's twilight band at once — and everything else is the Neuquén
 * fixture the rest of the suite runs on, nine days on from its capture, where
 * the list has three nights in it. One place would have cost one of the two,
 * and a flat picture of a rich screen is worth less than a tidy postcode.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CAPTURE_DIR, captureName, LOCALES, SCREENS, THEMES, VIEWPORTS, type CaptureLocale, type CaptureTheme, type CaptureWidth } from './captureSet';

interface HaFixture {
  observer: { lat: number; lon: number };
}
interface StoredObserver {
  lat: number;
  lon: number;
  altM: number;
  label: string;
  source: string;
  timeZone: string;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

/**
 * Both observers are at altitude 0, which is what typing a coordinate pair
 * gives (FR-LOC-4) and what the committed pass ids were computed at: a seeded
 * altitude would move every pass start by a second or two and the glare pass
 * would no longer be found by its id. Only Paris is observed from; Neuquén is
 * here to be the second row of the saved places.
 */
const PARIS: StoredObserver = { lat: 48.86, lon: 2.35, altM: 0, label: '48.86, 2.35', source: 'coords', timeZone: 'Europe/Paris' };
const NEUQUEN: StoredObserver = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: 'America/Argentina/Salta' };

/**
 * The pass the Moon stands 8° from (`live-captures.spec.ts`, R22), and the
 * night the whole set is shot on: 2026-09-02 over Paris, the elements seven
 * hours old.
 *
 * The rest of the suite runs at Neuquén nine days on from the fixture capture,
 * because that is where the golden ISS pass is. A release capture cannot: nine
 * days puts the newest epoch past FR-SAT-4's five-day mark and the staleness
 * warning across the top of every home screen, and no earlier clock over
 * Neuquén has an ISS pass to put in the hero card — the visible season there
 * starts on the 11th. Over Paris the same fixtures have an ISS pass fifty
 * minutes ahead at `CLOCK`, so one place and one night carry every screen: the
 * list with its hero, the pass open on both charts, and the live page at the
 * moment it is overhead.
 *
 * What it costs is the weather. The only forecast in the fixtures is over
 * Neuquén, so every cloud badge here reads "weather unknown" — which is the
 * FR-WX-1 fallback doing its job, and cheaper than a staleness banner on the
 * front page. `r27-*.png` is the capture set with a forecast in it.
 */
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
/** Three minutes into a six-minute pass: the marker near the peak, half the arc behind it (FR-DOME-5's two colours). */
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;

const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** The two screens whose point is everything on them, so the capture is the whole document and not the first 844 px of it. */
const FULL_PAGE = new Set(['location', 'home']);

interface SeedPrefs {
  locale: CaptureLocale;
  theme: CaptureTheme;
  observer?: StoredObserver;
  chartView?: 'dome' | 'polar';
  favourites?: { cellKey: string; observer: StoredObserver; addedAt: number; lastUsedAt: number }[];
}

/** The elements from the fixtures, and nothing else: no forecast over Paris, and no geocoder, since every observer here is a coordinate pair. */
async function stubNetwork(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
}

/** A page at `width` on the paused clock, with the preferences already in storage and the network stubbed. Called once per test. */
async function open(page: Page, width: CaptureWidth, prefs: SeedPrefs): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await stubNetwork(page);
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/**
 * The list, settled, asked in neither language: the ISS hero card is up, the
 * 72 h search has stopped (nothing is left `aria-busy`) and the passes are
 * grouped by night. Every wait here is on a `data-testid` or an ARIA state, so
 * the English and the Spanish run take the same path.
 */
async function listSettled(page: Page): Promise<void> {
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  expect(await page.getByTestId('night-group').count()).toBeGreaterThan(0);
  // The pointer is wherever the last action left it, and a cloud badge under it opens its tooltip over the capture.
  await page.mouse.move(0, 0);
}

/**
 * The live page's dome, drawn. React reveals a lazy chunk behind its Suspense
 * fallback on a timer, and the chart chunk, the raster font and the first
 * rasterisation wait on timers too — all of them held by the paused clock, so
 * it is ticked until each expectation holds rather than once before them
 * (`liveHelpers.ts` carries the same note and the CI run that proved it).
 */
async function domeDrawn(page: Page): Promise<void> {
  const livePage = page.getByTestId('live-page');
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return (await livePage.count()) === 0 ? null : livePage.getAttribute('data-state');
      },
      { timeout: 30_000 },
    )
    .toBe('live');
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return page.getByTestId('live-dome').locator('[data-layer="lines"] pre.glyph-output').isVisible();
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** The chart screens: the glare pass open on `view`, three minutes in. */
async function openChart(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, view: 'dome' | 'polar'): Promise<void> {
  await open(page, width, { locale, theme, observer: PARIS, chartView: view });
  await page.goto('/');

  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  // The wide layout keeps the list beside the guide, so the capture would otherwise carry
  // "Computing passes… 17 of 93" next to a finished chart. The search is let finish first.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  // The view came from the seeded preference (US-6 AC5), so there is no toggle to click and no frame drawn on the other one.
  await expect(figure).toHaveAttribute('data-view', view);
  // The chart chunk, the raster font and glyphcss's first rasterisation all wait on timers the paused clock is holding.
  await page.clock.runFor(1000);
  if (view === 'dome') await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });

  // …and then into the pass, arriving on the tick the sheet lives by rather than through three hundred of them.
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  await expect(figure.locator('[data-anchor="sun"]')).toHaveCount(1);
  await expect(figure.locator('[data-anchor="moon"]')).toHaveCount(1);
  if (view === 'polar') await expect(figure.locator('[data-marker="now"]')).toHaveCount(1);
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
}

type Reach = (page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale) => Promise<void>;

/** Every screen's route to itself, by the name it carries in `captureSet.ts`. */
const REACH: Record<string, Reach> = {
  async location(page, width, theme, locale) {
    await open(page, width, { locale, theme });
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  },

  async home(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: PARIS });
    await page.goto('/');
    await listSettled(page);
    // The nights are closed so the whole screen fits in one picture. Paris in September has
    // tens of visible passes a night, and the open default made the phone capture 20 000 px
    // tall — a file nobody can review. Closed, the capture carries every part of the home
    // screen at once (the location block, the saved places, the elements line, the Now panel,
    // the Moon, the hero card, the sort toggle, the three nights with their counts, the
    // footer), and the cards themselves are what `guide` and `polar` are for.
    await page.getByTestId('night-group').evaluateAll((nights) => {
      for (const night of nights) (night as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('[data-testid="night-group"][open]')).toHaveCount(0);
  },

  async guide(page, width, theme, locale) {
    await openChart(page, width, theme, locale, 'dome');
  },

  async polar(page, width, theme, locale) {
    await openChart(page, width, theme, locale, 'polar');
  },

  async favourites(page, width, theme, locale) {
    // Neuquén is saved but not in use, so the capture shows the "in use" mark on one row and not the other.
    const favourites = [
      { cellKey: '-38.93,-67.99', observer: NEUQUEN, addedAt: CLOCK - 2 * DAY_MS, lastUsedAt: CLOCK - 2 * DAY_MS },
      { cellKey: '48.86,2.35', observer: PARIS, addedAt: CLOCK - DAY_MS, lastUsedAt: CLOCK - 60_000 },
    ];
    await open(page, width, { locale, theme, observer: PARIS, favourites });
    await page.goto('/');
    await expect(page.getByTestId('favourite')).toHaveCount(2);
    await page.getByTestId('favourites').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
  },

  async shortcuts(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: PARIS });
    await page.goto('/');
    await listSettled(page);
    // FR-DESK-4: the keys are the page's only while nothing has the caret. Nothing here typed, so the body still has focus.
    await page.keyboard.press('?');
    const overlay = page.getByTestId('shortcuts-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('kbd')).toHaveCount(8);
    await expect(page.getByRole('main')).toHaveAttribute('inert', '');
  },

  async live(page, width, theme, locale) {
    await open(page, width, { locale, theme });
    // FR-LIVE-9's link: the place and the instant come out of the URL, so the page needs neither a saved location
    // nor the clock walked forward — it opens straight at the moment the ISS is overhead.
    await page.goto(`/#live?lat=${String(PARIS.lat)}&lon=${String(PARIS.lon)}&alt=0&t=${new Date(SHOWN).toISOString().replace('.000Z', 'Z')}`);
    await expect(page.getByTestId('live-place')).toHaveText(PARIS.label);
    await domeDrawn(page);
    // The strip settled: five fields, none of them still on its pending ellipsis.
    for (const field of ['time', 'sky', 'cloud', 'count', 'moon']) await expect(page.getByTestId(`live-${field}`)).not.toContainText('…', { timeout: 60_000 });
    await page.mouse.move(0, 0);
  },
};

for (const screen of SCREENS) {
  const reach = REACH[screen.name];
  if (!reach) throw new Error(`no route to the ${screen.name} screen`);
  for (const width of screen.widths) {
    for (const theme of THEMES) {
      for (const locale of LOCALES) {
        test(`${screen.name} at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
          await reach(page, width, theme, locale);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          await page.screenshot({ path: `${CAPTURE_DIR}/${captureName(screen.name, width, theme, locale)}`, fullPage: FULL_PAGE.has(screen.name) });
        });
      }
    }
  }
}
