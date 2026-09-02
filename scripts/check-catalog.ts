/**
 * Live catalog membership check (PLAN §7.4, TASKS R3): every catalog NORAD id
 * must be present in CelesTrak's `visual` or `stations` group, otherwise the
 * object has decayed or moved and the catalog needs editing.
 *
 *   npx tsx scripts/check-catalog.ts
 *
 * Network access is intentional here (manual / scheduled); nothing in the test
 * suite calls this. Prints `present: N, missing: M` and exits 1 when M > 0.
 */
import { CATALOG } from '../src/data/catalog';
import { fetchGroup } from '../src/data/celestrak';
import { ELEMENT_GROUPS, filterToCatalog, mergeGroups } from '../src/data/elementsLoader';
import type { ElementGroup, OmmRecord } from '../src/model';

const groups = {} as Record<ElementGroup, OmmRecord[]>;
for (const group of ELEMENT_GROUPS) {
  groups[group] = await fetchGroup(group);
  console.log(`${group}: ${String(groups[group].length)} records`);
}
const merged = mergeGroups(groups);
const { records, unavailable } = filterToCatalog(CATALOG, merged);

for (const record of records) {
  console.log(`  ok ${String(record.catalog.noradId).padStart(6)} ${record.catalog.name.padEnd(28)} epoch ${record.omm.EPOCH}`);
}
for (const id of unavailable) {
  console.log(`  MISSING ${String(id).padStart(6)} ${CATALOG.find((e) => e.noradId === id)?.name ?? ''}`);
}
console.log(`present: ${String(records.length)}, missing: ${String(unavailable.length)}`);
process.exit(unavailable.length > 0 ? 1 : 0);
