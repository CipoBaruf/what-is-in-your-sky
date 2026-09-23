import type { FailureKind } from '../../state/failure';

/**
 * R89 (FR-FAIL-1, FR-FAIL-2, D-540): the failure line's words. A slice stores
 * a `Failure` — a kind and the raw detail — and the sentence is chosen here at
 * draw time, so a language switch re-renders it. `what` is what could not be
 * done, as a verb phrase ("load the orbital elements"), so each language puts
 * it where its own sentence wants it. No status code, exception name or
 * provider message is ever in a sentence: those are the detail, which only
 * `[ details ]` shows. R91 adds the other places' `what`s.
 */
export const failure = {
  failure: {
    offline: (what: string) => `Could not ${what}: this device is offline.`,
    'rate-limited': (what: string) => `Could not ${what}: the service is busy with too many requests. Try again in a minute.`,
    server: (what: string) => `Could not ${what}: the service is having trouble.`,
    'bad-data': (what: string) => `Could not ${what}: the answer that came back was not usable.`,
    timeout: (what: string) => `Could not ${what}: the service took too long to answer.`,
    unknown: (what: string) => `Could not ${what}.`,
    retry: 'retry',
    details: 'details',
    /** The accessible name of the detail's text, which is the raw message and in no language. */
    detailLabel: 'What went wrong, as reported',
    what: {
      elements: 'load the orbital elements',
      /** R91: the forecast's cloud row. */
      forecast: 'load the cloud forecast',
      /** R91: the place search. */
      search: 'search for places',
      /** R91: the pass computation, where "Computing…" was (FR-FAIL-4). */
      passes: 'compute the passes',
    },
    /** R91: what the page is using instead, the line's second sentence, where it is using anything. */
    instead: {
      /** A stored or earlier run is still the list on screen. */
      storedList: 'The list below is the last one computed.',
      /** A refresh failed and the snapshot on screen stays (FR-FAIL-3). */
      lastForecast: 'The clouds shown are from the last forecast.',
      /** No snapshot at all: every verdict reads unknown (US-7 AC4). */
      noForecast: 'Cloud cover reads as unknown.',
    },
  } satisfies Record<FailureKind, (what: string) => string> & Record<string, unknown>,
  /**
   * R91 (FR-FAIL-5, D-544): the root boundary's words beside the header's title (`app.title`). `RootBoundary`
   * imports both catalogs directly, since a render error may have taken the provider with it.
   */
  boundary: {
    sentence: 'Something broke on this page.',
    reload: 'reload',
    details: 'details',
  },
};
