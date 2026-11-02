import type { CompassPoint } from '../../lib/compass';
import type { PLANETS } from '../../lib/skyStars';

type Planet = (typeof PLANETS)[number];

/**
 * FR-I18N-2, FR-STAR-10 (R115, D-756, D-777): the words only the stars page
 * draws — the page, `In this field`, the window's star label and the readout's second line
 * and the screen's control (gone with R152) — so the names task (R116) and the screen task
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
  /** R163 (FR-CLEAN-11, D-1004): four layers; the `[ passes ]` toggle and its pass row left with the passes. */
  layers: { stars: 'stars', figures: 'figures', planets: 'planets', names: 'names' },
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
};
