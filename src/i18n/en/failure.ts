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
    },
  } satisfies Record<FailureKind, (what: string) => string> & Record<string, unknown>,
};
