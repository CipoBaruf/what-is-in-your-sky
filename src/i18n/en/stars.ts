import type { CompassPoint } from '../../lib/compass';
import type { PageKeyId } from '../../lib/shortcuts';
import type { PLANETS } from '../../lib/skyStars';

type Planet = (typeof PLANETS)[number];

/**
 * FR-I18N-2, FR-STAR-10 (R115, D-756): the stars page's section of the English
 * catalog — every word the page, `In this field` and the window's star label
 * and readout use, so the names task (R116) and the screen task (R117) add
 * none. The star and figure names are not here: they are the catalogue's data,
 * the same in both languages (FR-STAR-1 and FR-STAR-10 as amended). The
 * compass abbreviations and the degrees are identical in both languages
 * (FR-I18N-4) and come in already formatted.
 */
export const stars = {
  stars: {
    /** FR-STAR-3: the wide header's page link, beside `[ live ]`. */
    link: 'stars',
    /** FR-A11Y-1, FR-A11Y-3: the page's `h1` and the tab's route name, "Stars · …". */
    heading: 'Stars',
    /** FR-STAR-3: the compact When pane's first line, "Stars tonight · [ look up ]". */
    tonight: 'Stars tonight',
    lookUp: 'look up',
    /** While the `stars` chunk is on its way. */
    loading: 'Loading the stars…',
    /** FR-LIVE-1's inert line, for this page: no observer, no sky to draw. */
    noPlace: 'The stars need a place.',
    setPlace: 'set a place',
    /** The drawing's box as a group, for what reads the page: it takes a drag and the arrow keys (FR-STAR-4). */
    drawing: 'The sky, turned by hand: drag it, or use the arrow keys',
    /** FR-STAR-3: the rail's first block and the facing picker's name. */
    facing: 'Facing',
    /** The picker's ninth option: the zenith. */
    up: 'up',
    /** FR-STAR-3: the rail's second block. */
    layersHeading: 'Layers',
    layers: { stars: 'stars', figures: 'figures', planets: 'planets', names: 'names' },
    /** FR-STAR-7: the rail's third block, the drawing's text alternative. */
    fieldHeading: 'In this field',
    /** The list with nothing drawn above the horizon in the field (every object layer off, or a field of empty sky). */
    fieldEmpty: 'Nothing drawn in this field.',
    /** The five planets, translated (the stars' names are not). */
    planets: { Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' } satisfies Record<Planet, string>,
    /** FR-STAR-7: the magnitude beside a mark, `mag 0.6`; the number comes formatted (`formatStarMag`). */
    mag: (p: { mag: string }) => `mag ${p.mag}`,
    /** FR-FSC-3's form for the page: where the field is centred and how wide it is, "Facing SW · 32° up · 60° across". */
    readout: (p: { point: CompassPoint; altitude: string; across: string }) => `Facing ${p.point} · ${p.altitude} up · ${p.across} across`,
    /** FR-STAR-7: the readout's second line and a row of the list, "Canopus · mag −0.7 · 28° up · S". */
    named: (p: { name: string; mag: string; altitude: string; point: CompassPoint }) => `${p.name} · mag ${p.mag} · ${p.altitude} up · ${p.point}`,
    /** FR-STAR-5 (R117): the one `--tap` row that opens the sky screen in the stars inventory, where the sensor is. */
    holdUp: 'hold up to the sky',
    /** FR-DESK-4 as amended v2.4: the `?` overlay's block for the page's four keys. */
    keysHeading: 'On the stars page',
    keys: {
      starsTurn: 'Turn the sky left or right, with the drawing focused',
      starsTilt: 'Tilt it up or down',
    } satisfies Record<PageKeyId, string>,
  },
};
