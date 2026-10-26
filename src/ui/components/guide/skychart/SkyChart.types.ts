import type { ComponentType, ReactNode } from 'react';
import type { ArcState } from '../../../../lib/arcReveal';
import type { CompassPoint } from '../../../../lib/compass';
import type { LegendRow } from '../../../../lib/legend';
import type { SunState } from '../../../../lib/skyBodies';
import type { ChartView, EpochMs, MoonState, Observer, Pass } from '../../../../model';
import type { HandCamera, SkyCamera } from './window/camera';
import type { SkyScene } from './window/scene';

/**
 * R121 (FR-STAR-3, FR-SKY-7; D-789, D-790): the facing picker's options. The
 * lists are values a page names — the pass detail's puts `peak` first — and
 * they stand here, beside the props that carry them, rather than in
 * `window/camera.ts`, so a page in the main chunk can name one without
 * pulling the camera and the projection in with it; `camera.ts` re-exports
 * them for the picker and the tests.
 */
/** The picker's eight points, in the order the row shows them. */
export const FACING_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const satisfies readonly CompassPoint[];
/** What the picker can offer: a point, the zenith, or (the pass detail) the explained pass's peak. */
export type FacingOption = (typeof FACING_POINTS)[number] | 'up' | 'peak';
/** The stars page's and the live page's list: the eight points, then the zenith. */
export const FACING_OPTIONS: readonly FacingOption[] = [...FACING_POINTS, 'up'];
/** The pass detail's list (D-790): `peak` first, then the eight points and the zenith. */
export const PEAK_FACING_OPTIONS: readonly FacingOption[] = ['peak', ...FACING_POINTS, 'up'];

/**
 * D-789 (R121): the place the chart keeps for the window's hand camera. The
 * chart is in the main chunk and may not make the camera itself — that would
 * pull `camera.ts` and the projection in with it — so it holds the slot and
 * the window fills it on its first mount, in its own chunk; the chart keeps
 * the slot across a view change and back, which is what keeps the facing.
 */
export interface HandSlot {
  /** The camera a window left here, or `null` before the first one. */
  get(): HandCamera | null;
  /** The window's camera, kept for the next window this chart mounts. */
  keep(camera: HandCamera): void;
}

/**
 * FR-TRAJ-1 / D-189 (R45): a pass with the state its arc is drawn in at the
 * shown instant. `arc` defaults to `'full'` — the whole arc, the pass
 * detail's reading — so a plain `Pass` is still a valid entry; the live page
 * sets it from `lib/arcReveal`'s `arcState(pass, t)` (R48).
 */
export interface ChartPass extends Pass {
  arc?: ArcState | undefined;
}

/** The state a `ChartPass` is drawn in: `'full'` unless the caller said otherwise. */
export const arcOf = (pass: ChartPass): ArcState => pass.arc ?? 'full';

/**
 * PLAN §8.1 (R13): the one props interface both sky chart views implement.
 * The rest of the app knows `SkyChart` and this shape only; the geometry is
 * already observer-relative (`Pass.track`), the observer is for labels and
 * the time zone.
 */
