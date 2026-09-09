/**
 * R63 captures (FR-FSC-4, US-21 AC12): the window on the follow screen with
 * the phone held upright, at 390 × 844 in both themes and both languages, and
 * one landscape shot at 844 × 390 for the contrast. Evidence for the PR, not a
 * test — the assertions only make sure the shot shows the state it is named
 * after.
 *
 * R73 (FR-FSC-4 as rewritten, FR-FSC-11; D-427, D-428): the upright state is a
 * picture now, so the guard that used to insist nothing was painted in the
 * drawing is the opposite check — that the drawing is there, with the advice
 * line over it. The shots themselves are R63's evidence and are not re-taken;
 * the v1 set's `sky-screen-portrait` pair, shot through the real page, is what
 * v1.4.1 re-shoots (FR-FSC-7).
 *
 *   npx tsx spike/window/screen-capture.ts
 *
 * It runs from a harness page (`screen.tsx`) rather than from the app, because
 * neither the chart's `screen` mode (R62) nor the follow screen (R64) exists
 * yet: R63 is the window's half of the screen, and this is the only way to put
 * a camera on it in wave 1. When R64 lands, `v1-captures.spec.ts` shoots
 * `follow-screen-390-portrait-*` through the real page (D-326) and these are
 * superseded.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const OUT = resolve('docs/screenshots');
const PORT = 5198;
const THEMES = ['dark', 'night'] as const;
const LOCALES = ['en', 'es'] as const;
/** The copy of `i18n/{en,es}/window.ts`, repeated here so a shot named "portrait" cannot be of anything else. */
const NOTE = { en: 'Turn the phone sideways to see more sky.', es: 'Gira el teléfono de lado para ver más cielo.' } as const;

const url = (theme: string, locale: string): string => `http://localhost:${String(PORT)}/spike/window/screen.html?theme=${theme}&locale=${locale}`;

async function shoot(page: Page, theme: (typeof THEMES)[number], locale: (typeof LOCALES)[number]): Promise<string> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url(theme, locale));
  const w = page.locator('[data-look-az]');
  await w.waitFor({ state: 'attached' });
  if ((await w.getAttribute('data-orientation')) !== 'portrait') throw new Error('the harness is not in the portrait box');
  const note = page.getByTestId('window-turn-note');
  await note.waitFor();
  if ((await note.textContent()) !== NOTE[locale]) throw new Error(`the advice is not the ${locale} one`);
  // R73 (FR-FSC-4 as rewritten): the picture is drawn in the portrait box, and the advice stands over it.
  await page.locator('[data-horizon]').waitFor();
  if ((await page.locator('[data-drawing="window"] *').count()) === 0) throw new Error('nothing is painted in the drawing');
  const name = `r63-window-390-portrait-${theme}-${locale}.png`;
  await page.screenshot({ path: resolve(OUT, name) });
  return name;
}

/** One shot of the phone turned, so the pair reads as the two states of the same screen. */
async function shootLandscape(page: Page): Promise<string> {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(url('dark', 'en'));
  const w = page.locator('[data-look-az]');
  await w.waitFor({ state: 'attached' });
  if ((await w.getAttribute('data-orientation')) !== 'landscape') throw new Error('the harness is not in the landscape box');
  if ((await page.getByTestId('window-turn-note').count()) !== 0) throw new Error('the advice is still up with the box wider than it is tall');
  await page.locator('[data-horizon]').waitFor();
  const name = 'r63-window-844-landscape-dark-en.png';
  await page.screenshot({ path: resolve(OUT, name) });
  return name;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server: ViteDevServer = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const shots: string[] = [];
    for (const theme of THEMES) for (const locale of LOCALES) shots.push(await shoot(page, theme, locale));
    shots.push(await shootLandscape(page));
    for (const shot of shots) console.log(`docs/screenshots/${shot}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
