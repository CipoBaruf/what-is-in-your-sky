import type { CompassPoint } from '../../lib/compass';

/**
 * FR-I18N-2 (D-199 (2)): the `window` lane's own section of the English
 * catalog. R47 (FR-WIN-1..5, US-21): the sky window's words — the control
 * that asks for the sensor, the two notes, the hint and the readout under the
 * drawing. The toggle's label for the view is `chart.view.window`, beside the
 * other two (R17's rule: one record for the three views).
 */
export const windowMessages = {
  window: {
    /** FR-WIN-5: the one control in the window's place while the browser still needs a tap before it gives orientation. */
    pointAtSky: 'point at the sky',
    /** Between the tap and the first reading. */
    waiting: 'Waiting for the phone’s sensors…',
    /** FR-WIN-4: the permission was refused; the dome is the view again. */
    denied: 'Motion access was refused, so the dome stays the view.',
    /** FR-WIN-4: the readings carry no north (FR-LIVE-8's case); the window is not offered. */
    relative: 'This phone gives no compass heading, so the window cannot find north.',
    hint: 'Hold the phone up: the window shows the sky it points at.',
    /** FR-GUIDE-4's readout for the window: where the back of the phone points, e.g. "Looking NE (53°) · up 10°". */
    readout: (p: { point: CompassPoint; azimuth: string; altitude: string }) => `Looking ${p.point} (${p.azimuth}) · up ${p.altitude}`,
    /** FR-WIN-3 / US-21 AC6: the correction named, as the live strip names it. */
    trueNorth: (p: { declination: string }) => `true north, declination ${p.declination}`,
    /** R56 (FR-FOL-5, US-21 AC10): the note over the hatched ground while some sky is still in the field. */
    ground: 'Pointing at the ground — raise the phone.',
    /** R56 (FR-FOL-5): the same, when no sky is left in the field and the box is the ground. */
    buried: 'You are pointing at the ground — raise the phone.',
  },
};
