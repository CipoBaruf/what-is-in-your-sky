import { LOCALES, LOCALE_NAMES } from '../../../i18n/locale';
import { useT } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { useAppStore } from '../../../state';
import { OptionToggle } from './OptionToggle';

/**
 * FR-I18N-1 / US-13 (R17): the header's language switch. Each language is
 * named in itself — someone who cannot read the other one still finds the way
 * back — and the choice goes straight to the store, which saves it in
 * `wiys:prefs:v1` and re-renders the tree through `I18nProvider`. Nothing
 * reloads and nothing in the URL changes (FR-I18N-5, FR-I18N-6): the
 * observer, the open pass and the scroll position are React state and survive.
 */
export interface LanguageToggleProps {
  /**
   * R52: where the caller is putting it. The header and the pass sheet align
   * their preference group to the right; the settings page reads top to bottom
   * and wants it where every other row on that page starts. The alignment was a
   * rule of this component's own until the settings page needed the other one,
   * which is a placement and so belongs to whoever is doing the placing.
   */
  className?: string | undefined;
}

export function LanguageToggle({ className }: LanguageToggleProps = {}) {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  return (
    <OptionToggle<Locale>
      name={t.app.language}
      options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      value={locale}
      onChange={setLocale}
      className={className}
    />
  );
}
