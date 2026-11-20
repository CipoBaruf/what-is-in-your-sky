import { useT } from '../../../i18n/useT';
import { usePageObserver } from '../../hooks/useOwnObserver';
import { requestPlace } from '../../screens/home/placeRequest';
import { Line } from '../primitives/Line';
import { TextButton } from '../primitives/TextButton';

/**
 * R203 (FR-OPEN-7; D-1180, D-1205): while a page opens for the example, one line under the header says so —
 * `Example: <city>, from your time zone · [ set your place ]` at `--small` — and its control opens the place
 * question on the home (`requestPlace`, F-75's way back), which draws it with `[ back ]` over the example.
 * Nothing while a place is set or visited, or once the fallback has replaced the example (FR-OPEN-6).
 * The home does not draw it: the band there says the same (`PageNotices`' `example`). The phone's pass page, a sheet
 * over the home, draws it under its head (`className` places it there).
 */
export function ExampleNotice({ inert = false, className }: { inert?: boolean; className?: string | undefined }) {
  const t = useT();
  const observer = usePageObserver();
  if (observer?.source !== 'example') return null;
  return (
    <Line as="div" inert={inert} size="small" dot className={className} actions={<TextButton inline label={t.example.pageLine} data-testid="example-notice-set" onClick={requestPlace} />} data-testid="example-notice">
      {t.example.label(observer.label)}
    </Line>
  );
}
