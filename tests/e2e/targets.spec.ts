/**
 * R134 (FR-FLOW-11, F13; D-851): targets a thumb can hit. At 390 × 844, in both languages, every `a`, `button`,
 * `[role=radio]` and `input` on the five pages and the sky screen has a hit area of at least 44 × 44 px — or, in a
 * row too dense for that (`.target-row`, the facing picker), is at least 44 px tall with its hit area meeting its
 * neighbours' so every point of the row is a target. Links inside a `p` are running text and exempt; so is what
 * the page has put out of reach (`inert`, `aria-hidden`) or not drawn.
 *
 * The controls are measured at rest. A page that focuses a control on arrival (the sub-pages' `[ ← ]`) shows it with
 * D-500's ring round its text line, which takes the inline control's tap box away while the ring is drawn — the
 * keyboard's state, held by `settings.spec.ts` — so the focus is let go before the measure.
 *
 *   npx playwright test targets --project=chromium
 */
import { expect, test, type Locator } from '@playwright/test';
import { FLOW_PAGES, LOCALES, openFlowPage, openSkyScreenPage, PHONE } from './flowPages';

/** WCAG 2.5.5 (target size, enhanced) and Apple's guideline. */
const TARGET_PX = 44;
/** Sub-pixel layout: a box drawn at 43.99 px is the 44 it was written as. */
const SLACK = 0.5;

/** Every control under `root` that misses the rule, described for the failure message. */
async function misses(root: Locator): Promise<string[]> {
  await root.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  return root.evaluate(
    (el, [min, slack]) => {
      const out: string[] = [];
      const seen = new Set<Element>();
      const name = (c: Element): string => {
        const label = c.getAttribute('aria-label') ?? c.getAttribute('data-testid') ?? (c instanceof HTMLInputElement ? `input[${c.type}]` : (c.textContent ?? '').trim().slice(0, 40));
        return `${c.tagName.toLowerCase()} "${label}"`;
      };
      const reachable = (c: Element): boolean => {
        if (c.closest('[inert], [aria-hidden="true"]')) return false;
        if (c instanceof HTMLInputElement && c.type === 'hidden') return false;
        if (!c.checkVisibility({ visibilityProperty: true })) return false;
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      for (const c of el.querySelectorAll('a, button, [role=radio], input')) {
        if (seen.has(c)) continue;
        seen.add(c);
        if (c.tagName === 'A' && c.closest('p')) continue;
        if (!reachable(c)) continue;
        const r = c.getBoundingClientRect();
        if (r.height < min - slack) {
          out.push(`${name(c)} ${r.width.toFixed(1)} × ${r.height.toFixed(1)}: under ${String(min)} px tall`);
          continue;
        }
        if (r.width >= min - slack) continue;
        // Narrower than the floor: allowed only in a dense row whose hit areas meet.
        const row = c.closest('.target-row');
        if (!row) {
          out.push(`${name(c)} ${r.width.toFixed(1)} × ${r.height.toFixed(1)}: under ${String(min)} px wide, not in a .target-row`);
          continue;
        }
        const items = Array.from(row.querySelectorAll('a, button, [role=radio], input'))
          .filter(reachable)
          .map((item) => ({ item, r: item.getBoundingClientRect() }))
          .filter(({ r: o }) => Math.abs(o.top - r.top) < 1)
          .sort((a, b) => a.r.left - b.r.left);
        const at = items.findIndex(({ item }) => item === c);
        const before = items[at - 1];
        const after = items[at + 1];
        if (before && r.left - before.r.right > slack) out.push(`${name(c)}: ${(r.left - before.r.right).toFixed(1)} px between it and the item before it`);
        if (after && after.r.left - r.right > slack) out.push(`${name(c)}: ${(after.r.left - r.right).toFixed(1)} px between it and the item after it`);
      }
      return out;
    },
    [TARGET_PX, SLACK] as const,
  );
}

for (const locale of LOCALES) {
  test.describe(`FR-FLOW-11 at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE });

    for (const which of FLOW_PAGES) {
      test(`every control on the ${which} page is a 44 × 44 target or a meeting row`, async ({ page }) => {
        const root = await openFlowPage(page, which, locale);
        expect(await misses(root)).toEqual([]);
      });
    }

    test.describe('the sky screen', () => {
      test.use({ hasTouch: true });

      test('every control on the sky screen is a 44 × 44 target or a meeting row', async ({ page }) => {
        const screen = await openSkyScreenPage(page, locale);
        expect(await misses(screen)).toEqual([]);
      });
    });
  });
}
