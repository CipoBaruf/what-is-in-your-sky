export type ObserverSource = 'geocode' | 'coords' | 'device';

export interface Observer {
  lat: number;
  lon: number;
  altM: number;
  label: string; // "Neuquén, Neuquén, Argentina" or "−38.93, −67.99"
  source: ObserverSource;
  timeZone: string | null; // IANA; null until known (D-3)
  accuracyM?: number; // Geolocation only
}
