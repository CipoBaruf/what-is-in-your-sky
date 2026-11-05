import { useT } from '../../../i18n/useT';
import { AskDialog } from './AskDialog';
import type { Follow } from './useFollow';

/**
 * v2.14.2 (FR-PHONE-17, V214-39, V214-44; D-1142, D-1144): a phone page's question before it follows the phone —
 * "Use your phone to look at the sky?" over `[ allow ]` and `[ not now ]`. Rendered by the live page, the stars page
 * and the pass detail while their `useFollow` is `asking`; `[ allow ]` asks the browser inside its click, and
 * `[ not now ]` and `Esc` leave the page as it opened.
 */
export function FollowAsk({ follow }: { follow: Pick<Follow, 'asking' | 'allow' | 'notNow'> }) {
  const words = useT().sheet.followAsk;
  if (!follow.asking) return null;
  return (
    <AskDialog
      question={words.question}
      yes={words.allow}
      no={words.notNow}
      onYes={follow.allow}
      onNo={follow.notNow}
      testId="follow-ask"
      yesTestId="follow-ask-allow"
      noTestId="follow-ask-not-now"
    />
  );
}
