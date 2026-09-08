/**
 * R63 (FR-FSC-4, US-21 AC12, D-323): the capture harness for the window's
 * portrait state. The follow screen itself is R64's and the chart's `screen`
 * mode is R62's, so between them there is no page in the app that renders the
 * window with `screen` — and this state is only reachable with it. This page
 * mounts the production `SkyWindow` (not the R38 spike's) with the prop set,
 * in the app's own tokens and global stylesheet, so the shot is the component
 * and not a mock-up of it. `screen-capture.ts` drives it:
 *
 *   npx tsx spike/window/screen-capture.ts
 *
 * Two knobs, both query parameters: `locale` (en, es) and `theme` (dark,
 * night). The viewport decides the state — held upright the box is the note,
 * turned sideways it is the drawing — so the capture script sets the size and
 * this page sets nothing. Not part of the production build: `vite build`
 * bundles the root `index.html` only, so `dist/` never contains this page.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyLocale, I18nProvider } from '../../src/i18n/useT';
import type { Locale, Observer, Theme } from '../../src/model';
import { SkyWindow } from '../../src/ui/components/guide/skychart/window/SkyWindow';
import { applyTheme } from '../../src/ui/styles/theme';
import '../../src/ui/styles/tokens.css';
import '../../src/ui/styles/global.css';

/** Paris, as `tests/e2e/observers.ts` has it: only the declination lookup reads it, and the portrait box shows none of that. */
const OBSERVER: Observer = { lat: 48.8566, lon: 2.3522, altM: 35, label: 'Paris', source: 'coords', timeZone: 'Europe/Paris' };

const query = new URLSearchParams(window.location.search);
const locale = (query.get('locale') === 'es' ? 'es' : 'en') as Locale;
const theme = (query.get('theme') === 'night' ? 'night' : 'dark') as Theme;

applyLocale(locale);
applyTheme(theme);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from screen.html');

/*
 * D-322's frame is R62's, so the layer here is only as much of it as this task
 * can honestly show: the visual viewport, and `--page-pad-x` at zero, which is
 * what takes the compact frame's full-bleed margins off the drawing. The rows
 * the frame still keeps for the controls and the status are R62's to drop.
 * What is being shot is what the *window* puts in that layer.
 */
createRoot(root).render(
  <StrictMode>
    <I18nProvider locale={locale}>
      <div style={{ position: 'fixed', inset: 0, '--page-pad-x': '0px' } as React.CSSProperties} data-testid="follow-layer">
        <SkyWindow {...({ screen: true } as { screen?: boolean })} fill passes={[]} observer={OBSERVER} highlightedPassId={null} />
      </div>
    </I18nProvider>
  </StrictMode>,
);
