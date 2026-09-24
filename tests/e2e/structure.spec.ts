/**
 * R92 (FR-A11Y-1..5, FR-ROUTE-1..3; US-30 AC1..AC5; F-71, F-72, F-91): the shell in the browser — each
 * route's landmarks at a phone's width and a desk's, the outline of a full home, the title in both languages,
 * where the focus is after every change and what the announcer says, and a history that Back can leave.
 * `App.structure.test.tsx` holds the same per screen in jsdom; this is where the widths, the stored run and
 * the real history are.
 */
import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { seedStoredRun, STORED_RUN, type StoredRun } from './liveHelpers';
import { A11Y_MAX_H2, landmarkCounts, pageOutline, skippedLevels } from './structure';

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 720 };

const TITLE = {
  en: { app: 'What is in your sky right now', live: 'Live sky', settings: 'Settings' },
  es: { app: 'Qué hay en el cielo ahora mismo', live: 'Cielo en vivo', settings: 'Ajustes' },
} as const;

/**
 * The 40-pass list FR-A11Y-2's verification names: the stored run's 25 passes and 15 of them again, two minutes
 * later under their own ids. The elements stay down, so no recompute replaces it with the fixtures' 25.
 */
interface RunPass {
  id: string;
  noradId: number;
  start: { t: number };
  peak: { t: number };
  end: { t: number };
  track: { t: number }[];
}
const FORTY: StoredRun = (() => {
  const passes = STORED_RUN.passes as RunPass[];
  const shift = (pass: RunPass, ms: number): RunPass => ({
    ...pass,
    id: `${String(pass.noradId)}-${String(pass.start.t + ms)}`,
    start: { ...pass.start, t: pass.start.t + ms },
    peak: { ...pass.peak, t: pass.peak.t + ms },
    end: { ...pass.end, t: pass.end.t + ms },
    track: pass.track.map((point) => ({ ...point, t: point.t + ms })),
  });
  return { ...STORED_RUN, passes: [...passes, ...passes.slice(0, 15).map((pass) => shift(pass, 120_000))].sort((a, b) => a.start.t - b.start.t) };
})();

const hash = (page: Page): Promise<string> => page.evaluate(() => window.location.hash);
const home = async (page: Page): Promise<void> => {
  await expect.poll(() => hash(page)).toBe('');
};
const openGuide = (page: Page, nth = 0) => page.getByRole('button', { name: /Open guide|Abrir la guía/ }).nth(nth);
/** The guide's way out: the sheet's `← Back to the list` on a phone, the panel's `×` on a desk. */
const closeGuide = (page: Page) => page.locator('[role="dialog"][data-pass-id] button').first().or(page.getByTestId('guide-panel').getByRole('button', { name: 'Close the guide' }));
/** The live page's Back control, found the way the parent commit's page can be (the `live-back` test id is R92's). */
const liveBack = (page: Page) => page.getByTestId('live-top-row').getByRole('button').first();
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'body';
    const id = active.getAttribute('data-testid');
    return id ?? `${active.tagName.toLowerCase()}:${(active.textContent ?? '').trim().slice(0, 40)}`;
  });

