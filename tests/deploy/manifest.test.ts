/**
 * R25 (FR-OFF-6, D-127): the install audit, as a unit test. Chromium will
 * only offer to install a page whose manifest parses, is same-origin, names
 * the app, starts somewhere inside its own scope, asks for `standalone`, and
 * carries a PNG icon of at least 192 px and one of 512 px — so those are the
 * assertions, read off the file the site actually serves rather than off a
 * config object. The e2e half (the link resolves, the icons are precached,
 * the audit passes at 390 px) is in `tests/e2e/pwa.spec.ts`.
 *
 * The two icons are checked by reading their PNG headers: `scripts/build-icons.ts`
 * draws them from the design tokens and a wrong `sizes` in the manifest is the
 * one mistake the browser reports as "no suitable icon" and nothing else catches.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { png } from '../../scripts/build-icons';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
interface Manifest {
  id: string;
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

const MANIFEST = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as Manifest;
const TOKENS = readFileSync('src/ui/styles/tokens.css', 'utf8');

/** Width and height out of a PNG's IHDR, which is always the first chunk. */
function pngSize(file: string): { width: number; height: number; png: boolean } {
  const bytes = readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    png: bytes.subarray(0, 8).equals(signature) && bytes.toString('latin1', 12, 16) === 'IHDR',
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

/** The value of a token in `:root`, i.e. the dark theme (D-84). */
function darkToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(TOKENS.slice(TOKENS.indexOf(':root')));
  if (!match?.[1]) throw new Error(`no --${name} in tokens.css`);
  return match[1];
}

describe('public/manifest.webmanifest', () => {
  it('names the app once, in one language (FR-OFF-6)', () => {
    expect(MANIFEST.name).toBe('What is in your sky right now');
    expect(MANIFEST.short_name.length).toBeLessThanOrEqual(12); // what a launcher shows under the icon
    expect(MANIFEST.lang).toBe('en');
    // Not localised: the file is one object, not a map of languages, and carries no Spanish.
    expect(JSON.stringify(MANIFEST)).not.toMatch(/"es"|cielo/i);
  });

  it('installs standalone from the root, in the dark theme colour', () => {
    expect(MANIFEST.display).toBe('standalone');
    expect(MANIFEST.start_url).toBe('/');
    expect(MANIFEST.scope).toBe('/');
    expect(MANIFEST.start_url.startsWith(MANIFEST.scope)).toBe(true);
    expect(MANIFEST.theme_color).toBe(darkToken('bg'));
    expect(MANIFEST.background_color).toBe(darkToken('bg'));
  });

  it('carries the 192 and 512 px PNGs the install audit asks for', () => {
    expect(MANIFEST.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of MANIFEST.icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.purpose).toBe('any');
      expect(icon.src.startsWith('/')).toBe(true);
      const declared = Number(icon.sizes.split('x')[0]);
      const actual = pngSize(`public${icon.src}`);
      expect(actual.png, `${icon.src} is not a PNG`).toBe(true);
      expect([actual.width, actual.height], `${icon.src} is not ${icon.sizes}`).toEqual([declared, declared]);
    }
  });

  it('ships the icons `scripts/build-icons.ts` draws, and not something hand-edited', () => {
    for (const icon of MANIFEST.icons) {
      const size = Number(icon.sizes.split('x')[0]);
      expect(readFileSync(`public${icon.src}`).equals(png(size)), `${icon.src} is stale; run npm run build:icons`).toBe(true);
    }
  });

  it('is linked from index.html, with the icon Safari installs from', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icon-192\.png" \/>/);
  });
});
