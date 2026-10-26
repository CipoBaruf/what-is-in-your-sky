import { useCallback, useSyncExternalStore } from 'react';
import { useStarsPageT } from '../../../../../i18n/starsPageT';
import { useT } from '../../../../../i18n/useT';
import { ToggleGroup } from '../../../primitives/ToggleGroup';
import { PITCH_STEP_DEG } from '../dome/camera';
import { FACING_OPTIONS, facingOf, STARS_DEFAULT_TILT, STARS_TILT_MAX_DEG, type FacingOption, type HandCamera, type SkyAim } from './camera';

/**
 * R121 (FR-STAR-4, FR-SKY-2, FR-SKY-7; D-789, D-790): the facing picker — the
 * compact speeds' form (D-245), a cell between the options: `N NE E SE [S] SW
 * W NW up`, 24 cells in English and 28 in Spanish (FR-COMP-4). It was the
 * stars page's own (R115); the window is laid out under the hand camera on
 * the live page and the pass detail now, so the picker lives beside the camera
 * it drives and takes its option list from its page: the stars page's and the
 * live page's are the eight points and the zenith, the pass detail's put
 * `peak` first (D-790).
 *
 * Its pressed option is a string read from the camera (`facingOf`), so it
 * re-renders only when that changes — a drag leaves it at '' after its first
 * frame and costs the picker nothing more. A compass point from the zenith:
 * `face` keeps the tilt (FR-STAR-4), and at 90° every azimuth is the same
 * view, so the point would change nothing the reader sees; from `up` a point
 * also brings the view down to the opening tilt, in the window's own `↓` steps
 * (55° is eleven of them), so the camera's moves stay the ones it has.
 */
const FROM_ZENITH_STEPS = (STARS_DEFAULT_TILT - STARS_TILT_MAX_DEG) / PITCH_STEP_DEG;

export interface FacingPickerProps {
  camera: HandCamera;
  /** The page's list; the eight points and the zenith unless the page says otherwise. */
  options?: readonly FacingOption[];
  /** FR-SKY-7: the explained pass's peak, where the list offers `peak`; `null` where there is none. */
  peak?: SkyAim | null;
  /** The visible `Facing:` prefix, as the view control's `View:` — on wide; D-358 drops the prefixes on compact. */
  prefix?: boolean;
  /** Placement only — a grid area, a row's own class. */
  className?: string | undefined;
}

export function FacingPicker({ camera, options = FACING_OPTIONS, peak = null, prefix = false, className }: FacingPickerProps) {
  const t = useT();
  const sp = useStarsPageT();
  const read = useCallback(() => facingOf(camera.get(), peak), [camera, peak]);
  const facing = useSyncExternalStore(camera.subscribe, read, read);
  const turnTo = (value: FacingOption): void => {
    if (value === 'up') {
      camera.up();
      return;
    }
    if (value === 'peak') {
      if (peak !== null) camera.facePeak(peak);
      return;
    }
    const fromZenith = camera.get().altDeg >= STARS_TILT_MAX_DEG;
    camera.face(value);
    if (fromZenith) camera.stepPitch(FROM_ZENITH_STEPS);
  };
  const label = (option: FacingOption): string => (option === 'up' ? sp.up : option === 'peak' ? t.window.peak : option);
  return (
    <ToggleGroup<FacingOption>
      name={sp.facing}
      {...(prefix ? { prefix: `${sp.facing}:` } : {})}
      mark="tight"
      options={options.map((option) => ({ value: option, label: label(option) }))}
      value={facing as FacingOption}
      onChange={turnTo}
      className={className}
    />
  );
}
