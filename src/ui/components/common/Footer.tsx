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
 *
 * R102 (FR-SHOW-8, FR-X-2 as amended v2.2, D-657; V22-15): a fourth credit,
 * the library the sky is drawn with — "Sky chart: glyphcss." — in every form
 * the footer has. The library alone: its author is not named in the app. In
 * the full form it is a fourth `Attribution`, one sentence with one link; in
 * the one-row forms the library's name stands as a link after `Chart:`, the
 * way the sources stand after `Data:`. It is the last item in each form: the
 * sources and the page's own lines keep their order, and the one-row forms
 * stay one row with the privacy word as their only difference (D-548).
 */
export const ATTRIBUTION_URLS = {
  celestrak: 'https://celestrak.org/',
  openMeteo: 'https://open-meteo.com/',
  geonames: 'https://www.geonames.org/',
  /** Not an attribution: whose page this is (FR-X-2, amended). */
  author: 'https://github.com/CipoBaruf',
  /** R102 (FR-SHOW-8): the library the sky is drawn with. */
  glyphcss: 'https://glyphcss.com',
} as const;

export interface FooterProps {
  /** True while the detail sheet is up (D-13): the footer leaves the tab order like the rest of the page. */
  inert?: boolean;
  /**
   * R87 (FR-FIRST-1 as amended v2.1, D-548, F-74): `full` is the layout's own
   * footer — the four sentences on a phone, D-120's one row on a desk. `line`
   * is that row without its privacy word, at every width: the phone's
   * first-run steps pass it, so the step and its footer are one screen and the
   * promise is not said twice (`home.savedFoot` says it four lines higher).
   */
  form?: 'full' | 'line';
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

export function Footer({ inert = false, form = 'full' }: FooterProps) {
  const t = useT();
  const wide = useLayoutMode() === 'wide';
  const line = form === 'line';

  if (wide || line) {
    return (
      <footer inert={inert} className={styles.footer} data-form={line ? 'line' : 'short'}>
        <p className={styles.line}>
          {t.footer.short.sources}{' '}
          <a href={ATTRIBUTION_URLS.celestrak}>CelesTrak</a>
          {', '}
          <a href={ATTRIBUTION_URLS.openMeteo}>Open-Meteo.com</a>
          {', '}
          <a href={ATTRIBUTION_URLS.geonames}>GeoNames</a> {t.footer.short.licence}
          {!line && (
            <>
              <span className={styles.dot}>·</span>
              {t.footer.short.privacy}
            </>
          )}
          <span className={styles.dot}>·</span>
          <Linked text={t.footer.credit} href={ATTRIBUTION_URLS.author} />
          <span className={styles.dot}>·</span>
          {t.footer.short.chart}{' '}
          <a href={ATTRIBUTION_URLS.glyphcss}>{t.footer.chart.link}</a>
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
      <Attribution text={t.footer.chart} href={ATTRIBUTION_URLS.glyphcss} />
    </footer>
  );
}
