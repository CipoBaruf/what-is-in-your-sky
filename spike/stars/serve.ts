/**
 * R111: the Vite dev server and a Chromium page for the spike's measuring
 * scripts, as `spike/window/capture.ts` starts them.
 */
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

export const PORT = 5198;
export const url = (query: string): string => `http://localhost:${String(PORT)}/spike/stars/?${query}`;

export async function startServer(): Promise<ViteDevServer> {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  return server;
}

export async function withBrowser<T>(run: (open: (options: BrowserContextOptions) => Promise<Page>) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch();
  try {
    return await run(async (options) => (await browser.newContext(options)).newPage());
  } finally {
    await browser.close();
  }
}

/** Opens the page and waits for the catalogue, the fonts and one drawn frame. */
export async function load(page: Page, query: string): Promise<void> {
  await page.goto(url(query));
  await page.waitForFunction(() => (window as unknown as { __stars?: { ready: boolean } }).__stars?.ready === true);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(300);
}
