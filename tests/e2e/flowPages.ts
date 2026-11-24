/**
 * R134 (FR-FLOW-10, FR-FLOW-11; D-851): the five pages `rhythm.spec.ts` and `targets.spec.ts` measure at 390 × 844 —
 * the satellites' list (R212: in the home's place), the live page (the stars page folded into it in R222), the pass detail and the settings page — each opened
 * the way R132's `sky-layout.spec.ts` opens them and returned as the root to measure under.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { openSheet, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

export const PHONE = { width: 390, height: 844 };
/** R165 (FR-CLEAN-8, D-1000): the phone turned, where the pass detail is the full form too. */
export const TURNED = { width: 844, height: 390 };
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export type FlowPage = 'list' | 'live' | 'detail' | 'settings';
const FLOW_PAGES: readonly FlowPage[] = ['list', 'live', 'detail', 'settings'];
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
/** R165 (FR-CLEAN-8): the sky page whose sheet the specs measure (the stars page left in R222) open and closed, in each view they open on. */
export const SHEET_CASES: readonly FlowCase[] = FLOW_CASES.filter(({ page }) => page === 'detail');
/** Whether `openFlowPage` opens the page's sheet (the default) or leaves the sky with the sheet closed. */
export type SheetState = 'open' | 'closed';
/** A case's name in a test title: `live (window)`, `list`. */
export const caseName = ({ page, view }: FlowCase): string => (view === null ? page : `${page} (${view})`);

/** `seedStoredRun`'s prefs for a view: the window seeds no `chartView` (a fresh profile), the dome the saved one. */
const viewPrefs = (view: FlowView): Record<string, unknown> => ({ chartView: view === 'window' ? undefined : 'dome' });

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** A reader with a place and no stored run: the settings page needs nothing else. */
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
export async function openFlowPage(page: Page, which: FlowPage, locale: Locale, view: FlowView | null = 'dome', sheet: SheetState = 'open'): Promise<Locator> {
  const drawn = view ?? 'dome';
  switch (which) {
    case 'list': {
      await seedStoredRun(page, { locale, settled: true });
      const tonight = page.getByTestId('pass-tonight');
      await expect(tonight.getByTestId('tonight-stripe')).toBeVisible({ timeout: 30_000 });
      await expect(tonight.getByTestId('conditions')).toBeVisible();
      return page.locator('main');
    }
    case 'live': {
      await seedStoredRun(page, { locale, settled: true, prefs: viewPrefs(drawn) });
      await page.goto('/#live');
      await page.reload();
      const layout = page.getByTestId('live-layout');
      await expect(layout).toBeVisible({ timeout: 30_000 });
      await expect(layout.locator(`[data-drawing="${drawn}"]`)).toBeAttached({ timeout: 30_000 });
      // R148 (FR-FULL-4): the compact live page is measured with the sheet open — its rows are the sheet's.
      await openSheet(page);
      return page.locator('body');
    }
    case 'detail': {
      await seedStoredRun(page, { locale, settled: true, prefs: viewPrefs(drawn) });
      await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
      const layout = page.getByTestId('pass-layout');
      // R164: the full form's root holds a box fixed to the viewport and has no box of its own, so it is attached, not visible.
      await expect(layout).toBeAttached();
      await expect(layout.locator(`[data-drawing="${drawn}"]`)).toBeAttached({ timeout: 30_000 });
      // The compact guide stands over the list, which it makes inert: the dialog is the page. R164 (FR-CLEAN-5,
      // FR-CLEAN-8): it is measured with its sheet open, as the live page is — its rows are the sheet's.
      // R165: or closed, the sky and what stands over it.
      if (sheet === 'open') await openSheet(page);
      else await expect(page.getByTestId('live-controls')).toBeVisible();
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
