import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../../i18n/useT';
import { useOpenerFocus } from '../../hooks/useOpenerFocus';
import { TextButton } from '../primitives/TextButton';
import styles from './FirstPassDialog.module.css';

/**
 * v2.14.1 (FR-WIDE-13, V214-31; D-1140): the wide live page's question when it opens with nothing up — "Nothing is up
 * right now. Go to the first pass and play?" over `[ go and play ]` and `[ stay here ]`. A modal dialog from the
 * shortcuts overlay's parts: a portal to the body, focus on the first button on open and back to the opener on
 * close (`useOpenerFocus`), and the rest of the document `inert` while it is up, so nothing behind it is reachable.
 *
 * `Esc` is `[ stay here ]`. The keys are taken on the window's capture phase while it is up, so `Esc` does not also
 * leave the page (`Live`'s own listener) and no page key (`v`, `g`, Space…) acts on the page behind; the buttons'
 * own activation is the browser's default action, which this does not prevent. Pure display: the page decides
 * when it shows and what each answer does.
 */
export interface FirstPassDialogProps {
  onGo: () => void;
  onStay: () => void;
}

export function FirstPassDialog({ onGo, onStay }: FirstPassDialogProps) {
  const t = useT();
  const words = t.live.firstPass;
  const questionId = useId();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const stayRef = useRef(onStay);
  useEffect(() => {
    stayRef.current = onStay;
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
      stayRef.current();
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
    <div className={styles.overlay} data-testid="first-pass-dialog-overlay">
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby={questionId} className={styles.frame} data-testid="first-pass-dialog">
        <p id={questionId} className={styles.question}>
          {words.question}
        </p>
        <div className={styles.actions}>
          <TextButton label={words.go} className="target" ref={first} data-testid="first-pass-go" onClick={onGo} />
          <TextButton label={words.stay} className="target" data-testid="first-pass-stay" onClick={onStay} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