for (const viewport of [PHONE, DESK]) {
  test.describe(`at ${String(viewport.width)} px`, () => {
    test.use({ viewport });

    test('every route has one main and one h1; home and settings a banner, a navigation and a contentinfo (FR-A11Y-1)', async ({ page }) => {
      await seedStoredRun(page);
      expect(await landmarkCounts(page)).toEqual({ main: 1, h1: 1, banner: 1, navigation: 1, contentinfo: 1 });

      // The guide, over the list on a phone and beside it on a desk: the page under it keeps its landmarks.
      await openGuide(page).click();
      await expect(closeGuide(page)).toBeVisible();
      expect(await landmarkCounts(page)).toMatchObject({ main: 1, h1: 1 });
      await closeGuide(page).click();
      await home(page);

      await page.evaluate(() => {
        window.location.hash = 'live';
      });
      await expect(page.getByTestId('live-page')).toBeVisible();
      // The live page's top row is its banner; it has no footer (FR-A11Y-1).
      expect(await landmarkCounts(page)).toMatchObject({ main: 1, h1: 1, banner: 1, contentinfo: 0 });
      await page.getByTestId('live-back').click();
      await home(page);

      await page.evaluate(() => {
        window.location.hash = 'settings';
      });
      await expect(page.getByTestId('settings-back')).toBeVisible();
      expect(await landmarkCounts(page)).toEqual({ main: 1, h1: 1, banner: 1, navigation: 1, contentinfo: 1 });
    });

    test(`the populated home with 40 passes skips no level and has at most ${String(A11Y_MAX_H2)} h2 (FR-A11Y-2)`, async ({ page }) => {
      // R97 (FR-FAINT-2): faint passes shown, so all 40 are cards and every name is in the outline.
      await seedStoredRun(page, { run: FORTY, elements: 'down', prefs: { showFaint: true } });
      // Every night open, so every card's heading is in the outline.
      for (const toggle of await page.getByTestId('night-toggle').all()) {
        if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
      }
      await expect(page.locator('article[data-pass-id]:visible')).toHaveCount(FORTY.passes.length);
      const headings = await pageOutline(page);
      expect(skippedLevels(headings)).toEqual([]);
      expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
      expect(headings.filter(([level]) => level === 2).length).toBeLessThanOrEqual(A11Y_MAX_H2);
      // F-72: the cards are no longer h2s — every one of the 40 names is an h4 under its night's h3.
      expect(headings.filter(([level]) => level === 4)).toHaveLength(FORTY.passes.length);
      expect(headings.filter(([level]) => level === 3).length).toBeGreaterThan(1);
    });
  });
}

test.describe('the title (FR-A11Y-3, US-30 AC3)', () => {
  test.use({ viewport: PHONE });

  for (const locale of ['en', 'es'] as const) {
    test(`names each route in ${locale}`, async ({ page }) => {
      const words = TITLE[locale];
      await seedStoredRun(page, { locale });
      await expect(page).toHaveTitle(words.app);
      await page.getByTestId('settings-link').click();
      await expect(page).toHaveTitle(`${words.settings} · ${words.app}`);
      await page.getByTestId('settings-back').click();
      await expect(page).toHaveTitle(words.app);
      await page.getByTestId('live-link').click();
      await expect(page).toHaveTitle(`${words.live} · ${words.app}`);
      await page.getByTestId('live-back').click();
      await expect(page).toHaveTitle(words.app);
      await openGuide(page).click();
      // "<satellite> <start time> · <app title>"
      await expect(page).toHaveTitle(new RegExp(`^.+ \\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d( UTC)? · ${words.app}$`));
      await closeGuide(page).click();
      await expect(page).toHaveTitle(words.app);
    });
  }
});

