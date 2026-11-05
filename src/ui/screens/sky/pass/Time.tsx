import type { EpochMs, Pass } from '../../../../model';
import { Countdown } from '../../../components/common/Countdown';

/**
 * R186 (FR-WIDE-1, D-1098): the wide pass detail's `Time` row — today's, the countdown to the pass at the clock's
 * instant. R187 puts the shared time control here, the pass's rise, peak and set as buttons.
 */
export function PassTime({ pass, now, timeZone }: { pass: Pass; now: EpochMs; timeZone: string | null }) {
  return (
    <div data-testid="pass-time">
      <Countdown pass={pass} now={now} timeZone={timeZone} steps={false} />
    </div>
  );
}
