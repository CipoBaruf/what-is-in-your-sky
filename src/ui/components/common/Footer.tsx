import type { LinkedText } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { useLayoutMode } from '../../hooks/useLayoutMode';
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
 *
 * R23 (D-120): two forms of the same credits, chosen by the layout the way
 * `PassDetail` chooses its two shells (D-72). Compact keeps the four
 * sentences at the bottom of a page that scrolls. Wide says the same thing in
 * one row, because D-119's shell holds the footer on screen for as long as a
 * pass is open and four rows of provenance are not what that space is for.
 * What the short form may not drop is the attribution itself: every provider
 * is still named and still linked, and the CC BY 4.0 licence is still called
 * by name — that is the condition the data is used under, not decoration.
 */
export const ATTRIBUTION_URLS = {
  celestrak: 'https://celestrak.org/',
  openMeteo: 'https://open-meteo.com/',
  geonames: 'https://www.geonames.org/',
  /** Not an attribution: whose page this is (FR-X-2, amended). */
  author: 'https://github.com/CipoBaruf',
} as const;

export interface FooterProps {
  /** True while the detail sheet is up (D-13): the footer leaves the tab order like the rest of the page. */
  inert?: boolean;
}

function Linked({ text, href }: { text: LinkedText; href: string }) {
  return (
    <>
      {text.before}
      <a href={href}>{text.link}</a>
      {text.after}
    </>
  );
}

function Attribution({ text, href }: { text: LinkedText; href: string }) {
  return (
    <p className={styles.line}>
      <Linked text={text} href={href} />
    </p>
  );
}

export function Footer({ inert = false }: FooterProps) {
  const t = useT();
  const wide = useLayoutMode() === 'wide';

  if (wide) {
    return (
      <footer inert={inert} className={styles.footer} data-form="short">
        <p className={styles.line}>
          {t.footer.short.sources}{' '}
          <a href={ATTRIBUTION_URLS.celestrak}>CelesTrak</a>
          {', '}
          <a href={ATTRIBUTION_URLS.openMeteo}>Open-Meteo.com</a>
          {', '}
          <a href={ATTRIBUTION_URLS.geonames}>GeoNames</a> {t.footer.short.licence}
          <span className={styles.dot}>·</span>
          {t.footer.short.privacy}
          <span className={styles.dot}>·</span>
          <Linked text={t.footer.credit} href={ATTRIBUTION_URLS.author} />
        </p>
      </footer>
    );
  }

  return (
    <footer inert={inert} className={styles.footer} data-form="full">
      <Attribution text={t.footer.celestrak} href={ATTRIBUTION_URLS.celestrak} />
      <Attribution text={t.footer.openMeteo} href={ATTRIBUTION_URLS.openMeteo} />
      <Attribution text={t.footer.geonames} href={ATTRIBUTION_URLS.geonames} />
      <p className={styles.line}>{t.footer.privacy}</p>
      <Attribution text={t.footer.credit} href={ATTRIBUTION_URLS.author} />
    </footer>
  );
}
