import type { Locale, MoonGlare, MoonGlareThresholds, MoonPhaseName, MoonState } from '../model';
import { compassPoint, type CompassPoint } from './compass';
import { degrees } from './format';

/**
 * FR-MOON-2/3/4/5: what the Moon's rows are made of, as keys, flags and
 * already-formatted numbers — never as sentences (FR-I18N-2, the rule
 * `phrases.ts` follows for the guide). The phase is a key the catalogs name in
 * their own language, the percentage and the degrees are the same digits in
 * both, and where the words go is the catalog's business.
 *
 * The tradition text is the one thing this file does not own: it is a
 * hand-reviewed file (FR-MOON-4) and PLAN §3 keeps `src/lib` out of
 * `src/data`, so the entries arrive as parameters and this file only decides
 * *which* of them the reader sees (D-121). Nothing here is an observing fact
 * about the lore, and nothing about the lore reaches the facts (FR-MOON-5).
 */

/** FR-MOON-3: the Moon's own row, for the Now panel and the live strip. */
export interface MoonFacts {
  phase: MoonPhaseName;
  /** The lit fraction as whole percent, without the sign: "74". */
  illumination: string;
  /** Above the horizon at this instant. When false, the direction and the elevation are not shown. */
  up: boolean;
  direction: CompassPoint;
  azimuth: string;
  elevation: string;
}

export function moonFacts(moon: MoonState): MoonFacts {
  return {
    phase: moon.phase,
    illumination: percent(moon.illuminatedFraction),
    up: moon.elDeg > 0,
    direction: compassPoint(moon.azDeg),
    azimuth: degrees(moon.azDeg),
    elevation: degrees(moon.elDeg),
  };
}

/**
 * FR-MOON-2: what the `[moon glare]` label's tooltip says. The thresholds are
 * parameters because they live in `physics/constants.ts` and OQ-12 may still
 * move them; the UI reads them through `src/state`, as it reads the
 * visibility thresholds (D-27).
 */
export interface MoonGlareFacts {
  illumination: string;
  separation: string;
  minIllumination: string;
  maxSeparation: string;
}

export function moonGlareFacts(moon: MoonState, glare: MoonGlare, thresholds: MoonGlareThresholds): MoonGlareFacts {
  return {
    illumination: percent(moon.illuminatedFraction),
    separation: degrees(glare.separationDeg),
    minIllumination: percent(thresholds.minIlluminatedFraction),
    maxSeparation: degrees(thresholds.maxSeparationDeg),
  };
}

/**
 * One line of the lore file in both languages. Structurally the same type as
 * `data/moon`'s `LocalizedText`, declared here because §3 forbids the import
 * (D-121); `moonPhrases.test.ts` passes the real entries through it, so a
 * change to the file's shape fails there.
 */
export type LocalizedLine = Record<Locale, string>;

/** The entries the "Moon tonight" line is built from; `fullMoon` is null unless `showsFullMoonName` says it is that night (FR-MOON-4). */
export interface MoonLoreEntries {
  sign: { name: LocalizedLine; line: LocalizedLine };
  phase: { line: LocalizedLine };
  fullMoon: { name: LocalizedLine } | null;
  hemisphereNote: LocalizedLine;
}

/** The tradition line's parameters, in the reader's language. Tradition only: no observing fact is derived from any of it (FR-MOON-5). */
export interface MoonLoreParams {
  sign: string;
  /** The folk name of this month's full Moon, or null when the Moon is not within a day of full. */
  fullMoonName: string | null;
  /** The curated one-liner, of the phase or of the sign (D-123). */
  line: string;
  /** The file's own note that the folk names follow the northern seasons; shown with the name and never alone (FR-MOON-4). */
  hemisphereNote: string | null;
}

export function moonLoreParams(entries: MoonLoreEntries, moon: MoonState, locale: Locale): MoonLoreParams {
  return {
    sign: entries.sign.name[locale],
    fullMoonName: entries.fullMoon ? entries.fullMoon.name[locale] : null,
    line: (loreLineSource(moon.phase) === 'phase' ? entries.phase.line : entries.sign.line)[locale],
    hemisphereNote: entries.fullMoon ? entries.hemisphereNote[locale] : null,
  };
}

/**
 * D-123: which of the file's two one-liners the line carries. At the four
 * phases the old calendars turn on, the phase is the tradition worth naming;
 * on the nights in between it is unremarkable and the sign — which the line
 * already names — is what has changed. Every phase and every sign comes round
 * within a month, so both halves of the reviewed file are read.
 */
export function loreLineSource(phase: MoonPhaseName): 'phase' | 'sign' {
  return phase === 'new' || phase === 'firstQuarter' || phase === 'full' || phase === 'lastQuarter' ? 'phase' : 'sign';
}

/**
 * How far the phase angle moves in a day: 360° over a synodic month of
 * 29.530589 days. FR-MOON-4 shows the folk name "within one day of full", and
 * full is 180° of phase angle, so one day is this much either side of it.
 */
export const MOON_PHASE_DEG_PER_DAY = 360 / 29.530589;

/** FR-MOON-4: is this Moon within a day of full, the window the folk name is shown in? */
export function showsFullMoonName(moon: MoonState): boolean {
  return Math.abs(moon.phaseAngleDeg - 180) <= MOON_PHASE_DEG_PER_DAY;
}

/** Whole percent, the way the cloud badge writes its cover: the digits are the same in both languages (FR-I18N-4). */
function percent(fraction: number): string {
  return String(Math.round(fraction * 100));
}
