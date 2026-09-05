import { useMemo } from 'react';
import { declinationDeg, type DeclinationSite } from '../../../lib/declination';
import type { Observer } from '../../../model';

/**
 * R44 (FR-WIN-3, US-21 AC6; F-41, D-185): the local magnetic declination for
 * the live page's observer, evaluated once and kept until the observer moves.
 *
 * D-185 puts the evaluation on the main thread and caches it per observer:
 * building the World Magnetic Model means interpolating some ninety
 * coefficients to the date, which is nothing once and waste at sixty readings
 * a second, and the worker has no part in it — the correction is a property of
 * where the viewer is standing, not of any satellite.
 *
 * The clock is read here, in the UI, and not in `src/lib` (D-15). The value
 * moves by a few hundredths of a degree a year, so "now" at the moment the
 * observer changed is the same number as "now" an hour later to every digit
 * the strip prints; that is what buys the memo, and why nothing re-evaluates
 * it on the 10 s tick.
 */
export function useDeclination(observer: Pick<Observer, 'lat' | 'lon' | 'altM'>): number {
  const { lat, lon, altM } = observer;
  return useMemo(() => {
    const site: DeclinationSite = { lat, lon, altM };
    return declinationDeg(site, new Date());
  }, [lat, lon, altM]);
}
