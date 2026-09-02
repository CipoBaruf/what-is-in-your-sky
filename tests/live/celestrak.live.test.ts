/**
 * LIVE=1 only (PLAN §9.1 "Live contract"): CelesTrak still serves both groups
 * as OMM JSON the schema accepts, with `access-control-allow-origin: *` for a
 * cross-origin request, and every catalog object is still in one of them.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/data/catalog';
import { groupUrl, parseGroupBody } from '../../src/data/celestrak';
import { ELEMENT_GROUPS, filterToCatalog, mergeGroups } from '../../src/data/elementsLoader';
import type { ElementGroup, OmmRecord } from '../../src/model';

const LIVE = process.env['LIVE'] === '1';
const ORIGIN = 'https://what-is-in-your-sky.example';

describe.skipIf(!LIVE)('CelesTrak live contract', () => {
  const groups = {} as Record<ElementGroup, OmmRecord[]>;

  for (const group of ELEMENT_GROUPS) {
    it(`${group}: 200, CORS header is *, and the body parses as OMM records`, async () => {
      const response = await fetch(groupUrl(group), { headers: { Origin: ORIGIN } });
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      const dropped: string[] = [];
      groups[group] = parseGroupBody(await response.json(), group, (m) => dropped.push(m));
      expect(groups[group].length).toBeGreaterThan(0);
      expect(dropped, dropped.join('\n')).toEqual([]);
    }, 60_000);
  }

  it('every catalog object is present in visual or stations', () => {
    const { records, unavailable } = filterToCatalog(CATALOG, mergeGroups(groups));
    const missing = unavailable.map((id) => `${String(id)} ${CATALOG.find((e) => e.noradId === id)?.name ?? ''}`);
    expect(missing, `missing from CelesTrak: ${missing.join(', ')}`).toEqual([]);
    expect(records).toHaveLength(CATALOG.length);
  });
});
