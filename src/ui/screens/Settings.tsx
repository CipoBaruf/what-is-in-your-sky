import { useEffect, useId, useRef } from 'react';
import { useT } from '../../i18n/useT';
import { searchPlaces, useAppStore } from '../../state';
import { Header } from '../components/common/Header';
import { InstallAction } from '../components/common/InstallAction';
import { useInstallOffer, type InstallEnv } from '../components/common/installEnv';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { SectionHeading } from '../components/common/SectionHeading';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { ClearSavedLocation } from '../components/location/ClearSavedLocation';
import { LocationInput } from '../components/location/LocationInput';
import styles from './Settings.module.css';

/**
 * R52 (FR-COMP-2, US-20, D-184): the settings page at `#settings`.
 *
 * It composes what the home screen used to carry — `LanguageToggle`,
 * `ThemeToggle`, `LocationInput` with the place picker, the coordinates, the
 * device button and the saved places inside it — unchanged. Nothing about how
 * those write the store moves: every change applies and is saved the moment it
 * is made, exactly as it did when they were on the home page, so there is no
 * save action and nothing to lose by leaving (US-20 AC2).
 *
 * The order is FR-COMP-2's, and it is the only thing this screen decides:
 * language, theme, location, saved places, install, clear saved location. Two
 * of those come out of `LocationInput` rather than sitting inside it — the
 * saved places are already its own section, and the clear action is lifted out
 * by `showClear={false}` so the install offer can land between them, where
 * V11-16 puts it. The wide panel keeps the clear inside the sentence, which is
 * where the approved desktop mockup has it.
 *
 * The install row (FR-OFF-6 as amended v1.1.2, V11-16, D-260) is the offer with
 * no decline beside it. It asks the browser and not the answer, so it is here
 * after the third "Not now" and while a snooze is running; it is absent when
 * the browser has nothing to offer, which is also what "already installed"
 * looks like. Taking it installs the app and ends the hint.
 *
 * The route exists at every width (FR-COMP-2) — a reload on `#settings` reopens
 * it whatever the screen — but only the compact header links to it (US-20 AC5),
 * which is `Header`'s business. `Esc` closes it through the one `keydown`
 * listener in `App` (D-73), and the browser's Back does it by clearing the hash.
 */
export interface SettingsPageProps {
  /** Returns to the home screen: the page's own `[ ← Back ]`, and what `Esc` and the browser's Back do. */
  onLeave: () => void;
  /** The browser, for `InstallAction`; the app reads the real `navigator`. */
  installEnv?: InstallEnv;
}

export function SettingsPage({ onLeave, installEnv }: SettingsPageProps) {
  const t = useT();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const observer = useAppStore((s) => s.observer);
  const languageId = useId();
  const themeId = useId();
  const installId = useId();
  const { available: canInstall } = useInstallOffer(installEnv);
  const back = useRef<HTMLButtonElement>(null);

  /*
   * The reader arrived by pressing a control that is no longer under their
   * cursor — `[ settings ]` in the header is now the current page's own dim
   * marker — so focus is placed on the way out. It is the first thing on the
   * page and the answer to "how do I get back", which is the one question a
   * settings screen has to answer before any of its rows do.
   */
  useEffect(() => {
    back.current?.focus();
  }, []);

  return (
    <>
      <Header current="settings" />
      <main className={styles.page} aria-label={t.settings.heading}>
        <p className={styles.backRow}>
          <button type="button" onClick={onLeave} ref={back} className={`inline-control ${styles.back}`} data-testid="settings-back">
            {t.settings.back}
          </button>
        </p>

        <section aria-labelledby={languageId} className={styles.section}>
          <SectionHeading id={languageId}>{t.app.language}</SectionHeading>
          <LanguageToggle />
        </section>

        <section aria-labelledby={themeId} className={styles.section}>
          <SectionHeading id={themeId}>{t.app.theme}</SectionHeading>
          <ThemeToggle />
        </section>

        {/* The location form, the saved places inside it, and the clear action inside those (the owner, on a
            phone, 2026-09-09): a reader who wants to drop the saved place is already looking at the places
            they keep, and at the foot of the page it was under the install offer and easy to miss. It is
            still the page that places it (D-262) — `LocationInput` and `Favourites` only pass the slot on.
            This is a departure from FR-COMP-2's stated order, which puts it last; see the PR. */}
        <LocationInput observer={observer} onObserver={setObserver} onClear={clearSavedObserver} search={searchPlaces} showClear={false} savedPlacesFooter={<ClearSavedLocation />} />

        {canInstall && (
          <section aria-labelledby={installId} className={styles.section} data-testid="settings-install">
            <SectionHeading id={installId}>{t.install.action}</SectionHeading>
            <p className={styles.install}>
              <InstallAction {...(installEnv ? { env: installEnv } : {})} />
            </p>
          </section>
        )}
      </main>
    </>
  );
}
