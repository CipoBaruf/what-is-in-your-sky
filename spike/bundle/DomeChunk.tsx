import { DEFAULT_DOME, SpikeDome } from '../SpikeDome';
import { GOLDEN_PASS } from '../passes';

export default function DomeChunk() {
  const colors = new URLSearchParams(window.location.search).get('colors') === '1';
  return (
    <div className="dome" data-spike-dome>
      <SpikeDome pass={GOLDEN_PASS} params={{ ...DEFAULT_DOME, colors }} riseLabel="ISS" />
    </div>
  );
}
