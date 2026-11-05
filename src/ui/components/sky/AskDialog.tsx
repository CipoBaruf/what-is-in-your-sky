import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOpenerFocus } from '../../hooks/useOpenerFocus';
import { TextButton } from '../primitives/TextButton';
import styles from './AskDialog.module.css';

/**
 * v2.14.2 (FR-PHONE-17, FR-WIDE-13; D-1142, D-1140): a page's yes-or-no question as a modal dialog — the wide live
 * page's first-pass question and a phone page's follow question. A portal to the body, focus on the first button on
 * open and back to the opener on close (`useOpenerFocus`), and the rest of the document `inert` while it is up, so
 * nothing behind it is reachable.
 *
 * `Esc` is the second answer. The keys are taken on the window's capture phase while it is up, so `Esc` does not also
 * leave the page and no page key (`v`, `g`, Space…) acts on the page behind; the buttons' own activation is the
 * browser's default action, which this does not prevent. Pure display: the page decides when it shows and what each
 * answer does.
 */
export interface AskDialogProps {
  question: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  /** The test ids' stem: `<testId>`, `<testId>-overlay`, and the buttons' `yes` / `no` ids. */
  testId: string;
  yesTestId: string;
  noTestId: string;
}

export function AskDialog({ question, yes, no, onYes, onNo, testId, yesTestId, noTestId }: AskDialogProps) {
  const questionId = useId();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const noRef = useRef(onNo);
  useEffect(() => {
    noRef.current = onNo;
  });
  useEffect(() => {
    const own = root.current;
    // The document behind is inert while the dialog is up: every child of the body but the dialog's own.
    const made: Element[] = [];
    for (const child of document.body.children) {
      if (own !== null && child.contains(own)) continue;
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      made.push(child);
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') return;
      event.stopImmediatePropagation();
      if (event.key !== 'Escape') return;
      event.preventDefault();
      noRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      for (const child of made) child.removeAttribute('inert');
    };
  }, []);
  // After the effect above, so on close the document is no longer inert when the opener takes focus back.
  useOpenerFocus(first);
  return createPortal(
    <div className={styles.overlay} data-testid={`${testId}-overlay`}>
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby={questionId} className={styles.frame} data-testid={testId}>
        <p id={questionId} className={styles.question}>
          {question}
        </p>
        <div className={styles.actions}>
          <TextButton label={yes} className="target" ref={first} data-testid={yesTestId} onClick={onYes} />
          <TextButton label={no} className="target" data-testid={noTestId} onClick={onNo} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
