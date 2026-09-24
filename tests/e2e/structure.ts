/**
 * R92 (FR-A11Y-1, FR-A11Y-2; D-530): the one helper the structure assertions share — landmark counts, the
 * ordered outline, no skipped level, and the cap on `h2`. DOM queries in the page, no axe (V21-2; the axe run
 * is R96's).
 */
import type { Page } from '@playwright/test';
import { skippedLevels, type Outline } from '../support/outline';

export { skippedLevels };

/** FR-A11Y-2: no page has more `h2` than this. */
export const A11Y_MAX_H2 = 10;

export interface LandmarkCounts {
  main: number;
  h1: number;
  banner: number;
  navigation: number;
  contentinfo: number;
}

/**
 * How many of each landmark the page has. A `header` or `footer` is the page's `banner` or `contentinfo` only
 * outside sectioning content (HTML-AAM), so one inside an `article` or a `section` is not counted.
 */
export function landmarkCounts(page: Page): Promise<LandmarkCounts> {
  return page.evaluate(() => {
    const topLevel = (selector: string): number =>
      Array.from(document.querySelectorAll(selector)).filter((element) => element.parentElement?.closest('article, aside, main, nav, section') == null).length;
    return {
      main: document.querySelectorAll('main, [role="main"]').length,
      h1: document.querySelectorAll('h1').length,
      banner: topLevel('header'),
      navigation: document.querySelectorAll('nav, [role="navigation"]').length,
      contentinfo: topLevel('footer'),
    };
  });
}

/**
 * The outline a screen reader walks: every heading in document order that is in the accessibility tree — not
 * inside `hidden`, `display: none` or `aria-hidden="true"` — as `[level, text]`.
 */
export function pageOutline(page: Page): Promise<Outline> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
      .filter((heading) => heading.checkVisibility() && heading.closest('[aria-hidden="true"]') === null)
      .map((heading): [number, string] => [Number(heading.tagName.slice(1)), (heading.textContent ?? '').trim()]),
  );
}
