import { describe, expect, it } from 'vitest';
import stations from '../../../tests/fixtures/omm/2026-09-02-stations.json';
import type { NoradId, OmmRecord, SatelliteRecord } from '../../model';
import { selectOrbitHeight, type ElementsState } from './elements';

const iss = (stations as OmmRecord[]).find((r) => r.NORAD_CAT_ID === 25544);
if (!iss) throw new Error('fixture has no ISS');
const record = { catalog: { noradId: 25544 as NoradId }, omm: iss, epochMs: 0 } as unknown as SatelliteRecord;
const ready: ElementsState = { status: 'ready', records: [record], unavailable: [], rejected: [], fetchedAt: 0, stale: false, persistent: true };

describe('selectOrbitHeight', () => {
  it('FR-FACT-1: reads the height from the record the slice holds', () => {
    expect(selectOrbitHeight(ready, 25544 as NoradId)).toEqual({ kind: 'one', km: 420 });
  });

  it('FR-FACT-1: null before the elements load and for an id the slice does not hold', () => {
    expect(selectOrbitHeight({ status: 'loading' }, 25544 as NoradId)).toBeNull();
    expect(selectOrbitHeight(ready, 20580 as NoradId)).toBeNull();
  });
});
