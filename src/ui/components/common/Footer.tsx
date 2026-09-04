import type { LinkedText } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import styles from './Footer.module.css';

/**
 * FR-X-2 (R12): every external data source credited as its terms ask.
 * CelesTrak (orbital elements, free with attribution); Open-Meteo (weather
 * forecast and place-name geocoding, CC BY 4.0); GeoNames, from which
 * Open-Meteo's geocoding data derives (CC BY 4.0). OpenStreetMap / Nominatim
 * joins in v1 with the proxy. R17: the three sentences are messages whose
 * link position each language chooses (`LinkedText`); the provider names in
 * them are never translated (FR-I18N-6). The links are navigation targets,
 * never fetched (FR-X-3: the app connects to CelesTrak and Open-Meteo only,
 * see `tests/deploy/headers.test.ts`).
 */
export const ATTRIBUTION_URLS = {
  celestrak: 'https://celestrak.org/',
  openMeteo: 'https://open-meteo.com/',
  geonames: 'https://www.geonames.org/',
} as const;

export interface FooterProps {
  /** True while the detail sheet is up (D-13): the footer leaves the tab order like the rest of the page. */
  inert?: boolean;
}

function Attribution({ text, href }: { text: LinkedText; href: string }) {
  return (
    <p className={styles.line}>
      {text.before}
      <a href={href}>{text.link}</a>
      {text.after}
    </p>
  );
}

export function Footer({ inert = false }: FooterProps) {
  const t = useT();
  return (
    <footer inert={inert} className={styles.footer}>
      <Attribution text={t.footer.celestrak} href={ATTRIBUTION_URLS.celestrak} />
      <Attribution text={t.footer.openMeteo} href={ATTRIBUTION_URLS.openMeteo} />
      <Attribution text={t.footer.geonames} href={ATTRIBUTION_URLS.geonames} />
      <p className={styles.line}>{t.footer.privacy}</p>
    </footer>
  );
}
