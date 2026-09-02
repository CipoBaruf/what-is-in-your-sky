// Types only (PLAN §5). The catalog JSON itself and its schema arrive in R3.
export type NoradId = number;
export type SatCategory = 'station' | 'payload' | 'rocket-body';
export interface CatalogEntry {
  noradId: NoradId;
  name: string; // display name, e.g. "ISS (Zarya)"
  category: SatCategory;
  stdMag: number; // standard magnitude at 1000 km, 90° phase (D-1)
  stdMagSource: { source: string; date: string; note?: string }; // FR-SAT-5 provenance
  description?: string; // one sentence for the card
  featured?: boolean; // ISS hero card (spec §8 rank 1)
}
