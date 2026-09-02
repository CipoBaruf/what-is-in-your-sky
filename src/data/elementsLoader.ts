import type { CatalogEntry, ElementGroup, EpochMs, NoradId, OmmRecord, SatelliteRecord } from '../model';
import { parseOmmEpoch } from '../physics/time';
import type { FetchGroupOptions } from './celestrak';
import { appElementsCache, ELEMENT_GROUPS, type ElementsCache } from './elementsCache';

/**
 * PLAN §7.1: `stations` and `visual` come through the elements cache (R11:
 * IndexedDB, 2 h rule, single-flight, stale fallback — `elementsCache.ts`),
 * never per object (FR-SAT-2, no `CATNR`); the groups are deduped with
 * `stations` winning and filtered to the catalog. A catalog id absent from
 * both groups is reported in `unavailable` and logged with a warning, never
 * thrown (FR-SAT-2).
 *
 * `parseOmmEpoch` comes from `src/physics/time`, a dependency-free module
 * whitelisted for `src/data` (PLAN D-21).
 */
export { ELEMENT_GROUPS };

export interface LoadedElements {
  records: SatelliteRecord[];
  /** Catalog ids present in neither group, in catalog order. */
  unavailable: NoradId[];
  /** Records received per group after schema validation, for diagnostics. */
  counts: Record<ElementGroup, number>;
  /** The older of the two groups' fetch times (client clock): when the set in use was last confirmed with CelesTrak. */
  fetchedAt: EpochMs;
  /** True when CelesTrak could not be reached and a copy past the 2 h rule is in use (FR-SAT-6). */
  stale: boolean;
  /** False when the copy lives only in memory for this session (IndexedDB unavailable, PLAN §7.1). */
  persistent: boolean;
}

/** Dedupe by NORAD id; `stations` wins over `visual` (PLAN §7.1). */
export function mergeGroups(groups: Record<ElementGroup, OmmRecord[]>): Map<NoradId, OmmRecord> {
  const merged = new Map<NoradId, OmmRecord>();
  for (const record of groups.visual) merged.set(record.NORAD_CAT_ID, record);
  for (const record of groups.stations) merged.set(record.NORAD_CAT_ID, record);
  return merged;
}

/** Keep catalog order; report the ids that have no elements. */
export function filterToCatalog(
  catalog: readonly CatalogEntry[],
  merged: ReadonlyMap<NoradId, OmmRecord>,
): { records: SatelliteRecord[]; unavailable: NoradId[] } {
  const records: SatelliteRecord[] = [];
  const unavailable: NoradId[] = [];
  for (const entry of catalog) {
    const omm = merged.get(entry.noradId);
    if (omm) records.push({ catalog: entry, omm, epochMs: parseOmmEpoch(omm.EPOCH) });
    else unavailable.push(entry.noradId);
  }
  return { records, unavailable };
}

export interface LoadElementsOptions extends FetchGroupOptions {
  /** The cache to go through; defaults to the app's (browser IndexedDB, Web Locks, wall clock). Tests pass their own. */
  cache?: ElementsCache;
}

export async function loadElements(catalog: readonly CatalogEntry[], options: LoadElementsOptions = {}): Promise<LoadedElements> {
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const { cache = appElementsCache(), ...fetchOptions } = options;
  const { groups, stale, persistent } = await cache.load({ ...fetchOptions, warn });
  const { records, unavailable } = filterToCatalog(catalog, mergeGroups({ stations: groups.stations.records, visual: groups.visual.records }));
  if (unavailable.length > 0) {
    const names = unavailable.map((id) => `${String(id)} ${catalog.find((e) => e.noradId === id)?.name ?? ''}`.trim());
    warn(`Catalog objects absent from CelesTrak ${ELEMENT_GROUPS.join('+')} (skipped): ${names.join(', ')}`);
  }
  return {
    records,
    unavailable,
    counts: { stations: groups.stations.records.length, visual: groups.visual.records.length },
    fetchedAt: Math.min(groups.stations.fetchedAt, groups.visual.fetchedAt),
    stale,
    persistent,
  };
}
