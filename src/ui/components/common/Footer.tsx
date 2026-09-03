import styles from './Footer.module.css';

/**
 * FR-X-2 (R12): every external data source credited as its terms ask.
 * CelesTrak (orbital elements, free with attribution); Open-Meteo (weather
 * forecast and place-name geocoding, CC BY 4.0); GeoNames, from which
 * Open-Meteo's geocoding data derives (CC BY 4.0). OpenStreetMap / Nominatim
 * joins in v1 with the proxy. The three sentences are exported so tests pin
 * them. The links are navigation targets, never fetched (FR-X-3: the app
 * connects to CelesTrak and Open-Meteo only, see `tests/deploy/headers.test.ts`).
 */
export const ATTRIBUTIONS = {
  celestrak: 'Orbital elements by CelesTrak.',
  openMeteo: 'Weather data by Open-Meteo.com (CC BY 4.0).',
  geonames: 'Place search by Open-Meteo geocoding, with data from GeoNames (CC BY 4.0).',
} as const;

export const PRIVACY_NOTE = 'No analytics, no tracking: your location is saved in this browser only.';

export interface FooterProps {
  /** True while the detail sheet is up (D-13): the footer leaves the tab order like the rest of the page. */
  inert?: boolean;
}

export function Footer({ inert = false }: FooterProps) {
  return (
    <footer inert={inert} className={styles.footer}>
      <p className={styles.line}>
        Orbital elements by <a href="https://celestrak.org/">CelesTrak</a>.
      </p>
      <p className={styles.line}>
        Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0).
      </p>
      <p className={styles.line}>
        Place search by Open-Meteo geocoding, with data from <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0).
      </p>
      <p className={styles.line}>{PRIVACY_NOTE}</p>
    </footer>
  );
}
