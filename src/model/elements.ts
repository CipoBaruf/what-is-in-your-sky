import type { CatalogEntry } from './catalog';
import type { EpochMs } from './thresholds';

// CelesTrak OMM JSON field names, verbatim (PLAN §5).
export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  EPOCH: string; // ISO 8601, UTC (CelesTrak omits the zone suffix)
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export type ElementGroup = 'visual' | 'stations';

export interface CachedGroup {
  group: ElementGroup;
  fetchedAt: EpochMs;
  records: OmmRecord[];
}

/** What the UI and worker share; the satrec stays in the worker. */
export interface SatelliteRecord {
  catalog: CatalogEntry;
  omm: OmmRecord;
  epochMs: EpochMs; // parsed from omm.EPOCH, for the age warning (FR-SAT-4)
}
