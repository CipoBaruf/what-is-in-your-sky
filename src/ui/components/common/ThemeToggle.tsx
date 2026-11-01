import { useT } from '../../../i18n/useT';
import { THEMES, type Theme } from '../../../model';
import { useAppStore } from '../../../state';
import { ToggleGroup } from '../primitives/ToggleGroup';
import styles from './ThemeToggle.module.css';

/**
 * FR-THEME-1 / US-19 (R20): the header's palette switch. The choice goes
 * straight to the store, which saves it in `wiys:prefs:v1`; the shell writes
 * `data-theme` on the root element from the same state (R156, `useThemeTick.ts`), so `tokens.css`
 * repaints and no component here knows what a colour is (D-84). Nothing
 * reloads and nothing in the URL changes: the observer, the open pass and the
 * scroll position are React state and survive, as they do for the language.
 *
 * Both names are translated, unlike the language switch's: someone reading
 * this switch can already read the page it is on.
 *
 * R156 (FR-PHONE-15, D-979): a third option, Auto, the theme by the Sun at the saved place; the three stand one
 * cell apart so the row fits 390 px beside its label (`ThemeToggle.module.css`).
 */
export function ThemeToggle() {
  const t = useT();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return <ToggleGroup<Theme> name={t.app.theme} options={THEMES.map((value) => ({ value, label: t.app.themes[value] }))} value={theme} onChange={setTheme} gap="none" className={styles.row} />;
}
