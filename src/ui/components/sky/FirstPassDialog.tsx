import { useT } from '../../../i18n/useT';
import { AskDialog } from './AskDialog';

/**
 * v2.14.1 (FR-WIDE-13, V214-31; D-1140): the wide live page's question when it opens with nothing up — "Nothing is up
 * right now. Go to the first pass and play?" over `[ go and play ]` and `[ stay here ]`; `Esc` is `[ stay here ]`.
 * Since v2.14.2 (D-1142) the dialog itself is `AskDialog`, shared with the phone's follow question.
 */
export interface FirstPassDialogProps {
  onGo: () => void;
  onStay: () => void;
}

export function FirstPassDialog({ onGo, onStay }: FirstPassDialogProps) {
  const words = useT().live.firstPass;
  return (
    <AskDialog
      question={words.question}
      yes={words.go}
      no={words.stay}
      onYes={onGo}
      onNo={onStay}
      testId="first-pass-dialog"
      yesTestId="first-pass-go"
      noTestId="first-pass-stay"
    />
  );
}
