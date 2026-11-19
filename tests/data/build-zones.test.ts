import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlaces } from '../../src/data/places/nearestPlace';
import { buildZones, foldName, hundredths } from '../../scripts/build-zones';

// FR-OPEN-1 (D-1173, V216-15, V216-18): a fixture of tzdata 2026f's rows.
const ZONE_TAB = `# tzdb timezone descriptions
SE\t+5920+01803\tEurope/Stockholm
DE\t+5230+01322\tEurope/Berlin
FR\t+4852+00220\tEurope/Paris
BR\t-2332-04637\tAmerica/Sao_Paulo
IN\t+2232+08822\tAsia/Kolkata
`;
const ZONE1970_TAB = `# tzdb timezone descriptions
DE,DK,NO,SE,SJ\t+5230+01322\tEurope/Berlin
FR,MC\t+4852+00220\tEurope/Paris
BR\t-2332-04637\tAmerica/Sao_Paulo
IN\t+2232+08822\tAsia/Kolkata
AQ\t-6617+11031\tAntarctica/Casey
`;
const BACKWARD = `# Links
Link\tEurope/Berlin\t\tEurope/Stockholm
Link\tAsia/Kolkata\t\tAsia/Calcutta
Link\tAmerica/Sao_Paulo\tBrazil/East\t#= Brazil/East
Link\tEtc/UTC\t\t\tUTC
`;
// A district at Paris's very coordinates, and Paris 1.8 km off.
const PLACES = `# fixture
=BR
São Paulo\t-2355\t-4664
=FR
Paris 09 Opéra\t4887\t233
Paris\t-1\t2
=SE
Stockholm\t5933\t1807
`;
const RELEASE = 'tzdata 2026f, a fixture.';

describe('buildZones (FR-OPEN-1, D-1173)', () => {
  const out = buildZones({ zoneTab: ZONE_TAB, zone1970Tab: ZONE1970_TAB, backward: BACKWARD, release: RELEASE }, parsePlaces(PLACES));

  it('FR-OPEN-1: writes the rows of both files, zone.tab first, then the aliases that are not rows', () => {
    expect(out.split('\n').slice(1)).toEqual([
      'America/Sao_Paulo\t-2353\t-4662\tSão Paulo',
      'Antarctica/Casey\t-4275\t15714',
      'Asia/Kolkata\t8881\t-2215',
      'Europe/Berlin\t2997\t-7500',
      'Europe/Paris\t-363\t-1104',
      'Europe/Stockholm\t1046\t1572',
      '=Asia/Calcutta\tAsia/Kolkata',
      '=Brazil/East\tAmerica/Sao_Paulo',
      '',
    ]);
    expect(out.startsWith(`# ${RELEASE} `)).toBe(true);
  });

  it('V216-18: a nearer district never names the zone; a town of the same name gives its spelling', () => {
    expect(out).toContain('Europe/Paris\t-363\t-1104\n');
    expect(out).not.toContain('Opéra');
    expect(out).toContain('\tSão Paulo\n');
  });

  it('V216-15: a merged zone keeps its own row, not an alias of its target', () => {
    expect(out).toContain('Europe/Stockholm\t');
    expect(out).not.toContain('=Europe/Stockholm');
  });

  it('reads ISO 6709 with and without seconds, and folds names', () => {
    expect(hundredths('+5920+01803')).toEqual({ lat: 5933, lon: 1805 });
    expect(hundredths('-332712-0702836')).toEqual({ lat: -3345, lon: -7048 });
    expect(() => hundredths('5920+01803')).toThrow();
    expect(foldName("St. John's")).toBe(foldName('St_Johns'));
    expect(foldName('Ürümqi')).toBe('urumqi');
  });

  it('the committed table is what the vendored files build (a rerun leaves it unchanged)', () => {
    const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
    const tz = { zoneTab: read('../../scripts/data/tz/zone.tab'), zone1970Tab: read('../../scripts/data/tz/zone1970.tab'), backward: read('../../scripts/data/tz/backward'), release: read('../../scripts/data/tz/README.md').split('\n')[0] ?? '' };
    expect(buildZones(tz, parsePlaces(read('../../src/data/places/places.txt')))).toBe(read('../../src/data/zones/zones.txt'));
  });
});
