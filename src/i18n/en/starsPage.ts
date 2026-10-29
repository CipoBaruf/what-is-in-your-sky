import type { CompassPoint } from '../../lib/compass';
import type { PLANETS } from '../../lib/skyStars';

type Planet = (typeof PLANETS)[number];

/**
 * FR-I18N-2, FR-STAR-10 (R115, D-756, D-777): the words only the stars page
 * draws — the page, `In this field`, the window's star label and the readout's second line
 * and the screen's control — so the names task (R116) and the screen task
 * (R117) add none. Not merged into `en.ts`: the main chunk carries the
 * catalogs (D-69), and these ride in the `stars` chunk that draws them, read
 * by `useStarsPageT()` (`starsPageT.ts`) in the active language. `es/starsPage.ts`
 * is typed against this, so a missing word is still a `tsc -b` failure.
 *
 * The star and figure names are not here: they are the catalogue's data,
 * picked by language (FR-STAR-1 and FR-STAR-10 as amended v2.5, D-832). The compass
 * abbreviations and the degrees are identical in both languages (FR-I18N-4)
 * and come in already formatted.
 */
export const starsPage = {
  /** FR-LIVE-1's inert line, for this page: no observer, no sky to draw. */
  noPlace: 'The stars need a place.',
  setPlace: 'set a place',
  /** The drawing's box as a group, for what reads the page: it takes a drag and the arrow keys (FR-STAR-4). */
  drawing: 'The sky: drag it, or use the arrow keys',
  /** FR-STAR-3: the rail's first block and the facing picker's name. */
  facing: 'Facing',
  /** The picker's ninth option: the zenith. */
  up: 'up',
  /** FR-STAR-3: the rail's second block. */
  layersHeading: 'Layers',
  layers: { stars: 'stars', figures: 'figures', planets: 'planets', names: 'names' },
  /** FR-SKY-6 (R126, D-794): the layer row's fifth toggle, tonight's passes on the sky; page state, off, never saved. */
  passesLayer: 'passes',
  /**
   * FR-SKY-6 (D-794): a pass's row in `In this field`, as what reads the page hears it — the key, the name, the
   * FR-LEG-3 state word (the legend's, `chart.legend.state`) and where the peak is: "A: ISS (ZARYA) · up · peaks 64° up · NNW".
   */
  passRow: (p: { key: string; name: string; state: string; altitude: string; point: CompassPoint }) => `${p.key}: ${p.name} · ${p.state} · peaks ${p.altitude} up · ${p.point}`,
  /** FR-STAR-7: the rail's third block, the drawing's text alternative. */
  fieldHeading: 'In this field',
  /** The list with nothing drawn above the horizon in the field (every object layer off, or empty sky). */
  fieldEmpty: 'Nothing drawn in this field.',
  /** The five planets, translated (the stars' names are not). */
  planets: { Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' } satisfies Record<Planet, string>,
  /** FR-STAR-7: the magnitude beside a mark, `mag 0.6`; the number comes formatted (`formatStarMag`). */
  mag: (p: { mag: string }) => `mag ${p.mag}`,
  /** FR-STAR-7: the readout's second line and a row of the list, "Canopus · mag −0.7 · 28° up · S". */
  named: (p: { name: string; mag: string; altitude: string; point: CompassPoint }) => `${p.name} · mag ${p.mag} · ${p.altitude} up · ${p.point}`,
  /** FR-STAR-5 (R117): the one `--tap` row that opens the sky screen in the stars inventory, where the sensor is. */
  holdUp: 'hold up to the sky',
};
