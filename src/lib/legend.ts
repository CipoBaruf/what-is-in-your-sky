import type { MoonState, Pass } from '../model';
import { arcState, isDrawn, type ArcState } from './arcReveal';
import { compassPoint, type CompassPoint } from './compass';
import { interpolateTrack } from './skyGeometry';

/**
 * FR-LEG-1..5 / D-186 (R45): the legend's rows, derived in this one pure
 * module from what the chart is given, so the list beside (or under) the
 * drawing says exactly what the drawing draws, in the states it draws it,
 * whichever view is mounted (FR-LIVE-10's rule: same props, same story).
 *
 * The input is the slice of `SkyChartProps` the rows depend on, spelled out
 * here rather than imported: `src/lib` knows no component (PLAN §3, D-116).
 */
export interface LegendPass extends Pass {
  /** FR-TRAJ-1 / D-189: the arc's state at the shown instant; absent is `'full'`. */
  arc?: ArcState | undefined;
}

interface LegendHidden {
  id: string;
  azDeg: number;
  elDeg: number;
  /** The name and the reason, already worded by the page (FR-LIVE-6, FR-I18N-2). */
  label: string;
}

export interface LegendInput {
  passes: readonly LegendPass[];
  highlightedPassId: string | null;
  now?: number | undefined;
  hidden?: readonly LegendHidden[] | undefined;
  colorBy?: 'highlight' | 'pass' | undefined;
}

/**
 * The colour a row's swatch takes, as the FR-DOME-2 / FR-LIVE-2 meaning:
 * `--chart-<token>` is the custom property in both themes (FR-THEME-3), and
 * the stylesheet maps `data-color` to it, so no hex value crosses this
 * boundary. `series-1`..`series-6` on the live page (`colorBy: 'pass'`), the
 * highlighted pass's `pass` and every other pass's `pass-dim` in the guide.
 */
export type LegendColor = 'pass' | 'pass-dim' | 'series-1' | 'series-2' | 'series-3' | 'series-4' | 'series-5' | 'series-6';

/** FR-LEG-3: what the row says about the moment — an arc state, or `hidden` for a FR-LIVE-6 object whose reason is in its label. */
type LegendState = ArcState | 'hidden-object';

export interface LegendRow {
  /** `A`, `B`, `C`… in row order (FR-LEG-1). */
  key: string;
  /** The pass's id, or the hidden object's (`hidden-<noradId>`), which is what the drawing's `data-pass-id` / `data-hidden-id` carries. */
  passId: string;
  name: string;
  colorToken: LegendColor;
  /** The three clock instants; a hidden object has none. */
  riseMs: number | null;
  peakMs: number | null;
  endMs: number | null;
  state: LegendState;
  /** Whether the drawing emphasises this arc: the row reads the same way (FR-LEG-4). */
  highlighted: boolean;
  /** R217 (FR-NOW-2, D-1239): where the pass's marker is at `now`, or `null` where it is not on the arc; absent is `null`. */
  at?: { azDeg: number; elDeg: number } | null;
}

export const SERIES_COUNT = 6;

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The key of the `index`th row: `A`..`Z`, then `A1`.. for a sky that somehow holds more (FR-LEG-1). */
export function keyFor(index: number): string {
  const letter = KEYS[index % KEYS.length] ?? 'A';
  const round = Math.floor(index / KEYS.length);
  return round === 0 ? letter : `${letter}${String(round)}`;
}

/** The series meaning of the pass at `index` in `passes` order (FR-LIVE-2): `series-1`..`series-6`, cycling. */
export const seriesToken = (index: number): LegendColor => `series-${String((((index % SERIES_COUNT) + SERIES_COUNT) % SERIES_COUNT) + 1)}` as LegendColor;

const isHighlighted = (passId: string, highlightedPassId: string | null): boolean => highlightedPassId === null || highlightedPassId === passId;

/** Where a pass's marker is at `now`, or `null` where the marker is not on the arc. */
function markerAt(pass: LegendPass, now: number | undefined): { azDeg: number; elDeg: number } | null {
  if (now === undefined || now < pass.start.t || now > pass.end.t || pass.track.length === 0) return null;
  const { azDeg, elDeg } = interpolateTrack(pass.track, now);
  return { azDeg, elDeg };
}

/** The elevation of a pass's marker at `now`, or −∞ where the marker is not on the arc: the zenith order's key (FR-LEG-4). */
function markerElevation(pass: LegendPass, now: number | undefined): number {
  return markerAt(pass, now)?.elDeg ?? -Infinity;
}

/**
 * The rows, in legend order, with their keys: the highlighted (explained)
 * pass first where there is one, otherwise — the live page — the pass whose
 * marker is nearest the zenith first, then the others in the order the
 * chart got them (FR-LEG-4, D-186). A pass whose arc is `hidden` is not
 * drawn, so it is not listed (FR-LEG-2); a hidden object (FR-LIVE-6) comes
 * after every pass, with the words the page gave it.
 */
