/** `example`: the zone city's observer on a first visit, never stored (FR-OPEN-2, D-1175). */
type ObserverSource = 'geocode' | 'coords' | 'device' | 'example';

export interface Observer {
  lat: number;
  lon: number;
  altM: number;
  label: string; // "Neuquén, Neuquén, Argentina" or "−38.93, −67.99"
  source: ObserverSource;
  timeZone: string | null; // IANA; null until known (D-3)
  accuracyM?: number; // Geolocation only
}
