/**
 * R189 (FR-WIDE-10, US-56 AC2; D-1103): the full sky on each desk page and each view at 1280 × 800. A headless browser
 * may not grant the Fullscreen API, so an init script stubs it — `requestFullscreen` takes the element and
 * `exitFullscreen` gives it back, each with its `fullscreenchange` — and the page's own state is what is asserted:
 * the layout's `data-full`, the box refit to the screen with no rail beside it, the time readout and `[ × ]` over it,
 * and the camera, the instant and the drawing's element read back equal across it (the globe and the window are not
 * remounted). `f`, the control, `[ × ]` and `Esc` each enter or leave.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DESK_PAGES, openDeskPage, shownInstant, shownView } from './deskPages';

const DESK = { width: 1280, height: 800 };
test.use({ viewport: DESK, hasTouch: false });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let element: Element | null = null;
    const change = (next: Element | null): void => {
      element = next;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => true });
    Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => element });
    Document.prototype.exitFullscreen = function exitFullscreen() {
      change(null);
      return Promise.resolve();
    };
    Element.prototype.requestFullscreen = function requestFullscreen(this: Element) {
      change(this);
      return Promise.resolve();
    };
  });
});

const VIEW_KEY = { globe: 'g', window: 'w', dome: 'd' } as const;

/** What must not change across full screen: the camera (the readout corner, and the window's look), the instant. */
async function state(layout: Locator): Promise<{ readout: string; look: string | null; t: number | null }> {
  const readout = (await layout.locator('[data-corner="readout"]').textContent()) ?? '';
  // Read only what is there: a locator's `evaluate` would wait for an element the view does not draw.
  const looks = layout.locator('[data-look-az]');
  const look = (await looks.count()) === 0 ? null : await looks.first().evaluate((el) => ['data-look-az', 'data-look-alt', 'data-fov'].map((name) => el.getAttribute(name)).join(' '));
  // The stars page's window and dome show real time and draw no time control.
  const t = (await layout.locator('[data-testid="stripe-overview"], [data-testid="globe-clock"]').count()) === 0 ? null : await shownInstant(layout);
  return { readout, look, t };
}

/** Tags the drawing's element, so a remount (a new element) reads back untagged. */
async function tagDrawing(layout: Locator): Promise<void> {
  await layout.locator('[data-slot="drawing"] [data-globe], [data-slot="drawing"] [data-drawing]').first().evaluate((el) => {
    el.setAttribute('data-r189-mark', '');
  });
}

const drawn = async (layout: Locator): Promise<{ width: number; height: number }> => {
  const found = await layout.locator('[data-slot="drawing"]').boundingBox();
  if (!found) throw new Error('no drawing slot');
  return { width: Math.round(found.width), height: Math.round(found.height) };
};

async function expectFull(page: Page, layout: Locator): Promise<void> {
  await expect(layout).toHaveAttribute('data-full', '');
  await expect.poll(() => drawn(layout)).toEqual(DESK);
  // The drawing inside refits to the screen with no rail beside it (`fitBox`'s room, the frame's own observer).
  const inner = layout.locator('[data-slot="drawing"] [data-testid="globe-box"], [data-slot="drawing"] [data-testid="chart-box"]').first();
  await expect.poll(async () => Math.round((await inner.boundingBox())?.width ?? 0)).toBeGreaterThan(DESK.width - 40);
  const corner = layout.locator('[data-corner="fullscreen"]');
  await expect(corner.getByTestId('time-readout')).toBeVisible();
  await expect(corner.getByRole('button', { name: 'Leave full screen' })).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement?.getAttribute('data-slot'))).toBe('drawing');
}

for (const which of DESK_PAGES) {
  test(`FR-WIDE-10 on the ${which} page: each view enters and leaves full screen with nothing changed`, async ({ page }) => {
    const layout = await openDeskPage(page, which);
    for (const view of ['globe', 'window', 'dome'] as const) {
      await page.keyboard.press(VIEW_KEY[view]);
      await expect.poll(() => shownView(layout), { timeout: 30_000 }).toBe(view);
      const box = await drawn(layout);
      expect(box.width, 'the box beside the rail').toBeLessThan(DESK.width - 300);
      if (view !== 'dome') await tagDrawing(layout);
      // The globe holds the instant; the window and the dome show real time on the stars page.
      if (which !== 'stars' || view === 'globe') await page.keyboard.press('.');
      const before = await state(layout);

      // The control enters, `[ × ]` leaves.
      await layout.getByTestId('sky-fullscreen').click();
      await expectFull(page, layout);
      expect(await state(layout), `${view}: across entering`).toEqual(before);
      await layout.getByRole('button', { name: 'Leave full screen' }).click();
      await expect(layout).not.toHaveAttribute('data-full');
      await expect.poll(() => drawn(layout)).toEqual(box);
      expect(await state(layout), `${view}: across leaving`).toEqual(before);

      // `f` enters, `Esc` leaves — and only full screen: the page stays.
      await page.keyboard.press('f');
      await expectFull(page, layout);
      await page.keyboard.press('Escape');
      await expect(layout).not.toHaveAttribute('data-full');
      await expect(layout).toBeVisible();
      expect(await state(layout), `${view}: across f and Esc`).toEqual(before);
      if (view !== 'dome') await expect(layout.locator('[data-r189-mark]'), `${view}: not remounted`).toHaveCount(1);
      await page.keyboard.press('t');
    }
  });
}

test('FR-WIDE-10: where the API is missing the control is absent and f does nothing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => false });
  });
  const layout = await openDeskPage(page, 'live');
  await expect(layout.getByTestId('sky-fullscreen')).toHaveCount(0);
  await page.keyboard.press('f');
  await expect(layout).not.toHaveAttribute('data-full');
});
