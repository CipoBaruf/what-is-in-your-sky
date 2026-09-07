/**
 * The live page's e2e fixtures and steps, shared by `live.spec.ts` (R32) and
 * `live-playback.spec.ts` (R33): the R1 fixtures at Neuquén, the clock
 * installed ten seconds into the golden ISS pass — the instant `now-panel.spec`
 * pins the Now panel at — the network stubs, the home page with the place
 * typed in, and the live page with its dome drawn.
 */
import { readFileSync } from 'node:fs';
import { WIDE_QUERY } from '../../src/lib/layout';
import { expect, type Page } from '@playwright/test';
import { FIXTURE_DATE, NEUQUEN as NEUQUEN_OBSERVER, NINE_DAYS_ON, STORED_RUN_FILE } from './observers';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number }; peak: { t: number }; end: { t: number } } | null;
}

export { FIXTURE_DATE, NINE_DAYS_ON };
export const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
export const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
export const hhmmss = (t: number): string => new Date(t).toISOString().slice(11, 19);
/**
 * The strip's time field for real time at `t`, to the ten-second tick the page reads the clock at
 * (FR-VIS-5): whether the page mounted before or after the second `domeDrawn` lets run is not the point.
 */
export const realTimeField = (t: number): RegExp => new RegExp(`^Time (${new Date(t).toISOString().slice(0, 10)} )?${hhmmss(t).slice(0, 7)}\\d UTC$`);

export const golden = (): { start: number; peak: number; end: number } => {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  return { start: pass.start.t, peak: pass.peak.t, end: pass.end.t };
};
/** Ten seconds into the golden pass: the ISS is the one satellite up (now-panel.spec.ts). */
export const T = golden().start + 10_000;

export const LABEL = {
  en: { coords: 'Coordinates (lat, lon)', now: 'Right now', visible: /(\d+) satellites? visible right now/, live: 'Live sky', fromNow: 'Watch the sky live', back: '← Back', theme: 'Theme', night: 'Night', dark: 'Dark', passes: 'Upcoming passes' },
  es: { coords: 'Coordenadas (lat, lon)', now: 'Ahora mismo', visible: /(\d+) satélites? visibles? ahora mismo/, live: 'Cielo en vivo', fromNow: 'Ver el cielo en vivo', back: '← Volver', theme: 'Tema', night: 'Nocturno', dark: 'Oscuro', passes: 'Próximos pases' },
} as const;

/** The pass list's status line once the window has been searched, in either language. */
export const PASS_COUNT = /\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/;

export async function stubNetwork(page: Page, elements: 'fixtures' | 'down' = 'fixtures'): Promise<void> {
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
  // No geocoder either: a spec that types a place name must not reach the real one (place-search.spec.ts fulfils its own).
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
}

/**
 * R52 (FR-COMP-2): runs `body` where the language switch, the theme switch and
 * the location form are, and comes back.
 *
 * On compact they are on `#settings`, one tap from the home screen; on wide
 * they are still on the home screen itself (US-20 AC5). Which of the two this
 * viewport is showing is read off the page — the `[ settings ]` control exists
 * only on the compact header — so a spec that only wants "the app in Neuquén,
 * in Spanish" says nothing about where the form lives.
 */
export async function withSettings(page: Page, body: () => Promise<void>): Promise<void> {
  const compact = await openSettings(page);
  await body();
  if (compact) await leaveSettings(page);
}

/**
 * Opens the settings page if this viewport has one, and says whether it did —
 * for a spec whose subject *is* the form, which stays on it across several
 * steps rather than making the trip for each.
 */
export async function openSettings(page: Page): Promise<boolean> {
  // The app's own media query, asked of the browser, rather than "is the
  // `[ settings ]` link in the DOM yet": after a `setViewportSize` the query
  // answers immediately and React has not necessarily re-rendered the header,
  // so probing the DOM reads the layout the page is leaving rather than the one
  // it is in.
  const compact = !(await page.evaluate((query: string) => window.matchMedia(query).matches, WIDE_QUERY));
  if (!compact) return false;
  const link = page.getByTestId('settings-link');
  await link.click();
  await expect(page.getByTestId('settings-back')).toBeVisible();
  return true;
}

