import type { Pass, PassBoundaryReason } from '../model';
import { compassPoint, type CompassPoint } from './compass';
import { degrees, formatMagnitude } from './format';
import { formatClock } from './timeFormat';

/**
 * FR-GUIDE-1 / FR-GUIDE-3 / US-6 AC1, AC4: the words the guide is built from
 * and the sentence itself. Pure: the time zone is a parameter and the clock
 * never enters (D-15). Every band boundary is pinned by `phrases.test.ts`.
 */

/** Spelled-out 16-point names for prose ("west-southwest"); the card keeps the abbreviations. */
export const COMPASS_NAMES: Record<CompassPoint, string> = {
  N: 'north',
  NNE: 'north-northeast',
  NE: 'northeast',
  ENE: 'east-northeast',
  E: 'east',
  ESE: 'east-southeast',
  SE: 'southeast',
  SSE: 'south-southeast',
  S: 'south',
  SSW: 'south-southwest',
  SW: 'southwest',
  WSW: 'west-southwest',
  W: 'west',
  WNW: 'west-northwest',
  NW: 'northwest',
  NNW: 'north-northwest',
};

export function compassName(azDeg: number): string {
  return COMPASS_NAMES[compassPoint(azDeg)];
}

export type ElevationWord = 'low' | 'mid-sky' | 'high' | 'almost overhead';

/**
 * FR-GUIDE-1 elevation-to-words: 10–25° low, 25–50° mid-sky, 50–75° high,
 * above 75° almost overhead. A value on a boundary belongs to the higher band
 * (25° is mid-sky, 50° is high, 75° is almost overhead; PLAN D-32).
 */
export function elevationWord(elDeg: number): ElevationWord {
  if (elDeg < 25) return 'low';
  if (elDeg < 50) return 'mid-sky';
  if (elDeg < 75) return 'high';
  return 'almost overhead';
}

/** The elevation word as it reads inside the sentence's parenthesis. */
export function elevationPhrase(word: ElevationWord): string {
  switch (word) {
    case 'low':
      return 'low in the sky';
    case 'mid-sky':
      return 'mid-sky';
    case 'high':
      return 'high in the sky';
    case 'almost overhead':
      return 'almost overhead';
  }
}

export type BrightnessPhrase = 'brighter than Venus' | 'brighter than any star' | 'like a bright star' | 'like an average star' | 'faint, needs dark sky';

/**
 * FR-GUIDE-3 bands. Magnitudes grow fainter as they grow, so a value on a
 * boundary belongs to the brighter band (−4 is "brighter than Venus", −1.4 is
 * "brighter than any star", +1 is "like a bright star", +3 is "like an average star").
 */
export function brightnessPhrase(magnitude: number): BrightnessPhrase {
  if (magnitude <= -4) return 'brighter than Venus';
  if (magnitude <= -1.4) return 'brighter than any star';
  if (magnitude <= 1) return 'like a bright star';
  if (magnitude <= 3) return 'like an average star';
  return 'faint, needs dark sky';
}

/** US-6 AC4: how the pass ends, in words. The `horizon` reason is the 10° cutoff (spec §4.3), worded as the horizon for the reader. */
export function endReasonPhrase(reason: PassBoundaryReason): string {
  switch (reason) {
    case 'shadow':
      return "disappears into Earth's shadow";
    case 'horizon':
      return 'drops below the horizon';
    case 'twilight':
      return 'fades into the brightening sky';
  }
}

/** How the pass begins, in words; `low`/`mid-sky`/... is added by the sentence. */
export function startReasonPhrase(reason: PassBoundaryReason): string {
  switch (reason) {
    case 'shadow':
      return "emerges from Earth's shadow";
    case 'horizon':
      return 'appears';
    case 'twilight':
      return 'becomes visible as the sky darkens,';
  }
}

/** FR-VIS-7 label text, used on the card and in the guide. */
export const TWILIGHT_LABEL = 'sky still bright';
const TWILIGHT_CLAUSE = 'The sky will still be bright, so it may be hard to spot.';

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The US-6 AC1 sentence, e.g. "Appears low in the west-southwest at 21:14:32 UTC,
 * climbs to 62° (high in the sky) in the south at 21:17:50 UTC, disappears into
 * Earth's shadow in the east-northeast at 21:20:05 UTC. Brighter than any star
 * (magnitude −1.8)." plus the FR-VIS-7 clause when `twilight` is set.
 */
export function guideSentence(pass: Pass, timeZone: string | null): string {
  const at = (t: number): string => formatClock(t, timeZone);
  const start = `${capitalise(startReasonPhrase(pass.startReason))} ${elevationWord(pass.start.elDeg)} in the ${compassName(pass.start.azDeg)} at ${at(pass.start.t)}`;
  const peak = `climbs to ${degrees(pass.peak.elDeg)} (${elevationPhrase(elevationWord(pass.peak.elDeg))}) in the ${compassName(pass.peak.azDeg)} at ${at(pass.peak.t)}`;
  const end = `${endReasonPhrase(pass.endReason)} in the ${compassName(pass.end.azDeg)} at ${at(pass.end.t)}`;
  const brightness = `${capitalise(brightnessPhrase(pass.peakMagnitude))} (magnitude ${formatMagnitude(pass.peakMagnitude)}).`;
  const twilight = pass.twilight ? ` ${TWILIGHT_CLAUSE}` : '';
  return `${start}, ${peak}, ${end}. ${brightness}${twilight}`;
}
