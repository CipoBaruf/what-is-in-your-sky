import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import styles from './ShareButton.module.css';

/**
 * R31 (US-12, FR-SHARE-2): one action, two paths. Where the browser has a
 * share sheet (`navigator.share`, phones and Safari) the title, the guide
 * sentence and the URL go to it; everywhere else the URL goes to the clipboard
 * and the button confirms it inline, because a copy with no confirmation is
 * indistinguishable from a dead button.
 *
 * The caller owns the strings: the URL comes from `lib/shareLinks.ts` and the
 * text is the FR-GUIDE-1 sentence for this pass, so the recipient reads what
 * they are being sent before opening it. R32's live share will hand this the
 * same three props with `#live?…` in them.
 *
 * A dismissed share sheet is not a failure — `AbortError` means the person
 * changed their mind, so nothing is said and nothing is copied. Any other
 * refusal (a browser that lists `share` but rejects the payload) falls through
 * to the clipboard, and a refused clipboard shows the link to copy by hand:
 * on this screen the link *is* the feature, so it is never left unreachable.
 */
export interface ShareButtonProps {
  /** The absolute URL to share (`shareUrl(location.href, …)`). */
  url: string;
  title: string;
  text: string;
  /** The button's own words; defaults to "Share this pass". */
  label?: string;
}

/** How long the inline confirmation stays. Long enough to read, short enough not to outlive the action. */
export const CONFIRMATION_MS = 4000;

type Confirmation = 'idle' | 'copied' | 'failed';

export function ShareButton({ url, title, text, label }: ShareButtonProps) {
  const t = useT();
  const [confirmation, setConfirmation] = useState<Confirmation>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const confirm = (next: Confirmation): void => {
    setConfirmation(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setConfirmation('idle');
    }, CONFIRMATION_MS);
  };

  const onClick = async (): Promise<void> => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      confirm('copied');
    } catch {
      confirm('failed');
    }
  };

  return (
    <p className={styles.share}>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          void onClick();
        }}
      >
        {label ?? t.share.pass}
      </button>
      {/* Live from the first render, so the confirmation is announced when it arrives rather than when the region does. */}
      <span role="status" className={styles.confirmation} data-testid="share-status">
        {confirmation === 'copied' && t.share.copied}
        {confirmation === 'failed' && (
          <>
            {t.share.copyFailed} <code className={styles.url}>{url}</code>
          </>
        )}
      </span>
    </p>
  );
}
