import type { CatalogEntry } from '../../model';
import catalogJson from './catalog.json';
import { parseCatalog } from './schema';

/**
 * The MVP catalog (FR-SAT-1): ~30 hand-maintained bright objects, the single
 * source of per-object metadata (FR-SAT-5). Parsed once at module load; the
 * JSON is also validated by `catalog.test.ts` so CI catches a bad edit.
 */
export const CATALOG: readonly CatalogEntry[] = Object.freeze(parseCatalog(catalogJson));

export function catalogEntry(noradId: number): CatalogEntry | undefined {
  return CATALOG.find((e) => e.noradId === noradId);
}

export { parseCatalog, catalogSchema, catalogEntrySchema } from './schema';
