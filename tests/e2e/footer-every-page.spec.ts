/**
 * D-1023 (FR-X-2 as amended 2026-11-02, the owner's call): the footer is the same on every page. On a desk (1280 × 800)
 * the home, the pass detail, settings, live and stars all end in D-120's one row (the live page's under the fold of its
 * one-viewport sky); on a phone (390 × 844) the home and
 * settings end in the full credits, and live, stars and the pass detail carry the one row, its privacy word kept, as
 * the last group of the controls sheet's body. Every form stands a group gap (`--space-3`) under what is above it.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openFlowPage, PHONE, type FlowPage, type Locale } from './flowPages';

const DESK = { width: 1280, height: 800 };
const PAGES: readonly FlowPage[] = ['home', 'detail', 'settings', 'live', 'stars'];
const PRIVACY_WORD = { en: 'No tracking', es: 'Sin rastreo' } as const;
const PRIVACY_SENTENCE = { en: 'No analytics, no tracking', es: 'Sin analítica ni rastreo' } as const;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** `--space-3` in px, read from the page's own tokens. */
async function space3(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.height = 'var(--space-3)';
    document.body.append(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  });
}

/**
 * The gap between what stands above the footer and the footer's first drawn line — its rule in the one-row forms,
 * its first sentence in the full form (whose character rule is a `::before` of the footer, above that sentence) —
 * and the footer's own space above that line.
 */
async function gapAbove(footer: Locator): Promise<{ gap: number; own: number }> {
  return footer.evaluate((el) => {
    const first = (el.querySelector(':scope > hr') ?? el.querySelector(':scope > p')) as HTMLElement;
    const top = first.getBoundingClientRect().top;
    const drawnBottom = (node: Element): number => {
      const rect = node.getBoundingClientRect();
      if (rect.height > 0 && getComputedStyle(node).display !== 'contents') return rect.bottom;
      return Math.max(-Infinity, ...Array.from(node.children).map(drawnBottom));
    };
    let above = el.previousElementSibling;
    while (above && drawnBottom(above) === -Infinity) above = above.previousElementSibling;
    return { gap: above ? top - drawnBottom(above) : Infinity, own: top - el.getBoundingClientRect().top };
  });
}

async function open(page: Page, which: FlowPage, locale: Locale): Promise<void> {
  if (which === 'detail' && page.viewportSize()?.width === DESK.width) {
    // On a desk the pass detail is the shell's layout in the home's place (FR-WIDE-1): opened from the list, the footer stays.
    await openFlowPage(page, 'home', locale);
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
    await expect(page.getByTestId('guide-panel')).toBeVisible({ timeout: 30_000 });
    return;
  }
  await openFlowPage(page, which, locale);
}

for (const locale of ['en', 'es'] as const) {
  test.describe(`the footer on a desk, 1280 × 800, ${locale} (D-1023)`, () => {
    test.use({ viewport: DESK });
    for (const which of PAGES) {
      test(`${which} ends in the one row, privacy word kept, a group gap under the page`, async ({ page }) => {
        await open(page, which, locale);
        const footer = page.getByRole('contentinfo');
        await expect(footer).toHaveCount(1);
        await expect(footer).toHaveAttribute('data-form', 'short');
        await expect(footer).toBeInViewport({ ratio: 1 });
        await expect(footer).toContainText(PRIVACY_WORD[locale]);
        await expect(footer.getByRole('link', { name: 'glyphcss' })).toBeVisible();
        await expect(page.getByTestId('app-footer')).toHaveCount(1);
        const s3 = await space3(page);
        const { gap, own } = await gapAbove(footer);
        expect(own, `the footer's own space above its rule is ${String(own)} px`).toBeGreaterThanOrEqual(s3 - 1);
        expect(gap, `the gap above the footer's rule is ${String(gap)} px`).toBeGreaterThanOrEqual(s3 - 1);
        // The page is one viewport high on a desk. R186 (FR-WIDE-1): the live page is the shell's too, header, layout
        // and footer in the one viewport as the stars page has them; its footer under the fold (D-1023) is gone.
        const over = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        expect(over).toBeLessThanOrEqual(0);
      });
    }
  });

  test.describe(`the footer on a phone, 390 × 844, ${locale} (D-1023)`, () => {
    test.use({ viewport: PHONE });
    for (const which of ['home', 'settings'] as const) {
      test(`${which} ends in the full credits, a group gap under the page`, async ({ page }) => {
        await open(page, which, locale);
        const footer = page.getByRole('contentinfo');
        await expect(footer).toHaveCount(1);
        await expect(footer).toHaveAttribute('data-form', 'full');
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeVisible();
        await expect(footer).toContainText(PRIVACY_SENTENCE[locale]);
        await expect(footer.getByRole('link', { name: 'glyphcss' })).toBeVisible();
        const s3 = await space3(page);
        const { gap, own } = await gapAbove(footer);
        expect(own).toBeGreaterThanOrEqual(s3 - 1);
        expect(gap).toBeGreaterThanOrEqual(s3 - 1);
      });
    }

    for (const which of ['live', 'stars', 'detail'] as const) {
      test(`${which} ends its controls sheet in the one row, privacy word kept, a group gap under the last section`, async ({ page }) => {
        await open(page, which, locale);
        const sheet = page.getByTestId('live-sheet');
        await expect(sheet).toHaveAttribute('data-open', 'true');
        const body = sheet.getByTestId('sheet-body');
        const row = body.locator(':scope > [data-testid="app-footer"]');
        await expect(row).toHaveCount(1);
        expect(await body.evaluate((el) => el.lastElementChild?.getAttribute('data-testid'))).toBe('app-footer');
        await expect(row).toHaveAttribute('data-form', 'short');
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();
        await expect(row).toContainText(PRIVACY_WORD[locale]);
        await expect(row.getByRole('link', { name: 'glyphcss' })).toBeVisible();
        const s3 = await space3(page);
        expect((await gapAbove(row)).gap).toBeGreaterThanOrEqual(s3 - 1);
        // The row stays inside the body's width: the sheet never scrolls sideways.
        expect(await body.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
        if (which !== 'detail') {
          // The sky pages have no footer of their own on a phone: no `contentinfo` (the pass detail stands over the home's).
          await expect(page.getByRole('contentinfo')).toHaveCount(0);
        }
      });
    }
  });
}
