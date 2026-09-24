import { useId, useState, type ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import type { Failure } from '../../../state/failure';
import styles from './FailureLine.module.css';

/**
 * R89 (FR-FAIL-1, FR-FAIL-2, D-540): the failure line. Where a load or a job
 * failed, the place its result would have been says so in one line: a sentence
 * in the active language — `t.failure[kind](what)`, then what the page is
 * using instead when it is using anything — then `[ retry ]`, then
 * `[ details ]`. The sentence is chosen at draw time from the stored kind, so
 * a language switch re-renders it, and it never carries a status code, an
 * exception name or a provider message: those are `detail`, shown only inside
 * the disclosure, in monospace, as selectable text a reader can copy.
 *
 * `[ retry ]` is the slice's retry action (D-541), a full button, so it is
 * FR-FAIL-1's 48 px control on compact; the caller shows the loading state
 * the retry puts the slice in. The live page places it first (R89); R91 places
 * it everywhere else.
 */
export interface FailureLineProps {
  failure: Failure;
  /** What could not be done, as the catalog's verb phrase (`t.failure.what.*`). */
  what: string;
  /** What the page is using instead, when it is using anything; one sentence, which may carry a link (the place search's). */
  instead?: ReactNode;
  /** R91: which place failed (`elements`, `passes`, `forecast`, `search`, `live`), for tests and captures where two lines share a page. */
  site?: string;
  onRetry: () => void;
}

export function FailureLine({ failure, what, instead, site, onRetry }: FailureLineProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <div className={styles.line} data-testid="failure-line" data-kind={failure.kind} data-site={site}>
      <p className={styles.sentence} data-testid="failure-sentence">
        {t.failure[failure.kind](what)}
        {instead === undefined ? null : <> {instead}</>}
      </p>
      <span className={styles.actions}>
        <button type="button" className={styles.retry} data-testid="failure-retry" onClick={onRetry}>
          {t.failure.retry}
        </button>
        <button
          type="button"
          className={`inline-control ${styles.details}`}
          aria-expanded={open}
          aria-controls={detailId}
          data-testid="failure-details"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {t.failure.details}
        </button>
      </span>
      <pre id={detailId} hidden={!open} className={styles.detail} aria-label={t.failure.detailLabel} data-testid="failure-detail">
        {failure.detail}
      </pre>
    </div>
  );
}
