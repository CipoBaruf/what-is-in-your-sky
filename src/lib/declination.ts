import { model } from 'geomagnetism';
import type { Observer } from '../model';

/**
 * R44 (FR-WIN-3, FR-LIVE-8 as amended, US-21 AC6; F-41, D-185): the local
 * magnetic declination, the angle from true north to magnetic north, positive
 * east. A phone's compass reads magnetic north; the sky's azimuths are true,
 * so a heading used as a facing is wrong by this angle — 1.1° at Neuquén, 12°
 * in Sydney, 13° west in New York.
 *
 * **The one file that imports `geomagnetism`** (D-185, PLAN §3's boundary
 * rule in `eslint.config.js`; Apache-2.0, SPEC §11.1). The whole package is
 * imported rather than `lib/model.js` with a single coefficient file: the deep
 * import saves 2 KB gzipped of a 6.2 KB dependency and reaches into an
 * unexported path a patch release may move. It is CommonJS with `require`d
 * JSON, which Vite pre-bundles.
 *
 * Pure and clock-free (D-15): the instant enters as a parameter, as everywhere
 * else in `src/lib`. It is a `Date` and not an `EpochMs` because that is what
 * the World Magnetic Model is selected and interpolated by, and building one
 * here would mean reading the clock. The value moves by a fraction of a degree
 * a year, so the caller evaluates it once per observer (`useDeclination`) and
 * not once per reading.
 */

/** Where the observer is; the label, the zone and the rest of `Observer` play no part. */
export type DeclinationSite = Pick<Observer, 'lat' | 'lon' | 'altM'>;

/**
 * The declination at `site` on `date`, degrees east of true north.
 *
 * The WMM is valid for five years at a time and `geomagnetism` carries
 * WMM2015 through WMM2025, picking the model whose span holds `date`.
 * `allowOutOfBoundsModel` is on: outside them all — a phone with a wrong
 * clock, or any day after WMM2025 expires in November 2029 on a static site
 * nobody has redeployed — the nearest model is extrapolated instead of
 * throwing, which is a correction growing a few tenths of a degree stale
 * against a live page that would otherwise not render at all.
 */
export function declinationDeg(site: DeclinationSite, date: Date): number {
  // The WMM takes the height above the ellipsoid in kilometres; the observer carries metres.
  return model(date, { allowOutOfBoundsModel: true }).point([site.lat, site.lon, site.altM / 1000]).decl;
}
