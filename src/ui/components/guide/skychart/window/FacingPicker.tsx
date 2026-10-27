import { useCallback, useSyncExternalStore } from 'react';
import { useStarsPageT } from '../../../../../i18n/starsPageT';
import { useT } from '../../../../../i18n/useT';
import { ToggleGroup } from '../../../primitives/ToggleGroup';
import { PITCH_STEP_DEG } from '../dome/camera';
import { facedPassId, FACING_OPTIONS, facingOf, isPassFacing, passFacing, STARS_DEFAULT_TILT, STARS_TILT_MAX_DEG, type FacingOption, type HandCamera, type SkyAim } from './camera';

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
 *
 * R127 (FR-SKY-13, D-797): on the live page the list ends with the highlighted
 * pass's key after `up` (`· A`), where the page names a pass to follow.
 * Choosing it turns the camera to the pass's position and leaves it following
 * (`followPass`); the window re-aims on every tick while the key is the pressed
 * option, and the next drag, arrow or other facing ends it. The option's value
 * is the pass's id (`passFacing`), its label the legend key.
 */
const FROM_ZENITH_STEPS = (STARS_DEFAULT_TILT - STARS_TILT_MAX_DEG) / PITCH_STEP_DEG;

/** FR-SKY-13: the pass the picker's last option follows — its id, the key the drawing gives it, and where it is now. */
export interface FollowTarget {
  id: string;
  key: string;
  position: SkyAim;
}

export interface FacingPickerProps {
  camera: HandCamera;
  /** The page's list; the eight points and the zenith unless the page says otherwise. */
  options?: readonly FacingOption[];
  /** FR-SKY-7: the explained pass's peak, where the list offers `peak`; `null` where there is none. */
  peak?: SkyAim | null;
  /** FR-SKY-13 (R127): the highlighted pass the list offers after `up`, by its key; `null` or absent where none. */
  follow?: FollowTarget | null;
  /** The visible `Facing:` prefix, as the view control's `View:` — on wide; D-358 drops the prefixes on compact. */
  prefix?: boolean;
  /** Placement only — a grid area, a row's own class. */
  className?: string | undefined;
}

export function FacingPicker({ camera, options = FACING_OPTIONS, peak = null, follow = null, prefix = false, className }: FacingPickerProps) {
  const t = useT();
  const sp = useStarsPageT();
  // R125: the peak at the field it was faced at, so a zoom that keeps the aim keeps `peak` pressed (FR-SKY-14).
  const read = useCallback(() => facingOf(camera.get(), peak, camera.peakFovDeg()), [camera, peak]);
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
    if (isPassFacing(value)) {
      const passId = facedPassId(value);
      if (follow !== null && follow.id === passId) camera.followPass(passId, follow.position);
      return;
    }
    const fromZenith = camera.get().altDeg >= STARS_TILT_MAX_DEG;
    camera.face(value);
    if (fromZenith) camera.stepPitch(FROM_ZENITH_STEPS);
  };
  const label = (option: FacingOption): string => (option === 'up' ? sp.up : option === 'peak' ? t.window.peak : facedPassId(option) !== null ? (follow?.key ?? '') : option);
  const offered = follow === null ? options : [...options, passFacing(follow.id)];
  return (
    <ToggleGroup<FacingOption>
      name={sp.facing}
      {...(prefix ? { prefix: `${sp.facing}:` } : {})}
      mark="tight"
      options={offered.map((option) => ({ value: option, label: label(option) }))}
      value={facing as FacingOption}
      onChange={turnTo}
      className={className}
    />
  );
}
