import type { Messages } from '../i18n/messages';

/**
 * R92 (FR-A11Y-3, D-531): the document title of each route, in the active
 * language. Home is the bare app title; every other route is its own name, then
 * the app's — "Live sky · …", "Settings · …", and for an open pass the
 * satellite and its start time, already formatted by the caller in the
 * observer's zone and the active language.
 *
 * Pure: the shell's effect is what writes it to `document.title`, and the
 * announcer reads the same string, so what is said on a route change is what
 * the tab says.
 */
export type RouteName = 'home' | 'live' | 'settings' | 'pass';

export interface TitledPass {
  name: string;
  /** The start time as the page shows it, e.g. `2026-09-11 21:14`. */
  time: string;
}

export function routeTitle(route: RouteName, t: Messages, pass?: TitledPass | null): string {
  const app = t.app.title;
  switch (route) {
    case 'home':
      return app;
    case 'live':
      return t.a11y.title({ route: t.live.open, app });
    case 'settings':
      return t.a11y.title({ route: t.settings.heading, app });
    case 'pass':
      // A pass the run has not produced yet (or no longer has) has no name to give: the tab says the app.
      return pass ? t.a11y.title({ route: t.a11y.pass(pass), app }) : app;
  }
}
