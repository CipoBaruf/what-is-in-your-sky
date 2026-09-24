/**
 * R96 (FR-A11Y-7, FR-X-5; D-622; OQ-35's contrast half): an axe run over every route, at a phone's width and a
 * desk's, in the dark and the night theme, with the WCAG 2.0/2.1 A and AA rules — `color-contrast` among them, so
 * FR-X-5's AA claim is measured in the default theme as the tokens test measures it for night.
 *
 * Six screens × two widths × two themes, one `AxeBuilder` each. The character grids are not excluded by
 * selector: they are hidden from assistive technology already (FR-GUIDE-7), and axe is left to agree.
 *
 * `bypassCSP`, for this file only: axe works by injecting its script into the page, and the strict CSP the
 * production build ships with (D-75, which every other spec runs under) refuses it. The CSP itself is
 * `deploy-headers.spec.ts`'s subject, not this one's.
 *
 * The DOM-query assertions in `structure.spec.ts` stay (FR-A11Y-1..5): they say what the structure is, where
 * axe only says nothing is wrong with it.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON } from './observers';
import { enterScrubbing, seedStoredRun, stubNetwork } from './liveHelpers';

/** FR-A11Y-7: the WCAG 2.0 and 2.1 A and AA rules. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Rules this run does not apply, each with why and the finding (SPEC §4.20) that tracks it. An entry with
 * `nodes` disables its rule only on the elements that selector matches, so the rule keeps measuring the rest
 * of the page; one without is off everywhere.
 */
export const AXE_DISABLED_RULES: readonly { rule: string; nodes?: string; reason: string; finding: string }[] = [
  {
    rule: 'color-contrast',
    nodes: '[data-hotspot-id^="tick-"] > *, [data-hotspot-id^="ring-"] > *',
    reason:
      "The dome's degree labels are drawn in --chart-rings, a 3:1 non-text token, at 0.8 opacity: 2.7:1 in dark, 2.53:1 in night. The fix is in the chart lane's SkyDome, which R96 does not touch.",
    finding: 'F-98',
  },
];

const OFF_EVERYWHERE = AXE_DISABLED_RULES.filter(({ nodes }) => nodes === undefined).map(({ rule }) => rule);
const OFF_ON_NODES = AXE_DISABLED_RULES.filter((entry): entry is (typeof AXE_DISABLED_RULES)[number] & { nodes: string } => entry.nodes !== undefined);

/** Whether the element axe names by `target` is one an entry excuses from `rule`. */
function excused(page: Page, rule: string, target: string): Promise<boolean> {
  const selectors = OFF_ON_NODES.filter((entry) => entry.rule === rule).map(({ nodes }) => nodes);
  if (selectors.length === 0) return Promise.resolve(false);
  return page.evaluate(([target, selectors]) => {
    const element = document.querySelector(target);
    return element !== null && selectors.some((selector) => element.matches(selector));
  }, [target, selectors] as [string, string[]]);
}

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
] as const;
const THEMES = ['dark', 'night'] as const;
type Theme = (typeof THEMES)[number];

const PREFS_KEY = 'wiys:prefs:v1';

/** The guide: the sheet over the list on a phone, the panel beside it on a desk. */
const guide = (page: Page) => page.locator('[role="dialog"][data-pass-id]').or(page.getByTestId('guide-panel'));

async function toLive(page: Page, theme: Theme): Promise<void> {
  await seedStoredRun(page, { prefs: { theme } });
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
  await expect(page.getByTestId('live-dome').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
}

const SCREENS: { name: string; open: (page: Page, theme: Theme) => Promise<void> }[] = [
  {
    name: 'home, cold',
    open: async (page, theme) => {
      await page.clock.setFixedTime(NINE_DAYS_ON);
      await stubNetwork(page);
      await page.addInitScript(([key, value]: [string, string]) => localStorage.setItem(key, value), [PREFS_KEY, JSON.stringify({ locale: 'en', theme })] as [string, string]);
      await page.goto('/');
      await expect(page.getByTestId('cold-open')).toBeVisible();
    },
  },
  {
    name: 'home, populated',
    open: async (page, theme) => {
      await seedStoredRun(page, { prefs: { theme }, settled: true });
    },
  },
  {
    name: 'the open guide',
    open: async (page, theme) => {
      await seedStoredRun(page, { prefs: { theme }, settled: true });
      await page.getByRole('button', { name: 'Open guide' }).first().click();
      await expect(guide(page)).toBeVisible();
      await expect(guide(page).locator('pre.glyph-output').first()).toBeVisible({ timeout: 30_000 });
    },
  },
  {
    name: '#live, watching',
    open: toLive,
  },
  {
    name: '#live, scrubbing',
    open: async (page, theme) => {
      await toLive(page, theme);
      await enterScrubbing(page);
    },
  },
  {
    name: '#settings',
    open: async (page, theme) => {
      await seedStoredRun(page, { prefs: { theme } });
      await page.evaluate(() => {
        window.location.hash = 'settings';
      });
      await expect(page.getByTestId('settings-back')).toBeVisible();
    },
  },
];

test.use({ bypassCSP: true, serviceWorkers: 'block' });

for (const viewport of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`at ${String(viewport.width)} px, ${theme}`, () => {
      test.use({ viewport });

      for (const screen of SCREENS) {
        test(`${screen.name} has no WCAG A/AA violation (FR-A11Y-7)`, async ({ page }) => {
          await screen.open(page, theme);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(OFF_EVERYWHERE).analyze();
          const violations = [];
          for (const { id, impact, help, nodes } of results.violations) {
            const left = [];
            for (const { target, failureSummary } of nodes) {
              const selector = target.join(' ');
              if (!(await excused(page, id, selector))) left.push({ target: selector, failureSummary });
            }
            if (left.length > 0) violations.push({ id, impact, help, nodes: left });
          }
          expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
        });
      }
    });
  }
}
