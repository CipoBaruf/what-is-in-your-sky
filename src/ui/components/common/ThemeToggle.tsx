import { useT } from '../../../i18n/useT';
import { THEMES, type Theme } from '../../../model';
import { useAppStore } from '../../../state';
import { OptionToggle } from './OptionToggle';

/**
 * FR-THEME-1 / US-19 (R20): the header's palette switch. The choice goes
 * straight to the store, which saves it in `wiys:prefs:v1`; `AppRoot` writes
 * `data-theme` on the root element from the same state, so `tokens.css`
 * repaints and no component here knows what a colour is (D-84). Nothing
 * reloads and nothing in the URL changes: the observer, the open pass and the
 * scroll position are React state and survive, as they do for the language.
 *
 * Both names are translated, unlike the language switch's: someone reading
 * this switch can already read the page it is on.
 */
export function ThemeToggle() {
  const t = useT();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return <OptionToggle<Theme> name={t.app.theme} options={THEMES.map((value) => ({ value, label: t.app.themes[value] }))} value={theme} onChange={setTheme} />;
}
