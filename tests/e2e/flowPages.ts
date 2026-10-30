/**
 * R134 (FR-FLOW-10, FR-FLOW-11; D-851): the five pages `rhythm.spec.ts` and `targets.spec.ts` measure at 390 × 844 —
 * the home, the live page, the stars page, the pass detail and the settings page — each opened
 * the way R132's `sky-layout.spec.ts` opens them and returned as the root to measure under.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { openSheet, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

export const PHONE = { width: 390, height: 844 };
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export type FlowPage = 'home' | 'live' | 'stars' | 'detail' | 'settings';
const FLOW_PAGES: readonly FlowPage[] = ['home', 'live', 'stars', 'detail', 'settings'];
/**
 * R139 (FR-FLOW-10, FR-FLOW-11 as amended; D-885): the two views a phone opens the live page and the pass detail on —
 * the window, a fresh profile's (FR-FLOW-14: no `chartView` saved), and the dome, a saved `chartView`.
 */
export type FlowView = 'window' | 'dome';
const FLOW_VIEWS: readonly FlowView[] = ['window', 'dome'];
/** The cases the two specs run: each page once, and the live page and the pass detail once in each view. */
export interface FlowCase {
  page: FlowPage;
  view: FlowView | null;
}
export const FLOW_CASES: readonly FlowCase[] = FLOW_PAGES.flatMap((page): FlowCase[] => (page === 'live' || page === 'detail' ? FLOW_VIEWS.map((view) => ({ page, view })) : [{ page, view: null }]));
/** A case's name in a test title: `live (window)`, `home`. */
export const caseName = ({ page, view }: FlowCase): string => (view === null ? page : `${page} (${view})`);

/** `seedStoredRun`'s prefs for a view: the window seeds no `chartView` (a fresh profile), the dome the saved one. */
const viewPrefs = (view: FlowView): Record<string, unknown> => ({ chartView: view === 'window' ? undefined : 'dome' });

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** A reader with a place and no stored run: the stars page and the settings page need nothing else. */
async function seedReader(page: Page, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
}

/**
 * Opens one of the five pages, settled, and returns the element its measures are taken under. `view` is the chart's
 * view on the live page and the pass detail (D-885); the other pages have one form and ignore it.
 */
export async function openFlowPage(page: Page, which: FlowPage, locale: Locale, view: FlowView | null = 'dome'): Promise<Locator> {
  const drawn = view ?? 'dome';
  switch (which) {
    case 'home': {
      await seedStoredRun(page, { locale, settled: true });
      await expect(page.getByTestId('home-doors')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('reading-when')).toBeVisible();
      await expect(page.getByTestId('list-column')).toBeVisible();
      return page.locator('main');
    }
    case 'live': {
      await seedStoredRun(page, { locale, settled: true, prefs: viewPrefs(drawn) });
      await page.goto('/#live');
      await page.reload();
      const layout = page.getByTestId('live-layout');
      await expect(layout).toBeVisible({ timeout: 30_000 });
      await expect(layout.locator(`[data-drawing="${drawn}"]`)).toBeAttached({ timeout: 30_000 });
      // R148 (FR-FULL-4): the compact live page is measured with the sheet open — its rows are the sheet's; the card
      // over the sky is answered first, so the page is the reader's.
      const card = page.getByTestId('live-card');
      if ((await card.count()) > 0) await card.getByTestId('live-card-now').click();
      await openSheet(page);
      return page.locator('body');
    }
    case 'stars': {
      await seedReader(page, locale);
      await page.goto('/#stars');
      const layout = page.getByTestId('stars-layout');
      await expect(layout).toBeVisible();
      await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
      return page.locator('body');
    }
    case 'detail': {
      await seedStoredRun(page, { locale, settled: true, prefs: viewPrefs(drawn) });
      await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
      const layout = page.getByTestId('pass-layout');
      await expect(layout).toBeVisible();
      await expect(layout.locator(`[data-drawing="${drawn}"]`)).toBeAttached({ timeout: 30_000 });
      // The compact guide is a sheet over the home, which it makes inert: the sheet is the page.
      return page.locator('[role="dialog"][data-pass-id]');
    }
    case 'settings': {
      await seedReader(page, locale);
      await page.goto('/#settings');
      await expect(page.getByTestId('settings-browser')).toBeVisible();
      return page.locator('body');
    }
  }
}
