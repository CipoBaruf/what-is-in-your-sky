import type { CompassPoint } from '../../lib/compass';
import type { ChartOrientation, ChartView } from '../../model';

/** FR-I18N-2 (D-199 (2)): the `chart` lane's own section of the English catalog, merged into `en` by `../en.ts`. */
export const chart = {
  chart: {
    viewGroup: 'Chart view',
    viewPrefix: 'View:',
    view: { dome: 'Dome', polar: 'Polar', window: 'Window', globe: 'Globe' } satisfies Record<ChartView, string>,
    /**
     * R160 (FR-PHONE-7, D-971): the stars page's own view row, `[ Window ] Whole sky` — the polar chart under the
     * name a reader of that page knows it by, since the page is about the stars and offers no dome; the live page
     * and the pass detail keep `view`'s three.
     */
    views: { window: 'Window', wholeSky: 'Whole sky' },
    loadingDome: 'Loading the sky dome…',
    noPass: 'No pass to draw.',
    orientationGroup: 'Chart orientation',
    orientation: { 'looking-up': 'Looking up', map: 'Map' } satisfies Record<ChartOrientation, string>,
    orientationNote: {
      'looking-up': 'Looking up: east on the left, as when lying on your back.',
      map: 'Map: east on the right, as on a map.',
    } satisfies Record<ChartOrientation, string>,
    /**
     * FR-LEG-1..5 (R45): the legend beside or under the chart. The drawing
     * carries no words any more — the names, the times, the bodies' captions
     * and the hidden objects' reasons are rows here. The state words are
     * FR-LEG-3's: `up` (the marker is on the arc), `soon` (the arc is ahead,
     * dotted), `gone` (it lingers faint). The two bodies get one line each
     * with azimuth and altitude (FR-DOME-6 as amended); the Moon's glyph is
     * its phase and carries no words.
     */
    legend: {
      label: 'Legend',
      /**
       * FR-LEG-7 (R71): the one line a legend with no rows carries — the
       * compact live page's panel, which is two `--tap` rows whether or not
       * there is anything to list, so an empty one says why rather than
       * standing blank. A `role="status"`, so a reader who opened it on an
       * empty sky is told; the Sun and the Moon lines, if the drawing carries
       * them, are under it as they always are.
       */
      empty: 'nothing up right now',
      state: { live: 'up', ahead: 'soon', linger: 'gone' } satisfies Record<'live' | 'ahead' | 'linger', string>,
      /**
       * FR-FLOW-13 (D-852, V26-13; R85's `times`, F-81): what the three clock times on a row are, written before
       * each time on the row's second line — "rise 07:23:47 · peak 07:23:55 · end 07:27:03". "end" and not "set":
       * a pass often ends by fading into Earth's shadow, not at the horizon.
       */
      rise: 'rise',
      peak: 'peak',
      end: 'end',
      sun: (p: { azimuth: string; altitude: string }) => `Sun · az ${p.azimuth} · alt ${p.altitude}`,
      moon: (p: { glyph: string; azimuth: string; altitude: string }) => `${p.glyph} Moon · az ${p.azimuth} · alt ${p.altitude}`,
      /** R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): the phase and illumination, which leave the *compact* live conditions line for this one. FR-MOON-3 leaves the wide live page and every other legend the plain line above. */
      moonLit: (p: { glyph: string; phase: string; illumination: string; azimuth: string; altitude: string }) => `${p.glyph} Moon ${p.phase}, ${p.illumination} % · az ${p.azimuth} · alt ${p.altitude}`,
    },
    domeGroup: 'Sky dome',
    domeHint: 'Drag the dome, or use the arrow keys, to look around.',
    /** FR-GUIDE-4: where the dome's camera faces, e.g. "Facing SSW (203°) · tilt 25°". */
    readout: (p: { point: CompassPoint; azimuth: string; tilt: string }) => `Facing ${p.point} (${p.azimuth}) · tilt ${p.tilt}`,
    /** FR-LIVE-1 (R32): the live page's chart has no pass to caption, so the figure is named instead; the status strip carries the facts. */
    liveLabel: 'The whole sky at the shown instant',
    // R152 (FR-GYRO-6, FR-GYRO-9): `screenClose`, the sky screen's `×`, went with the screen; the sheet's `×` is `sheet.close`.
    /**
     * R169 (FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-11, FR-GLOBE-16; D-1042): the words the celestial globe's drawing
     * carries — the SVG's label, the zenith's and the poles' marks, the Sun's and the Moon's names, and the readout's
     * second line for an object on the ground side (the sky side's is the stars page's `named`). The rail's words
     * (the view's name, the groups, the turn's values, the steps, `faint`) are the page's (R170).
     */
    globe: {
      /** FR-GLOBE-6 as amended (V212-12): the zoom buttons' accessible names; the labels are `+` and `−`. */
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      label: 'The celestial globe: drag it, or use the arrow keys',
      zenith: 'zenith',
      /** FR-GLOBE-2: the two celestial poles, as abbreviations. */
      poles: { north: 'NCP', south: 'SCP' },
      sun: 'Sun',
      moon: 'Moon',
      /** FR-GLOBE-11: "Canopus · mag −0.7 · 12° below · S" — the object is under the shown place's horizon by `altitude`. */
      namedBelow: (p: { name: string; mag: string; altitude: string; point: CompassPoint }) => `${p.name} · mag ${p.mag} · ${p.altitude} below · ${p.point}`,
      /** FR-GLOBE-11: the Sun's and the Moon's lines, which carry no magnitude — "Moon · 28° up · E", "Sun · 12° below · W". */
      bodyUp: (p: { name: string; altitude: string; point: CompassPoint }) => `${p.name} · ${p.altitude} up · ${p.point}`,
      bodyBelow: (p: { name: string; altitude: string; point: CompassPoint }) => `${p.name} · ${p.altitude} below · ${p.point}`,
    },
  },
};