export function legendRows(input: LegendInput): LegendRow[] {
  const { passes, highlightedPassId, now, hidden = [], colorBy = 'highlight' } = input;
  const indexed = passes.map((pass, index) => ({ pass, index, state: pass.arc ?? arcState(pass, undefined) })).filter(({ state }) => isDrawn(state));
  const ordered =
    highlightedPassId !== null
      ? [...indexed.filter(({ pass }) => pass.id === highlightedPassId), ...indexed.filter(({ pass }) => pass.id !== highlightedPassId)]
      : [...indexed].sort((a, b) => markerElevation(b.pass, now) - markerElevation(a.pass, now));
  const rows: LegendRow[] = ordered.map(({ pass, index, state }) => {
    const highlighted = isHighlighted(pass.id, highlightedPassId);
    return {
      key: '',
      passId: pass.id,
      name: pass.name,
      colorToken: colorBy === 'pass' ? seriesToken(index) : highlighted ? 'pass' : 'pass-dim',
      riseMs: pass.start.t,
      peakMs: pass.peak.t,
      endMs: pass.end.t,
      state,
      highlighted,
      at: markerAt(pass, now),
    };
  });
  for (const marker of hidden) {
    rows.push({ key: '', passId: marker.id, name: marker.label, colorToken: 'pass-dim', riseMs: null, peakMs: null, endMs: null, state: 'hidden-object', highlighted: false, at: null });
  }
  return rows.map((row, index) => ({ ...row, key: keyFor(index) }));
}

/** `legendKeys` for the chart (FR-LEG-1): each row's id to its key. */
export function legendKeys(rows: readonly LegendRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.passId, row.key]));
}

/**
 * FR-LEG-4: a row the reader activated moves to the top and is the only
 * highlighted one, the others dimmed; the keys stay what they were, so
 * tapping `C` does not turn it into `A`. `null` leaves the rows as derived.
 */
export function promoteRow(rows: readonly LegendRow[], passId: string | null): LegendRow[] {
  if (passId === null || !rows.some((row) => row.passId === passId)) return [...rows];
  const chosen = rows.filter((row) => row.passId === passId).map((row) => ({ ...row, highlighted: true }));
  const rest = rows.filter((row) => row.passId !== passId).map((row) => ({ ...row, highlighted: false }));
  return [...chosen, ...rest];
}

/** FR-DOME-6 as amended / FR-LEG-3: the Sun's and the Moon's lines, one each, only while the drawing carries the body. */
export interface BodyLine {
  body: 'sun' | 'moon';
  azDeg: number;
  altDeg: number;
  /** The Moon's phase, for its glyph; the Sun has none. */
  moon?: MoonState;
}

export function bodyLines(input: { sun?: { azDeg: number; altDeg: number } | null | undefined; moon?: MoonState | null | undefined }, drawn: { sun: boolean; moon: boolean }): BodyLine[] {
  const out: BodyLine[] = [];
  if (input.sun && drawn.sun) out.push({ body: 'sun', azDeg: input.sun.azDeg, altDeg: input.sun.altDeg });
  if (input.moon && drawn.moon) out.push({ body: 'moon', azDeg: input.moon.azDeg, altDeg: input.moon.elDeg, moon: input.moon });
  return out;
}

/**
 * R217 (FR-NOW-2, D-1239): the legend's up-only form — the rows whose satellite is above the horizon at the shown
 * instant, in the legend's order; a hidden object (FR-LIVE-6) is not a visible satellite, so it is never one.
 */
export function upNowRows(rows: readonly LegendRow[]): LegendRow[] {
  return rows.filter((row) => row.state !== 'hidden-object' && row.at != null && row.at.elDeg > 0);
}

/** FR-NOW-2: the Moon's line, then the Sun's, as the up-only form lists them; each only while the drawing carries it. */
export function upNowBodies(bodies: readonly BodyLine[]): BodyLine[] {
  return [...bodies.filter((line) => line.body === 'moon'), ...bodies.filter((line) => line.body === 'sun')];
}

/** FR-NOW-2: a row's direction and height — the 16-point compass point, whole degrees, and which side of the horizon. */
export interface UpNowPlace {
  point: CompassPoint;
  /** Whole degrees from the horizon, never negative. */
  degrees: number;
  /** Above the horizon, or exactly on it: `30° up`; under it, even by less than half a degree: `0° below`, `4° below`. */
  up: boolean;
}

export function upNowPlace(azDeg: number, altDeg: number): UpNowPlace {
  const whole = Math.round(altDeg);
  // The side comes from the altitude itself: rounding -0.4 gives -0, and -0 >= 0 would call it up.
  return { point: compassPoint(azDeg), degrees: Math.abs(whole), up: altDeg >= 0 };
}

/**
 * FR-NOW-2: the widths, in characters, of the up-only form's two right columns — the compass point and the height —
 * so every row's point and height start at one x. The font is monospaced (`--font-mono`); a proportional one would
 * need the columns measured instead.
 */
export function upNowColumns(cells: readonly { point: string; height: string }[]): { point: number; height: number } {
  return {
    point: Math.max(0, ...cells.map((cell) => [...cell.point].length)),
    height: Math.max(0, ...cells.map((cell) => [...cell.height].length)),
  };
}