/** Back to the home screen, through the page's own control. */
export async function leaveSettings(page: Page): Promise<void> {
  await page.getByTestId('settings-back').click();
  await expect(page.getByTestId('settings-back')).toHaveCount(0);
}

/**
 * The app at `t` with the fixtures, Neuquén typed in, and the Now panel's verdict for that instant.
 * `wholeList` waits for the 72 h search to finish first, so a capture shows every arc of the coming night
 * rather than the first few to stream in.
 */
export async function homeAt(page: Page, t: number, locale: 'en' | 'es' = 'en', wholeList = false): Promise<number> {
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await stubNetwork(page);
  await page.goto('/');
  await withSettings(page, async () => {
    if (locale === 'es') await page.getByRole('button', { name: 'Español' }).click();
    await page.getByLabel(LABEL[locale].coords).fill(NEUQUEN);
  });
  const panel = page.getByRole('region', { name: LABEL[locale].now });
  await expect(panel.getByRole('status')).toHaveText(LABEL[locale].visible, { timeout: 60_000 });
  if (wholeList) {
    const passes = page.getByRole('region', { name: LABEL[locale].passes });
    await expect(passes.getByRole('status')).toHaveText(PASS_COUNT, { timeout: 60_000 });
  }
  const match = LABEL[locale].visible.exec((await panel.getByRole('status').textContent()) ?? '');
  return Number(match?.[1] ?? '0');
}

/**
 * FR-CI-3 (R37): the home screen with a finished 72 h run already on it.
 *
 * A spec whose subject is the rendered page — the palette, the language, the
 * desktop layout, the shortcut overlay — used to type a coordinate pair and
 * then wait out the whole search, thirty objects over three nights, before it
 * could look at a heading. The app does not make a returning reader wait for
 * that either: FR-OFF-2 puts the stored run on screen before the first request
 * goes out. So the spec starts where the reader starts.
 *
 * The run is `tests/fixtures/stored-run-neuquen.json`, computed by
 * `scripts/build-stored-run.ts` from the committed elements at exactly
 * `NINE_DAYS_ON` — the instant these specs run at. The recompute that follows
 * therefore finds the same passes, and the list does not change under the test
 * when it lands.
 *
 * Three loads' worth of ordering, in one function: the page is opened once
 * with nothing saved (no observer, so nothing is searched and nothing is
 * fetched), the run is written into IndexedDB from inside the page and
 * *awaited* — an `addInitScript` would race the app's own read of the same
 * store — and the reload then boots the app the way a returning reader's
 * browser does.
 */
const STORED_RUN = JSON.parse(readFileSync(STORED_RUN_FILE, 'utf8')) as { cellKey: string; computedAt: number; passes: unknown[] };
const PREFS_KEY = 'wiys:prefs:v1';

export async function seedStoredRun(page: Page, { locale = 'en', prefs = {}, settled = false }: { locale?: 'en' | 'es'; prefs?: Record<string, unknown>; settled?: boolean } = {}): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.goto('/');
  await page.evaluate(async (run: unknown) => {
    await new Promise<void>((resolve, reject) => {
      // Version 2 and both stores, which is what `data/db.ts` opens: whichever of the two
      // connections is first must not leave the other one an upgrade to run.
      const request = indexedDB.open('wiys', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('elementGroups')) db.createObjectStore('elementGroups', { keyPath: 'group' });
        if (!db.objectStoreNames.contains('passRuns')) db.createObjectStore('passRuns', { keyPath: 'cellKey' });
      };
      request.onerror = () => {
        reject(new Error('could not open the wiys database'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('passRuns', 'readwrite');
        tx.objectStore('passRuns').put(run);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          reject(new Error('could not store the run'));
        };
      };
    });
  }, STORED_RUN);
  // Only when nothing is saved yet: an init script runs on every navigation, and a seed that
  // overwrote the key each time would undo the preferences a test then sets and reloads to check.
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN_OBSERVER, ...prefs })] as [string, string],
  );
  await page.reload();
  // The stored list, on screen without a search: the count is what a spec that follows builds on,
  // and a seed that silently failed fails here rather than three assertions later.
  await expect(page.getByRole('region', { name: LABEL[locale].passes }).getByRole('status')).toHaveText(PASS_COUNT, { timeout: 30_000 });
  if (settled) await listSettled(page);
}

