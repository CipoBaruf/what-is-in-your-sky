import { LOCALES, LOCALE_NAMES } from '../../../i18n/locale';
import { useT } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { useAppStore } from '../../../state';
import { OptionToggle } from './OptionToggle';
import styles from './LanguageToggle.module.css';

/**
 * FR-I18N-1 / US-13 (R17): the header's language switch. Each language is
 * named in itself — someone who cannot read the other one still finds the way
 * back — and the choice goes straight to the store, which saves it in
 * `wiys:prefs:v1` and re-renders the tree through `I18nProvider`. Nothing
 * reloads and nothing in the URL changes (FR-I18N-5, FR-I18N-6): the
 * observer, the open pass and the scroll position are React state and survive.
 */
export function LanguageToggle() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  return (
    <OptionToggle<Locale>
      name={t.app.language}
      options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      value={locale}
      onChange={setLocale}
      className={styles.toggle}
    />
  );
}
