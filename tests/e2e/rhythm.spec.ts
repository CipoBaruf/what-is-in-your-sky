/**
 * R134 (FR-FLOW-10, F9; D-851): three gaps. At 390 × 844, in both languages, the vertical gap between consecutive
 * marked blocks (`data-rhythm="row" | "group" | "section"`) on the home, the live page, the stars page, the pass
 * detail and the settings page is the lower block's token — `--space-1`, `--space-3` or `--space-5`, read off the
 * page — to a pixel, and no row gap is larger than a group gap, nor a group gap than a section gap.
 *
 * "Consecutive" is in document order among the blocks that share their nearest marked ancestor (or have none), so
 * the home's readings count across its two columns and a sky view's slots among themselves. A block the page has
 * not drawn (no box) is not one.
 *
 * R139 (FR-FLOW-10 as amended, D-885): the live page and the pass detail are measured in both views a phone opens
 * them on, the window (a fresh profile) and the dome (a saved `chartView`), and no gap is a known exception: the
 * dome's empty `picker` slot takes no gap, so its drawing and its hint stand one row apart.
 *
 *   npx playwright test rhythm --project=chromium
 */
import { expect, test, type Locator } from '@playwright/test';
import { caseName, FLOW_CASES, LOCALES, openFlowPage, PHONE } from './flowPages';

type Rhythm = 'row' | 'group' | 'section';
const TOKEN: Record<Rhythm, string> = { row: '--space-1', group: '--space-3', section: '--space-5' };

interface Gap {
  above: string;
  below: string;
  rhythm: Rhythm;
  gap: number;
}

/** The tokens' values in px, and every gap between consecutive marked blocks under `root`. */
async function measure(root: Locator): Promise<{ tokens: Record<Rhythm, number>; gaps: Gap[] }> {
  return root.evaluate((el, tokenNames) => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const tokens = Object.fromEntries(
      Object.entries(tokenNames).map(([rhythm, token]) => {
        probe.style.height = `var(${token})`;
        return [rhythm, probe.getBoundingClientRect().height];
      }),
    ) as Record<'row' | 'group' | 'section', number>;
    probe.remove();
    const label = (b: Element): string => b.getAttribute('data-slot') ?? b.getAttribute('data-testid') ?? b.getAttribute('data-reading') ?? b.tagName.toLowerCase();
    const drawn = (b: Element): boolean => {
      const r = b.getBoundingClientRect();
      return r.height > 0 && b.checkVisibility();
    };
    const blocks = Array.from(el.querySelectorAll('[data-rhythm]')).filter(drawn);
    const scopes = new Map<Element | null, Element[]>();
    for (const b of blocks) {
      const scope = b.parentElement?.closest('[data-rhythm]') ?? null;
      scopes.set(scope, [...(scopes.get(scope) ?? []), b]);
    }
    const gaps: { above: string; below: string; rhythm: 'row' | 'group' | 'section'; gap: number }[] = [];
    for (const list of scopes.values()) {
      for (let i = 1; i < list.length; i++) {
        const above = list[i - 1];
        const below = list[i];
        if (!above || !below) continue;
        gaps.push({
          above: label(above),
          below: label(below),
          rhythm: below.getAttribute('data-rhythm') as 'row' | 'group' | 'section',
          gap: below.getBoundingClientRect().top - above.getBoundingClientRect().bottom,
        });
      }
    }
    return { tokens, gaps };
  }, TOKEN);
}

for (const locale of LOCALES) {
  test.describe(`FR-FLOW-10 at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE });

    for (const flow of FLOW_CASES) {
      test(`the ${caseName(flow)} page keeps three gaps`, async ({ page }) => {
        const root = await openFlowPage(page, flow.page, locale, flow.view);
        const { tokens, gaps } = await measure(root);
        expect(gaps.length, 'marked blocks on the page').toBeGreaterThan(0);
        const wrong = gaps.filter(({ rhythm, gap }) => Math.abs(gap - tokens[rhythm]) > 1).map(({ above, below, rhythm, gap }) => `${above} → ${below}: ${gap.toFixed(1)} px, ${rhythm} is ${String(tokens[rhythm])} px`);
        expect(wrong).toEqual([]);
        // row ≤ group ≤ section, as measured.
        const widest = (r: Rhythm): number => Math.max(-Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
        const narrowest = (r: Rhythm): number => Math.min(Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
        expect(widest('row')).toBeLessThanOrEqual(narrowest('group') + 1);
        expect(widest('row')).toBeLessThanOrEqual(narrowest('section') + 1);
        expect(widest('group')).toBeLessThanOrEqual(narrowest('section') + 1);
      });
    }
  });
}
