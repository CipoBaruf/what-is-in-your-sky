import { memo, useEffect, useMemo, useState } from 'react';
import type { ChartOrientation } from '../../../../../model';
import { sceneFor, starsFor, type PlacedBody } from '../layers';
import { inkMeasured, inkOffset, inkOffsetsReady } from '../window/inkOffsets';
import type { StarField } from '../window/scene';
import { collide, magnitudeOrder, planetRungFor, rungFor, type Point, type Rung } from '../window/starGlyphs';
import glyphStyles from '../window/starGlyphs.module.css';
import styles from './SkyPolar.module.css';

/** One body the chart draws: `starsFor`'s place, its rung and where it lands, in user units. */
type PlacedGlyph = PlacedBody & { rung: Rung; p: Point };

type Project = (point: { azDeg: number; elDeg: number }, orientation: ChartOrientation) => Point;

/**
 * The scene's stars and planets as the chart draws them: each body
 * `starsFor` places (at the cap, above the horizon) on `starGlyphs`'s ladder,
 * in its draw order (`magnitudeOrder`, the window's), then the collision
 * rule, so of a close pair the brighter alone is drawn, whichever kind it is.
 * The sizes are the sheet's chart text tokens set on SVG text, so they are
 * user units of the 250-unit viewBox and scale with the box as the compass
 * labels' do; the collision distance is in the same units (D-812).
 */
function placeGlyphs(stars: StarField, orientation: ChartOrientation, project: Project): PlacedGlyph[] {
  const bodies = starsFor('polar', stars);
  const glyphs = magnitudeOrder(bodies.map((body) => body.mag))
    .flatMap((k) => bodies[k] ?? [])
    .map((body): PlacedGlyph => ({ ...body, rung: body.planet === undefined ? rungFor(body.mag) : planetRungFor(body.mag), p: project({ azDeg: body.azDeg, elDeg: body.altDeg }, orientation) }));
  const keep = collide(glyphs.map((g) => g.p));
  return glyphs.filter((_, i) => keep[i]);
}

interface PolarStarsProps {
  catalog: StarField['catalog'];
  /** The positions at the shown instant: one object per instant, `starsAt` memoising on `t` (D-791). */
  positions: StarField['positions'];
  /** The scene's two switches this chart draws (the table leaves it no figures and no names). */
  stars: boolean;
  planets: boolean;
  orientation: ChartOrientation;
  /** The chart's own projection and transform, so the group follows the looking-up / map toggle with the arcs. */
  project: Project;
  at: (p: Point) => string;
}

/**
 * R122 (FR-SKY-4, D-792, D-813): the scene's stars to `POLAR_STAR_MAG` and
 * the planets as FR-STAR-6's characters, under the grid and the arcs — `*`,
 * `+` and `.` by magnitude, `@` for a planet. Each glyph's ink, not its em
 * box, is centred on its projected point: the box is centred by the shared
 * sheet and shifted by the window's ink offsets, measured once after the
 * fonts are ready; the group draws again once when they land. The size and
 * the tone are `starGlyphs.module.css`'s, keyed by `data-size` and
 * `data-tone`, the window's own rules. Each text keeps R119's anchor,
 * `data-star` or `data-planet` with the `translate`, which the contract test
 * reads. No figures and no names: the table leaves them to the window.
 *
 * The props are the scene's parts, not the scene, and the placement is
 * memoised on them: a page that rebuilds the scene around the same positions
 * neither places nor renders the group again.
 */
export const PolarStars = memo(function PolarStars({ catalog, positions, stars, planets, orientation, project, at }: PolarStarsProps) {
  const glyphs = useMemo(() => {
    // FR-SKY-1 (R119): what the table leaves this chart of the scene — the stars to `POLAR_STAR_MAG`, the planets, no figures, no names.
    const field = sceneFor('polar', { stars: { catalog, positions, layers: { stars, figures: false, planets, names: false } } })?.stars;
    return field ? placeGlyphs(field, orientation, project) : [];
  }, [catalog, positions, stars, planets, orientation, project]);
  const [, setMeasured] = useState(inkMeasured);
  useEffect(() => {
    if (inkMeasured()) return;
    let live = true;
    void inkOffsetsReady().then((measured) => {
      if (live && measured) setMeasured(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <g className={`${styles.stars} ${glyphStyles.glyphs}`} data-layer="stars">
      {glyphs.map(({ key, star, planet, rung, p }) => {
        const { dx, dy } = inkOffset(rung.glyph, rung.sizeToken);
        return (
          <text
            key={key}
            {...(star === undefined ? {} : { 'data-star': star })}
            {...(planet === undefined ? {} : { 'data-planet': planet })}
            data-glyph={rung.glyph}
            data-size={rung.sizeToken}
            data-tone={rung.colourToken}
            dx={dx}
            dy={dy}
            transform={at(p)}
          >
            {rung.glyph}
          </text>
        );
      })}
    </g>
  );
});
