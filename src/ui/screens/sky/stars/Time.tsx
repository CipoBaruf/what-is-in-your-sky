import { lazy, Suspense } from 'react';
import type { Playback } from '../../../components/sky/time/usePlayback';
import { loadGlobeRail } from '../../stars/globeChunk';

/**
 * R186 (FR-WIDE-1, D-1098): the wide stars page's `Time` row — the globe's own time (FR-GLOBE-7), today's control,
 * lazy with the globe's rail; the window and the dome stand at the real time and draw no row. R187 makes it shared.
 */
const GlobeTime = lazy(() => loadGlobeRail().then((module) => ({ default: module.GlobeTime })));

export function StarsTime({ playback, zone }: { playback: Playback; zone: string | null }) {
  return (
    <Suspense fallback={null}>
      <GlobeTime playback={playback} zone={zone} />
    </Suspense>
  );
}
