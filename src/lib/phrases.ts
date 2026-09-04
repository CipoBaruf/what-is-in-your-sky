import type { EpochMs, Locale, Pass, PassBoundaryReason } from '../model';
import { compassPoint, type CompassPoint } from './compass';
import { degrees, formatMagnitude } from './format';
import { formatClock } from './timeFormat';

/**
 * FR-GUIDE-1 / FR-GUIDE-3 / US-6 AC1, AC4: the bands the guide is built from
 * and the parameters its sentence is written with. Pure: the time zone is a
 * parameter and the clock never enters (D-15). Every band boundary is pinned
 * by `phrases.test.ts`.
 *
 * R17 (FR-I18N-2): nothing here returns a sentence, or a word of one. The
 * bands are keys the message catalogs translate, and `guideParams` is the
 * parameter list `Messages['guide']['sentence']` takes, so word order,
 * agreement and the position of every number belong to the language, not to
 * this file.
 */

/**
 * FR-GUIDE-1 elevation-to-words: 10–25° low, 25–50° mid-sky, 50–75° high,
 * above 75° almost overhead. A value on a boundary belongs to the higher band
 * (25° is mid-sky, 50° is high, 75° is almost overhead; PLAN D-32).
 */
export type ElevationBand = 'low' | 'mid' | 'high' | 'overhead';

export function elevationBand(elDeg: number): ElevationBand {
  if (elDeg < 25) return 'low';
  if (elDeg < 50) return 'mid';
  if (elDeg < 75) return 'high';
  return 'overhead';
}

/**
 * FR-GUIDE-3 bands. Magnitudes grow fainter as they grow, so a value on a
 * boundary belongs to the brighter band (−4 is "brighter than Venus", −1.4 is
 * "brighter than any star", +1 is "like a bright star", +3 is "like an
 * average star").
 */
export type BrightnessBand = 'venus' | 'any-star' | 'bright-star' | 'average-star' | 'faint';

export function brightnessBand(magnitude: number): BrightnessBand {
  if (magnitude <= -4) return 'venus';
  if (magnitude <= -1.4) return 'any-star';
  if (magnitude <= 1) return 'bright-star';
  if (magnitude <= 3) return 'average-star';
  return 'faint';
}

/** Everything the FR-GUIDE-1 sentence is made of; the times and numbers are already in the reader's language and the observer's zone. */
export interface GuideParams {
  /** How the pass begins and ends (US-6 AC4); `horizon` is the 10° cutoff, worded as the horizon for the reader. */
  startReason: PassBoundaryReason;
  startBand: ElevationBand;
  startDir: CompassPoint;
  startTime: string;
  peakDegrees: string;
  peakBand: ElevationBand;
  peakDir: CompassPoint;
  peakTime: string;
  endReason: PassBoundaryReason;
  endDir: CompassPoint;
  endTime: string;
  brightness: BrightnessBand;
  magnitude: string;
  /** FR-VIS-7: the sentence gains a clause about the still-bright sky. */
  twilight: boolean;
}

export function guideParams(pass: Pass, timeZone: string | null, locale: Locale): GuideParams {
  const at = (t: EpochMs): string => formatClock(t, timeZone, locale);
  return {
    startReason: pass.startReason,
    startBand: elevationBand(pass.start.elDeg),
    startDir: compassPoint(pass.start.azDeg),
    startTime: at(pass.start.t),
    peakDegrees: degrees(pass.peak.elDeg),
    peakBand: elevationBand(pass.peak.elDeg),
    peakDir: compassPoint(pass.peak.azDeg),
    peakTime: at(pass.peak.t),
    endReason: pass.endReason,
    endDir: compassPoint(pass.end.azDeg),
    endTime: at(pass.end.t),
    brightness: brightnessBand(pass.peakMagnitude),
    magnitude: formatMagnitude(pass.peakMagnitude, locale),
    twilight: pass.twilight,
  };
}