/**
 * The recompute finished: nothing on the page is `aria-busy` any more.
 *
 * The stored run is on screen before the network is touched, and the app then
 * recomputes it — and when the first object of the new job arrives it
 * *replaces* the stored list rather than adding to it (R24, `effects.ts`), so
 * for a moment the list is one satellite's passes. A spec that only reads the
 * page never notices; a spec that counts cards or walks them with the keyboard
 * would, so it waits here first. The passes it then sees are the same ones the
 * seed put there: `scripts/build-stored-run.ts` computed them from the same
 * fixtures at the same instant.
 */
export async function listSettled(page: Page): Promise<void> {
  // The stored list is on screen with nothing busy *before* the recompute starts — the elements
  // load first, then the worker — so "nothing busy" alone can return in that gap and the spec
  // then reads a list the first batch is about to replace. Wait for the job to show, then to end.
  await page.locator('[aria-busy="true"]').first().waitFor({ state: 'attached', timeout: 30_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
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
export async function domeDrawn(page: Page): Promise<void> {
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

/**
 * Only the spec's readings reach the page (R34, moved here by R44 so
 * `live.spec.ts` can follow a phone too). Chrome fires one orientation event
 * with every value `null` when the first listener is added on a machine with no
 * sensor — a CI runner — and the hook rightly reads that as "no compass
 * heading". Landing between a click and an assertion, or between a dispatched
 * reading and its animation frame, it turned the follow test into a race (PR
 * #57's merged head). The browser's own events are trusted and the dispatched
 * ones are not, so a capturing listener installed before the app's stops the
 * trusted ones.
 */
export async function stubCompass(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const name of ['deviceorientationabsolute', 'deviceorientation']) {
      window.addEventListener(
        name,
        (event) => {
          if (event.isTrusted) event.stopImmediatePropagation();
        },
        true,
      );
    }
  });
}

/** A reading from the phone's compass: Chrome's absolute event, `alpha` counter-clockwise from north. */
export async function heading(page: Page, alpha: number): Promise<void> {
  await page.evaluate((value) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: value, beta: 0, gamma: 0, absolute: true }));
  }, alpha);
  // The facing is handed out on the next animation frame, which the installed clock holds.
  await page.clock.runFor(100);
}

/**
 * R48 (D-244): the compact live page carries no theme switch — on a phone the
 * theme is the settings page's (FR-COMP-2) — so a capture run sets the theme
 * on the home page's header before entering, and comes back to change it.
 * The theme is remembered (US-19), so the run puts it back when it is done.
 */
export async function setThemeOnHome(page: Page, locale: 'en' | 'es', theme: 'dark' | 'night'): Promise<void> {
  const words = LABEL[locale];
  // R52: which is now literally true — on compact the switch is on `#settings`,
  // one tap from the home screen; on wide it is still in the header.
  await withSettings(page, async () => {
    await page.getByRole('group', { name: words.theme }).getByRole('button', { name: theme === 'night' ? words.night : words.dark }).click();
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Leaves the live page for the home one, sets the theme there and comes back with the dome drawn. */
export async function reenterLiveWithTheme(page: Page, locale: 'en' | 'es', theme: 'dark' | 'night'): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('banner')).toBeVisible();
  await setThemeOnHome(page, locale, theme);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/** The five fields, each with a value that is not the pending ellipsis. */
export async function stripFilled(page: Page): Promise<void> {
  for (const field of ['time', 'sky', 'cloud', 'count', 'moon']) {
    await expect(page.getByTestId(`live-${field}`)).toBeVisible();
    await expect(page.getByTestId(`live-${field}`)).not.toContainText('…', { timeout: 30_000 });
  }
}
