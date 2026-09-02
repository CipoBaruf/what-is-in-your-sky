import type { CatalogEntry, ElementGroup, NoradId, OmmRecord, SatelliteRecord } from '../model';
import { parseOmmEpoch } from '../physics/time';
import { fetchGroup, type FetchGroupOptions } from './celestrak';

/**
 * PLAN §7.1 without the cache branch (that is R11): fetch `stations` and
 * `visual` (FR-SAT-2, two requests, never `CATNR`), dedupe with `stations`
 * winning, and filter to the catalog. A catalog id absent from both groups is
 * reported in `unavailable` and logged with a warning, never thrown (FR-SAT-2).
 *
 * `parseOmmEpoch` comes from `src/physics/time`, a dependency-free module; the
 * §3 boundary rules (R5) need to allow that leaf or move it (see PLAN D-21).
 */
export const ELEMENT_GROUPS: readonly ElementGroup[] = ['stations', 'visual'];

export interface LoadedElements {
  records: SatelliteRecord[];
  /** Catalog ids present in neither group, in catalog order. */
  unavailable: NoradId[];
  /** Records received per group after schema validation, for diagnostics. */
  counts: Record<ElementGroup, number>;
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

export type LoadElementsOptions = FetchGroupOptions;

export async function loadElements(catalog: readonly CatalogEntry[], options: LoadElementsOptions = {}): Promise<LoadedElements> {
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const [stations, visual] = await Promise.all(ELEMENT_GROUPS.map((group) => fetchGroup(group, { ...options, warn })));
  const groups = { stations: stations ?? [], visual: visual ?? [] };
  const { records, unavailable } = filterToCatalog(catalog, mergeGroups(groups));
  if (unavailable.length > 0) {
    const names = unavailable.map((id) => `${String(id)} ${catalog.find((e) => e.noradId === id)?.name ?? ''}`.trim());
    warn(`Catalog objects absent from CelesTrak ${ELEMENT_GROUPS.join('+')} (skipped): ${names.join(', ')}`);
  }
  return { records, unavailable, counts: { stations: groups.stations.length, visual: groups.visual.length } };
}
