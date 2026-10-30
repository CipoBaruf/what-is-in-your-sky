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
    /** Between the tap and the first reading. */
    waiting: 'Waiting for the phone’s sensors…',
    /** FR-WIN-4: the permission was refused; the page stays as it was (FR-STAR-5, R136). R90 (FR-FAIL-7): and how to be asked again, since the app cannot. */
    denied: 'Motion access was refused. To be asked again, reload the page: Safari asks once per load.',
    /**
     * FR-WIN-4: the readings carry no north (FR-LIVE-8's case); the window is not offered. R90 (FR-FAIL-7): also the
     * note when no reading arrives within `SENSOR_WAIT_S`, in the spec's words for both cases.
     */
    relative: 'This device is not reporting which way it faces.',
    hint: 'Hold the phone up: the window shows the sky it points at.',
    /** R151 (FR-GYRO-1, D-943): the toggle that turns the page's own sky with the phone, after the `[ ] ` mark. */
    followToggle: 'follow the phone',
    /** R151 (FR-GYRO-3, D-943): the one line under the toggle after a refusal, until the next tap. */
    followRefused: "Motion access is off. Allow it in the browser's settings, then tap again.",
    /** R121 (FR-SKY-7, D-790): the pass detail's facing picker's first option — the explained pass's peak, beside the eight points and `up`. */
    peak: 'peak',
    /**
     * R132 (FR-FLOW-6, D-848): the hand hint under the facing picker (`SkyHint`), one line joined with ` · ` from
     * these clauses by the pointer — `coarse` a touch screen, `fine` a mouse. The window gets all three; the dome
     * and the polar chart the drag clause alone; the live page with a highlighted pass ends the coarse line with
     * `follow` (FR-SKY-13). R121's `handHint` in the box's corner is gone with it.
     */
    skyHint: {
      drag: { coarse: 'Drag to look', fine: 'Drag or use the arrow keys' },
      zoom: { coarse: 'pinch to zoom', fine: 'ctrl + wheel to zoom' },
      star: { coarse: 'tap a star', fine: 'click a star' },
      follow: (p: { key: string }) => `tap ${p.key} to follow`,
    },
    /** FR-GUIDE-4's readout for the window: where the back of the phone points, e.g. "Facing NE (53°) · up 10°" — the dome's first word too (FR-FLOW-5, D-847). */
    readout: (p: { point: CompassPoint; azimuth: string; altitude: string }) => `Facing ${p.point} (${p.azimuth}) · up ${p.altitude}`,
    /** R123 for R127 (FR-SKY-13, D-797): the readout's first line while the facing key follows the highlighted pass, "Following A". */
    following: (p: { key: string }) => `Following ${p.key}`,
    /** R123 for R125 (FR-SKY-14, D-798): the readout's first line's suffix while the field is zoomed, " · field 30°" (rounded to 5°). */
    field: (p: { degrees: string }) => ` · field ${p.degrees}`,
    /** FR-WIN-3 / US-21 AC6: the correction named, as the live strip names it. */
    trueNorth: (p: { declination: string }) => `true north, declination ${p.declination}`,
    /** R56 (FR-FOL-5, US-21 AC10): the note over the hatched ground while some sky is still in the field. */
    ground: 'Pointing at the ground — raise the phone.',
    /** R56 (FR-FOL-5): the same, when no sky is left in the field and the box is the ground. */
    buried: 'You are pointing at the ground — raise the phone.',
    /**
     * R73 (FR-FSC-11, US-21 AC12 as amended, D-428): a sentence about what a wider box buys, and nothing on the
     * screen waits for it to be taken. R79 (FR-GUT-7, D-451): no longer a note over the picture — upright it is
     * secondary copy on the countdown's peak line; the words and their Spanish are the ones R73 wrote.
     */
    turnAdvice: 'Turn the phone sideways to see more sky.',
    /**
     * R79 (FR-GUT-6, US-28 AC4): the one line over an empty field — the pass whose next event is soonest, which
     * way and how far to turn to it (the gutter's own angle), and the countdown to its next event. `kind` is
     * that event (FR-FIRST-3's rule): the rise before the pass, its peak or its end while it is up.
     */
    emptyField: (p: { name: string; angle: string; side: 'left' | 'right'; kind: 'rise' | 'peak' | 'end'; countdown: string }) =>
      `Nothing in this part of the sky. ${p.name} is ${p.angle} ${p.side}, ${{ rise: 'up', peak: 'peaks', end: 'sets' }[p.kind]} in ${p.countdown}.`,
    /** R79 (FR-GUT-6): the same line with no drawn pass at all — nothing in the span, so no direction to name. */
    emptySky: 'Nothing in this part of the sky, and no pass to turn to.',
    /** R79 (FR-GUT-1): the gutter's name, for what reads the page; its marks are the list under it. */
    gutterLabel: 'Which way to turn',
    /**
     * R79 (FR-GUT-4, FR-GUT-5): a mark on the gutter as words — the text the ticks and the edge markers stand for,
     * so the gutter is not a sighted-only channel (FR-X-5). `in` is inside the field; `left` / `right` is the turn.
     */
    gutterMark: (p: { name: string; key: string; place: 'in' | 'left' | 'right'; angle: string }) =>
      p.place === 'in' ? `${p.key} ${p.name}: in view` : `${p.key} ${p.name}: ${p.angle} to the ${p.place}`,
  },
};
