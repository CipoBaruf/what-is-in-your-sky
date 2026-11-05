/**
 * v2.14.1 (FR-WIDE-14, V214-31; D-1141): one line on a focused field at 1280 × 800. Tabbing through the cold home's
 * place step, a set place's home with its place field opened, the settings page with its coordinates opened and the
 * stars page, every text field the focus reaches draws its own border in the ring's colour and no outline; a button
 * reached the same way keeps the ring (D-704). The colours are read as Chromium computes them.
 */
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';
import { openStarsPage } from './globeHelpers';

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

interface Seen {
  tag: string;
  name: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  borderColor: string;
  accent: string;
  /** A card's stretched button: the card wears the ring in its place (global.css, D-704). */
  inCard: boolean;
}

/** What the focused element draws, beside the accent as a computed colour (a probe's `color`). */
async function focused(page: Page): Promise<Seen | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return null;
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      name: el.getAttribute('aria-label') ?? el.id,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      borderColor: style.borderTopColor,
      accent,
      inCard: el.parentElement?.hasAttribute('data-card') ?? false,
    };
  });
}

/** Tabs `presses` times from the top of the document, keeping what each stop draws. */
async function tabThrough(page: Page, presses: number): Promise<Seen[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const seen: Seen[] = [];
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press('Tab');
    const now = await focused(page);
    if (now) seen.push(now);
  }
  return seen;
}

const FIELDS = new Set(['input', 'select', 'textarea']);

/** Every field reached draws one line — its border in the accent, no outline — and at least `min` were reached; every button reached keeps the ring. */
function oneLineOnEachField(seen: readonly Seen[], min: number): void {
  const fields = seen.filter((s) => FIELDS.has(s.tag));
  expect(fields.length, JSON.stringify(seen.map((s) => s.tag))).toBeGreaterThanOrEqual(min);
  for (const field of fields) {
    expect(field.outlineStyle === 'none' || field.outlineWidth === '0px', `${field.name}: no outline (${field.outlineStyle} ${field.outlineWidth})`).toBe(true);
    expect(field.borderColor, `${field.name}: the border in the ring's colour`).toBe(field.accent);
  }
  const buttons = seen.filter((s) => s.tag === 'button' && !s.inCard);
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button.outlineStyle, `${button.name}: the ring`).toBe('solid');
    expect(button.outlineWidth).toBe('2px');
    expect(button.outlineColor).toBe(button.accent);
  }
}

test('FR-WIDE-14: the cold home’s place step — one line on the place field', async ({ page }) => {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Place name' })).toBeVisible({ timeout: 30_000 });
  oneLineOnEachField(await tabThrough(page, 12), 1);
});

test('FR-WIDE-14: a set place’s home, its place field opened — one line on the field', async ({ page }) => {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('location-summary-change').first().click();
  await expect(page.getByRole('combobox', { name: 'Place name' })).toBeVisible();
  oneLineOnEachField(await tabThrough(page, 40), 1);
});

test('FR-WIDE-14: the settings page, the coordinates opened — one line on every field', async ({ page }) => {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.goto('/#settings');
  await expect(page.getByTestId('settings-back')).toBeVisible({ timeout: 30_000 });
  const disclosure = page.getByTestId('coords-disclosure');
  if ((await disclosure.getAttribute('aria-expanded')) === 'false') await disclosure.click();
  await expect(page.getByLabel('Coordinates · e.g. -38.93, -67.99')).toBeVisible();
  oneLineOnEachField(await tabThrough(page, 40), 2);
});

test('FR-WIDE-14: the stars page — no field draws a ring, its buttons keep theirs', async ({ page }) => {
  await openStarsPage(page);
  const seen = await tabThrough(page, 30);
  // The stars page has no text field today; any it gains is held to the same line.
  oneLineOnEachField(seen, 0);
});
