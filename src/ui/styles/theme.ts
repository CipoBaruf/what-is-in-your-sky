import type { Theme } from '../../model';

/**
 * FR-THEME-1 / D-70 (R20): the palette is an attribute on the root element,
 * and `tokens.css` is what reads it — no component knows a theme exists
 * (D-84). This is the only place that writes it.
 *
 * "Applied before first paint" is met the way the language is: `main.tsx`
 * calls this with the store's theme *before* `createRoot().render()`, so the
 * first frame the browser composites already carries the attribute. An inline
 * bootstrap script is not an option under `script-src 'self'` (PLAN §11), and
 * would buy nothing — the app is client-rendered, so there is no
 * server-painted frame to correct.
 *
 * The dark theme is written out rather than left off: `[data-theme="dark"]`
 * is not a selector `tokens.css` needs, but a value on the element is what
 * lets `sky-theme.spec.ts` assert what is showing, and what stops a stale
 * `night` attribute from surviving a switch back.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset['theme'] = theme;
}