export interface SkyChartProps {
  /** What to draw; usually one, may be several for a "tonight" overview. Each may carry its FR-TRAJ-1 `arc` state (R45). */
  passes: readonly ChartPass[];
  observer: Observer;
  /** Emphasised arc + peak; others drawn dim. */
  highlightedPassId: string | null;
  onSelectPass?: (passId: string) => void;
  /** Optional: marks the satellite's current position on its arc, and is the instant the Sun and Moon are drawn at (FR-DOME-5, FR-DOME-6). */
  now?: EpochMs;
  /**
   * FR-DOME-6, PLAN §8.8: where the Sun and the Moon are at `now`. Omitted,
   * `SkyChart` evaluates them itself from `observer` and `now` (`useSkyBodies`,
   * which loads `lib/skyBodies.ts` on demand). The live page supplies them so
   * it can hold the FR-LIVE-5 budget of one evaluation per second of wall time
   * across playback. `null` means "known to be nothing to draw".
   */
  sun?: SunState | null;
  moon?: MoonState | null;
  /** Default: the highlighted pass's start azimuth (D-17). The polar view has no facing; the dome (R15) uses it. */
  initialFacingAzDeg?: number;
  /**
   * FR-LIVE-8 (R34, D-176): a facing the caller sets from outside — the
   * phone's compass heading. Each new value turns the dome to it; the drag and
   * the keys still move the camera in between, and `onDrag` is how the caller
   * learns the viewer took the dome by hand. `undefined` leaves the camera
   * where it is. The polar view has no facing and ignores both.
   */
  facingAzDeg?: number | undefined;
  /** FR-LIVE-8: called once per pointer drag, on its first movement. A tap that moves nothing is not a drag. */
  onDrag?: () => void;
  /**
   * FR-LIVE-2 (R32, D-158): how the arcs are coloured. `highlight` (the
   * default) is the guide's reading — the highlighted pass in the pass colour
   * and the others dim. `pass` is the live page's: every arc at full weight in
   * its own colour, the six `--chart-series-*` tokens taken in `passes` order.
   */
  colorBy?: 'highlight' | 'pass';
  /**
   * FR-LIVE-1 / PLAN §8.1 (R32): no caption, no square box — the drawing fills
   * whatever box the caller gives the chart, the live page's whole viewport
   * included. The guide's chart keeps the framed square and its sentence.
   */
  fill?: boolean;
  /**
   * FR-LIVE-6 (R33, D-168): objects above the horizon at `now` that are not
   * worth looking for, drawn dimmed with their reason. Already worded: the
   * page reads the reason off the `NowItem` and words it through its own
   * catalog section, and the chart only places the marker and its label — the
   * same split `labelsFor` makes for the pass labels (FR-I18N-2). Empty or
   * absent draws nothing extra. The page has already taken out whatever it
   * draws from a pass (D-102), so no object gets two marks.
   */
  hidden?: readonly HiddenMarker[];
  /**
   * FR-LEG-1 / D-186 (R45): the one-character key each drawn pass (and each
   * hidden object, by its `id`) carries at its peak marker, `A`, `B`, `C`…
   * in legend order. `SkyChart` derives it from `lib/legend.ts` and hands it
   * to whichever view is mounted, so the three views draw the same letter
   * and the legend's row is the drawing's key. Absent (a view mounted on its
   * own) nothing is lettered.
   */
  legendKeys?: Readonly<Record<string, string>>;
  /**
   * FR-LEG-2 / D-186: the legend, already rendered by `SkyChart` from the
   * same props as the drawing, for the view to place in `ChartFrame`'s slot
   * — under the drawing on compact, in the 24-cell column at its right on
   * wide. The view never builds it: one list, whichever view is mounted.
   */
  legend?: ReactNode;
  /**
   * FR-LEG-3 / US-23 AC3 (R51): the block that stands in for the explained
   * pass's legend row — the pass detail's FR-GUIDE-1 numeric table, which is
   * the legend there. It is called with the row it replaces, so the key and
   * the colour it shows are the ones `lib/legend.ts` derived and the drawing
   * drew, and the caller never has to work out either. Absent, the legend is
   * the plain list.
   */
  legendLead?: (row: LegendRow) => ReactNode;
  /**
   * FR-LIVE-7 as amended (v1.2) / D-312 (R61): the rest of the rail. On the
   * wide live page the status strip, the stripe block, the playback row and
   * the actions sit in the column beside the drawing, under the legend,
   * instead of in rows beneath it: the box then keeps the page's whole height
   * and is about as wide as it is tall, which is the shape the drawing has
   * (F-59). The chart neither builds this nor reads it — it places it, because
   * the frame owns that column (D-187). Absent everywhere else, where the page
   * lays its own rows out under the box.
   */
  aside?: ReactNode;
  /**
   * FR-LIVE-7 and FR-TRAJ-4 as amended (v1.2.1) / D-315 (R61): the stripe
   * block under the drawing, the box's width, on every wide live page — the
   * owner's stripe under the dome (V12-12). The page hands it here instead of
   * into `aside`; the frame places it in a row of its own under the box.
   * Absent, there is no such row.
   */
  stripe?: ReactNode;
  /**
   * FR-LIVE-7 as amended (v1.2.1) / D-314 (R61): the box's aspect, width over
   * height — the dome's `DOME_BOX_ASPECT`. Given, the frame cuts the drawing
   * box to the largest rectangle of that shape the frame leaves it
   * (`lib/layout.ts` `fitBox`) and stands the side column beside it; absent,
   * the box is fluid — every row the page leaves, whatever its shape.
   */
  boxAspect?: number;
  /**
   * FR-LIVE-7 as amended (v1.2.1) / D-319 (R61): the one-column wide live page.
   * The frame stacks the drawing, the stripe and the legend, each centred at
   * the box's width, instead of standing a rail beside the drawing; the page
   * lays its own rows out under the frame. Absent, the frame is the
   * two-column one where it has an `aside`.
   *
   * R71 (FR-LEG-6, D-386): no page passes this any more — the wide live page
   * is the rail at every width and the layout this described is withdrawn with
   * `LIVE_TWO_COLUMN_MIN_PX`. The frame's mode is left where it is, since
   * D-386's deletion is the page's three files and not the chart's.
   */
  stacked?: boolean;
  /**
   * FR-LEG-7 as amended (v1.4) / D-387 (R71): the legend is behind a control —
   * the compact live page's `[ list (n) ]`. `false` renders no legend slot at
   * all, so the box has the height it leaves; `true` makes the slot a panel of
   * exactly two `--tap` rows that scrolls inside itself, whatever it holds.
   * Absent everywhere else, where the legend is rendered whenever there is one.
   */
  legendOpen?: boolean;
  /**
   * FR-LIVE-7 as amended (v1.1.1) / D-268, D-269 (R54): on the live page the
   * chart's own controls — the view toggle and its note — reach the view
   * already rendered, for the view to put first in `ChartFrame`'s controls
   * slot before its own control. So the row above the drawing is one row: the
   * toggle, the view's control and the readout. Absent on the guide, where
   * the toggle stays in the figure above the frame.
   */
  controls?: ReactNode;
  /**
   * FR-FSC-1, FR-FSC-3 / D-322 (R62): the chart *is* the screen. The window is
   * the view whatever `chartView` says, there is no caption, no view toggle and
   * no controls row, `fill` is implied, and the frame drops the rails: the box
   * is the host's whole size with the facing readout and the legend as overlays
   * over the drawing. The dome and the polar chart never see it — the type
   * allows it and `SkyChart` ignores it for them — so the three views draw the
   * same geometry as before.
   */
  screen?: boolean;
  /**
   * R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): the legend's Moon line carries the phase and the
   * illumination. The compact live page alone passes it — that is the line its conditions line hands
   * them to — and FR-MOON-3 leaves the Now panel, the wide live page and every other legend unchanged.
   */
  moonPhase?: boolean;
  /**
   * FR-FSC-1 / D-322 (R62): the page's own children over everything on a
   * `screen` — the follow screen's `×`. The chart neither builds this nor reads
   * it: the frame places it in its overlay slot, above the drawing, the readout
   * and the legend alike. Absent everywhere else.
   */
  overlay?: ReactNode;
  /**
   * FR-WIN-4 / D-240 (R47): a view that cannot stay mounted says why — the
   * window after a refused orientation permission (`denied`) or on a phone
   * whose readings carry no compass heading (`relative`). `SkyChart` shows
   * the one-line note, leaves the dome as the view and, for `relative`,
   * stops offering the view for the session. The dome and the polar never
   * call it.
   */
  onUnavailable?: (reason: 'denied' | 'relative') => void;
  /**
   * FR-STAR-11 / D-750 (R113): the bodies of the instant beyond what the props
   * above already carry — the star field, or `null` for none. R119 (FR-SKY-1,
   * FR-LIVE-10 as amended; D-788): one scene per page beside `passes`, and
   * every view reads it through the layer table (`layers.ts`): the window
   * draws every layer the scene carries, the polar chart and the dome the
   * stars to their cap and the planets, no figures and no names — by the
   * table, never by a condition of their own. Absent, every view draws
   * `ece8bfd`'s picture. No page builds a scene yet: `useSkyScene` exists from
   * R119, and R123 calls it on the live page and the pass detail; until then
   * they pass none. The passes stay on `passes`.
   */
  scene?: SkyScene;
  /**
   * FR-STAR-5 (R117, D-756): which of the sky screen's two inventories this
   * chart is on. `'stars'` (opened from `#stars`) has no pass, so nothing that
   * speaks of one is built: no legend rows, no empty-field chip (FR-GUT-6) and
   * no next-event block upright (FR-GUT-7). Absent, or `'passes'`, the live
   * page's and the pass detail's chart, unchanged.
   */
  inventory?: 'passes' | 'stars';
  /**
   * D-750 (R113): what drives the window's rotation. Absent, or
   * `SENSOR_CAMERA`, the phone's pose through `useDeviceOrientation`; a
   * `HandCamera`, the page's two numbers, moved by the drag and the keys the
   * window handles. Only the window reads it; the dome and the polar ignore it.
   */
  camera?: SkyCamera;
  /**
   * FR-STAR-7 / D-750 (R113): the index into the scene's catalogue of the star
   * (or, past the catalogue's length, the planet) the reader named by a tap or
   * from `In this field`, `null` for none — the list's and the drawing's one
   * shared selection. The window places the label (R116); the page holds the
   * value and clears it after `STAR_LABEL_HOLD_S`.
   */
  namedStar?: number | null;
  /** FR-STAR-7: the tap on a mark, or on nothing, asking the holder to set `namedStar`. */
  onNameStar?: (i: number | null) => void;
  /**
   * FR-SKY-2 / D-789 (R121): the window is this page's view, laid out in the
   * frame's box under the hand camera — `SkyChart` hands its slot to the view
   * it mounts, and the window fills it (its `camera` prop, given, wins). With
   * it the window asks the frame for the window's box on wide, draws the hand
   * hint in the box's corner, and places the facing picker: in the rail where
   * the page has one, in the controls row otherwise. Absent on the stars page,
   * which lays the frame out itself, and on a screen. The dome and the polar
   * chart ignore it.
   */
  hand?: HandSlot;
  /**
   * FR-SKY-7 / D-790 (R121): the facing picker's option list, from the page:
   * the pass detail's `PEAK_FACING_OPTIONS`, whose `peak` is the explained
   * pass's (`highlightedPassId`) and where the window opens; absent, the eight
   * points and the zenith. Read with `hand` by the window alone.
   */
  facingOptions?: readonly FacingOption[];
  className?: string;
}

/** One dimmed object for the chart to place (FR-LIVE-6). */
export interface HiddenMarker {
  /** Stable per object (`hidden-<noradId>`), for keys and the `data-hidden-id` the tests read. */
  id: string;
  azDeg: number;
  elDeg: number;
  /** The name and the reason, worded by the caller: "Cosmos 2369 · in shadow". */
  label: string;
}

/** Both implementations export this shape; `SkyChart.tsx` is the only file that knows two exist. The toggle's label is `Messages['chart']['view'][id]` (R17), not a field here. */
export interface SkyChartView {
  Component: ComponentType<SkyChartProps>;
  id: ChartView;
  /**
   * FR-WIN-4 / D-188 (R47): whether this device can show the view at all;
   * absent means always. The toggle offers only the available views, and a
   * saved preference for one that is not falls back to the dome.
   */
  available?: () => boolean;
  /**
   * D-240 (R47): called inside the tap that picks the view, before it mounts.
   * The window's orientation permission is requested here (FR-WIN-4: in the
   * tap that chooses the view, never on load), since iOS grants it only from
   * a user gesture and the view does not exist yet to ask.
   */
  choose?: () => void;
}
