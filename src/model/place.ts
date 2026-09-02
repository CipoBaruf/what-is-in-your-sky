/**
 * One geocoding result (PLAN §7.2). `admin1` and `country` are absent when
 * the provider has none (a country-level result such as "Singapore" carries no
 * `admin1`); the label rule joins whatever is present.
 */
export interface Place {
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
  elevationM: number;
  timeZone: string; // IANA, always present in Open-Meteo geocoding results
}
