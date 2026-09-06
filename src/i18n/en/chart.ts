import type { CompassPoint } from '../../lib/compass';
import type { ChartOrientation, ChartView } from '../../model';

/** FR-I18N-2 (D-199 (2)): the `chart` lane's own section of the English catalog, merged into `en` by `../en.ts`. */
export const chart = {
  chart: {
    viewGroup: 'Chart view',
    viewPrefix: 'View:',
    view: { dome: 'Dome', polar: 'Polar', window: 'Window' } satisfies Record<ChartView, string>,
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
      state: { live: 'up', ahead: 'soon', linger: 'gone' } satisfies Record<'live' | 'ahead' | 'linger', string>,
      sun: (p: { azimuth: string; altitude: string }) => `Sun · az ${p.azimuth} · alt ${p.altitude}`,
      moon: (p: { glyph: string; azimuth: string; altitude: string }) => `${p.glyph} Moon · az ${p.azimuth} · alt ${p.altitude}`,
    },
    domeGroup: 'Sky dome',
    domeHint: 'Drag the dome, or use the arrow keys, to look around.',
    /** FR-GUIDE-4: where the dome's camera faces, e.g. "Facing SSW (203°) · tilt 25°". */
    readout: (p: { point: CompassPoint; azimuth: string; tilt: string }) => `Facing ${p.point} (${p.azimuth}) · tilt ${p.tilt}`,
    /** FR-LIVE-1 (R32): the live page's chart has no pass to caption, so the figure is named instead; the status strip carries the facts. */
    liveLabel: 'The whole sky at the shown instant',
  },
};