test.describe('focus and the announcer (FR-A11Y-4, US-30 AC4)', () => {
  test.use({ viewport: PHONE });

  test('each route takes the focus on the way in and gives it back on the way out, and is named once', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    await page.evaluate(() => {
      const region = document.querySelector('[data-testid="route-announcer"]');
      const said: string[] = [];
      (window as unknown as { said: string[] }).said = said;
      if (region) new MutationObserver(() => said.push(region.textContent ?? '')).observe(region, { childList: true, characterData: true, subtree: true });
    });
    const said = (): Promise<string[]> => page.evaluate(() => (window as unknown as { said: string[] }).said);
    const app = TITLE.en.app;

    await page.getByTestId('settings-link').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => focused(page)).toBe('settings-back');
    await page.keyboard.press('Enter');
    await home(page);
    await expect.poll(() => focused(page)).toBe('settings-link');

    await page.getByTestId('live-link').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => focused(page)).toBe('live-back');
    await page.keyboard.press('Escape');
    await home(page);
    await expect.poll(() => focused(page)).toBe('live-link');

    const opener = openGuide(page);
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => focused(page)).toMatch(/^h2:/);
    await page.keyboard.press('Escape');
    await home(page);
    await expect(opener).toBeFocused();

    // Six changes, six sentences, each the new route's name — the pass by its satellite and time.
    const heard = await said();
    expect(heard).toHaveLength(6);
    expect(heard.slice(0, 4)).toEqual([`Settings · ${app}`, app, `Live sky · ${app}`, app]);
    expect(heard[4]).toMatch(new RegExp(`^.+ \\d\\d:\\d\\d( UTC)? · ${app}$`));
    expect(heard[5]).toBe(app);
  });

  test('the skip link is the first stop on home and settings and lands on main (FR-A11Y-5)', async ({ page }) => {
    await seedStoredRun(page);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('skip-link')).toBeFocused();
    await expect(page.getByTestId('skip-link')).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('MAIN');
    expect(await hash(page)).toBe('');
    // Settings puts the focus on its Back control on the way in (FR-A11Y-4), so the Tab walk starts past the
    // link; the link is still the first focusable element in the page's order.
    await page.getByTestId('settings-link').click();
    await expect(page.getByTestId('settings-back')).toBeFocused();
    const first = await page.evaluate(() => document.querySelector('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')?.getAttribute('data-testid'));
    expect(first).toBe('skip-link');
    await page.getByTestId('skip-link').focus();
    await expect(page.getByTestId('skip-link')).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('MAIN');
    await expect(page.getByTestId('settings-back')).toBeVisible();
  });
});

test.describe('history (FR-ROUTE-1..3, F-91)', () => {
  test.use({ viewport: PHONE });

  test('three passes, the live page and settings opened and closed leave no entry, and one Back leaves the app', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    const origin = new URL(page.url()).origin;
    const length = (): Promise<number> => page.evaluate(() => window.history.length);

    const cycles: (() => Promise<void>)[] = [0, 1, 2].map((nth) => async () => {
      await openGuide(page, nth).click();
      await closeGuide(page).click();
    });
    cycles.push(async () => {
      await page.getByTestId('live-link').click();
      await liveBack(page).click();
    });
    cycles.push(async () => {
      await page.getByTestId('settings-link').click();
      await page.getByTestId('settings-back').click();
    });

    // The first open leaves the one forward entry every later one re-uses; from there, nothing grows.
    let afterFirst = 0;
    for (const [index, cycle] of cycles.entries()) {
      await cycle();
      await home(page);
      if (index === 0) afterFirst = await length();
    }
    expect(await length()).toBe(afterFirst);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).origin).not.toBe(origin);
  });

  test('Back and Forward render the route the URL names, and the page controls go back the way they came', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByTestId('settings-link').click();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.getByTestId('live-link').click();
    await expect(page.getByTestId('live-page')).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.goBack();
    await home(page);
    await expect(page.getByTestId('settings-back')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId('live-page')).toBeVisible();

    // The live page was opened from settings: its Back returns there, and settings' to home.
    await liveBack(page).click();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.getByTestId('settings-back').click();
    await home(page);
    await expect(page.getByTestId('header')).toBeVisible();
  });

  test('a reload keeps #settings, #live, a pass, and says so when the pass has gone (FR-ROUTE-3)', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    const passId = await page.locator('article[data-pass-id]').first().getAttribute('data-pass-id');

    await page.getByTestId('settings-link').click();
    await page.reload();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await expect(page).toHaveTitle(`Settings · ${TITLE.en.app}`);

    await page.getByTestId('live-link').click();
    await expect(page.getByTestId('live-page')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('live-page')).toBeVisible();

    await page.evaluate((id) => {
      window.location.hash = `pass=${id ?? ''}`;
    }, passId);
    await page.reload();
    await expect(page.locator(`[role="dialog"][data-pass-id="${passId ?? ''}"]`)).toBeVisible();

    // A pass the run never had any more: the home, and FR-SHARE-3's sentence naming the satellite and the time.
    await page.evaluate(() => {
      window.location.hash = 'pass=25544-1788000000000';
    });
    await page.reload();
    await expect(page.getByTestId('share-fallback')).toContainText('ISS');
  });
});
