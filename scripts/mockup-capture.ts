/**
 * FR-DESK-5: regenerate the desktop mockup's captures from
 * `docs/mockups/desktop-1280.html`, one per theme, at the 1280 px width the
 * `visual-review` skill uses for desktop. The mockup links the app's own
 * `tokens.css` and `global.css`, so a token change is picked up here the same
 * way it is in the app and the reference never drifts from the palette.
 *
 *   npm run mockup:desktop
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = resolve('docs/mockups');
const SOURCE = pathToFileURL(resolve(OUT, 'desktop-1280.html')).href;
/** 1280 px of page plus the scrollbar gutter, so a frame is exactly 1280 px wide. */
const VIEWPORT = { width: 1320, height: 1000 };
const THEMES = ['dark', 'night'] as const;

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    for (const theme of THEMES) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
      await page.goto(SOURCE);
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await page.evaluate(() => document.fonts.ready);
      const path = resolve(OUT, `desktop-1280-${theme}.png`);
      await page.screenshot({ path, fullPage: true });
      console.log(path);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

await main();
