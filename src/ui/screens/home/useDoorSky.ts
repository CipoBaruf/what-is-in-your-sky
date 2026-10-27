import { useEffect, useMemo, useState } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { landmarkLine, landmarkNames } from '../../../lib/landmarkLine';
import type { EpochMs, Observer, Pass } from '../../../model';
import { prefetchStarsWhenIdle } from '../starsChunk';
import type { DoorSky } from './doorLines';

type StarsModule = typeof import('../Stars');

/** The doors' sky is re-read once a minute: a star's 16-point direction and the Moon's set time move slower than that. */
const DOOR_SKY_STEP_MS = 60_000;

/**
 * R130 (FR-FLOW-1, D-843): what only the `stars` chunk can tell the doors — the
 * brightest thing drawn now (`brightestDrawn`), the Moon, and the next event's
 * pass's landmark (FR-SKY-11, the scene's, worded by `lib/landmarkLine.ts`).
 * The chunk is fetched once the browser is idle (`prefetchStarsWhenIdle`), and
 * until it lands this is `null`, which the doors draw as reserved lines.
 */
export function useDoorSky(observer: Observer, now: EpochMs, pass: Pass | null): DoorSky | null {
  const t = useT();
  const locale = useLocale();
  const [chunk, setChunk] = useState<StarsModule | null>(null);
  useEffect(() => {
    let live = true;
    const cancel = prefetchStarsWhenIdle((module) => {
      if (live) setChunk(module);
    });
    return () => {
      live = false;
      cancel();
    };
  }, []);
  const at = Math.floor(now / DOOR_SKY_STEP_MS) * DOOR_SKY_STEP_MS;
  const { lat, lon } = observer;
  const passId = pass?.id ?? null;
  const peak = pass?.peak ?? null;
  return useMemo(() => {
    if (chunk === null) return null;
    const where = { lat, lon };
    const source = chunk.starSource();
    let landmark: DoorSky['landmark'] = null;
    if (passId !== null && peak !== null) {
      const found = source.sceneAt(where, at, { id: passId, peak: { azDeg: peak.azDeg, elDeg: peak.elDeg, t: peak.t } }).landmark;
      if (found && found.passId === passId) {
        const star = found.star;
        landmark = {
          line: landmarkLine(found, landmarkNames(source.names, source.catalog.con, locale), t.live),
          star: star === null ? null : { name: source.names.star(star.index, locale), word: star.word },
        };
      }
    }
    return { brightest: chunk.brightestNow(where, at, locale), moon: chunk.moonNow(where, at), landmark };
  }, [chunk, lat, lon, at, passId, peak, locale, t]);
}
