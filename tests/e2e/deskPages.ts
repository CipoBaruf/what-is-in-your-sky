/**
 * R189 (FR-WIDE-9, FR-WIDE-10): the desk sky pages (the stars page folded into live in R222, FR-LAND-3) opened as a fresh desk opens them — on the globe — with the
 * stored run's sky, for `keys.spec.ts` and `fullscreen.spec.ts`. The view, the instant and the playback read back.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { seedStoredRun } from './liveHelpers';

export const DESK_PAGES = ['live', 'pass'] as const;
export type DeskPage = (typeof DESK_PAGES)[number];

const LAYOUT: Record<DeskPage, string> = { live: 'live-layout', pass: 'pass-layout' };

/** Opens `which` at the stored run's instant, nothing saved, and waits for its drawing. */
export async function openDeskPage(page: Page, which: DeskPage): Promise<Locator> {
  await seedStoredRun(page, { settled: true, prefs: { chartView: undefined } });
  if (which === 'live') await page.goto('/#live');
  if (which !== 'pass') await page.reload();
  else await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
  const layout = page.getByTestId(LAYOUT[which]);
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await expect(layout.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  // The keys are read with nothing focused.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  return layout;
}

/** The view the box draws: the globe, the window or the dome. */
export async function shownView(layout: Locator): Promise<string> {
  if ((await layout.locator('[data-slot="drawing"] [data-globe]').count()) > 0) return 'globe';
  return (await layout.locator('[data-slot="drawing"] [data-drawing]').first().getAttribute('data-drawing')) ?? '';
}

/** The page's shown instant `t`, as the time control's overview slider says it. */
export async function shownInstant(layout: Locator): Promise<number> {
  return Number(await layout.getByTestId('stripe-overview').getAttribute('aria-valuenow'));
}

/** The time control's state: `watching` at real time, `scrubbing` while an instant is held . */
export const timeState = (layout: Locator): Locator => layout.getByTestId('time-control');

/** Whether the page plays: the playback row's `[ Play ]`. */
export const playState = (layout: Locator): Locator => layout.getByTestId('live-play');
