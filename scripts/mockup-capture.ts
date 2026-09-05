/**
 * FR-DESK-5 and FR-COMP-6: regenerate the mockups' captures, one per theme,
 * from the pages under `docs/mockups/`. Both pages link the app's own
 * `tokens.css` and `global.css`, so a token change is picked up here the same
 * way it is in the app and the references never drift from the palette.
 *
 *   npm run mockup:desktop     # docs/mockups/desktop-1280.html
 *   npm run mockup:compact     # docs/mockups/compact-390.html
 *   tsx scripts/mockup-capture.ts   # both
 *
 * The desktop page is one full-page shot per theme: its frames are two states
 * of the same layout and are read side by side. The compact page is three
 * screens, and a phone screen is read on its own, so each frame is shot as an
 * element (`compact-390-<screen>-<theme>.png`, the names R52 and R51 name as
 * their precondition) at the 390 px viewport the app calls compact — the
 * app's own 960 px breakpoint has to *not* match while these are taken.
 */
import { chromium, type Browser } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = resolve('docs/mockups');
const THEMES = ['dark', 'night'] as const;

/** 1280 px of page plus the scrollbar gutter, so a frame is exactly 1280 px wide. */
const DESKTOP_VIEWPORT = { width: 1320, height: 1000 };
/** The 390 px of an iPhone 15 Pro, the width every compact capture is taken at. */
const COMPACT_VIEWPORT = { width: 390, height: 844 };
/** The compact page's frames, in the order they appear on it. */
const COMPACT_SCREENS = ['home', 'settings', 'detail'] as const;

/** One page in the given theme, with its fonts loaded, on the given mockup. */
async function openMockup(
  browser: Browser,
  file: string,
  viewport: { width: number; height: number },
  theme: string,
) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve(OUT, file)).href);
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function captureDesktop(browser: Browser): Promise<void> {
  for (const theme of THEMES) {
    const page = await openMockup(browser, 'desktop-1280.html', DESKTOP_VIEWPORT, theme);
    const path = resolve(OUT, `desktop-1280-${theme}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(path);
    await page.close();
  }
}

async function captureCompact(browser: Browser): Promise<void> {
  for (const theme of THEMES) {
    const page = await openMockup(browser, 'compact-390.html', COMPACT_VIEWPORT, theme);
    for (const screen of COMPACT_SCREENS) {
      const path = resolve(OUT, `compact-390-${screen}-${theme}.png`);
      await page.locator(`#${screen}`).screenshot({ path });
      console.log(path);
    }
    await page.close();
  }
}

const CAPTURES = { desktop: captureDesktop, compact: captureCompact };

async function main(): Promise<void> {
  const asked = process.argv.slice(2);
  const names = asked.length > 0 ? asked : Object.keys(CAPTURES);
  for (const name of names) {
    if (!(name in CAPTURES)) {
      throw new Error(`Unknown mockup "${name}". Known: ${Object.keys(CAPTURES).join(', ')}.`);
    }
  }
  const browser = await chromium.launch();
  try {
    for (const name of names) {
      await CAPTURES[name as keyof typeof CAPTURES](browser);
    }
  } finally {
    await browser.close();
  }
}

await main();
