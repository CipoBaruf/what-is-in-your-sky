import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { useT } from '../../i18n/useT';
import { searchPlaces, useActiveObserver, useAppStore } from '../../state';
import { InstallAction } from '../components/common/InstallAction';
import { useInstallOffer, type InstallEnv } from '../components/common/installEnv';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { SectionHeading } from '../components/common/SectionHeading';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { ClearSavedLocation } from '../components/location/ClearSavedLocation';
import { Favourites } from '../components/location/Favourites';
import { COORDS_INPUT_ID, LocationInput } from '../components/location/LocationInput';
import styles from './Settings.module.css';

/**
 * R52 (FR-COMP-2, US-20, D-184), R75 (FR-SET-1, FR-SET-2, US-29, D-445): the
 * settings page at `#settings`.
 *
 * It composes what the home screen used to carry — `LanguageToggle`,
 * `ThemeToggle`, `LocationInput` with the place picker, the coordinates and the
 * device button, the saved places — unchanged in what they write. Every change
 * applies and is saved the moment it is made, so there is no save action and
 * nothing to lose by leaving (US-20 AC2).
 *
 * The order is FR-SET-1's, and it is what this screen decides: **Location**
 * (the place field, one row `[ Use my location ] [ coordinates ]`, the fields
 * that disclosure opens, the precision note), **Saved places** (the list, and
 * one row `[ Save this place ] [ Clear saved ]`), **This browser** (three
 * label-and-control rows: language, theme, install), and the privacy line at
 * the foot. The reader comes back for the first of those; the last three are
 * facts about the device. What makes the page fit 390 × 844 (FR-SET-2) is the
 * grouping — three rows under one heading instead of three headings with a
 * control under each, and the coordinate fields behind a disclosure — and the
 * privacy line standing in for the compact footer, which is `App`'s to leave
 * out on this route.
 *
 * The coordinates disclosure is open at first when the observer came from
 * coordinates, since those fields are then what the reader set. Its fields stay
 * mounted while it is closed, so what was typed survives closing it, and the
 * place picker's "enter coordinates instead" link opens it before it focuses the
 * field (the capture listener below), rather than falling through to a
 * `#coords` hash the router would read as leaving the page.
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
  const observer = useActiveObserver();
  const browserId = useId();
  const coordsRegionId = useId();
  const [coordsOpen, setCoordsOpen] = useState(() => observer?.source === 'coords');
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

  /** The picker's "enter coordinates instead" link: open the fields first, so its own handler finds one to focus. */
  const openCoordsForLink = (event: MouseEvent<HTMLDivElement>): void => {
    if (coordsOpen || !(event.target instanceof Element)) return;
    if (event.target.closest(`a[href="#${COORDS_INPUT_ID}"]`)) {
      flushSync(() => {
        setCoordsOpen(true);
      });
    }
  };

  return (
    <>
        <p className={styles.backRow}>
          <button type="button" onClick={onLeave} ref={back} className={`inline-control ${styles.link}`} data-testid="settings-back">
            {t.settings.back}
          </button>
        </p>

        <div className={styles.location} onClickCapture={openCoordsForLink}>
          <LocationInput
            observer={observer}
            onObserver={setObserver}
            onClear={clearSavedObserver}
            search={searchPlaces}
            showClear={false}
            showSavedHere={false}
            showFavourites={false}
            arrangeInputs={({ coords, device }) => (
              <>
                <div className={styles.controlRow} data-testid="location-actions">
                  {device}
                  <button
                    type="button"
                    className={styles.link}
                    aria-expanded={coordsOpen}
                    aria-controls={coordsRegionId}
                    data-testid="coords-disclosure"
                    onClick={() => {
                      setCoordsOpen((open) => !open);
                    }}
                  >
                    {t.settings.coordinates}
                  </button>
                </div>
                <div id={coordsRegionId} hidden={!coordsOpen} className={styles.coords}>
                  {coords}
                </div>
              </>
            )}
          />
        </div>

        <Favourites titled limit="empty-or-full" footer={<ClearSavedLocation short />} />

        <section aria-labelledby={browserId} className={styles.browser} data-testid="settings-browser">
          <SectionHeading id={browserId}>{t.settings.browser}</SectionHeading>
          <div className={styles.rows}>
            {/* The visible labels are for the eye; each control is already a group named by the same word. */}
            <span className={styles.label} aria-hidden="true">
              {t.app.language}
            </span>
            <LanguageToggle />
            <span className={styles.label} aria-hidden="true">
              {t.app.theme}
            </span>
            <ThemeToggle />
            {canInstall && (
              <>
                <span className={styles.label} aria-hidden="true">
                  {t.settings.installLabel}
                </span>
                <span className={styles.install} data-testid="settings-install">
                  <InstallAction bare {...(installEnv ? { env: installEnv } : {})} />
                </span>
              </>
            )}
          </div>
        </section>
    </>
  );
}

/*
 * R92 (D-529) composed the route here as the shell's slots (`settingsShell`); R93 (D-545) moves that to
 * `SettingsRoute.tsx`, in the main chunk, so this file — the page — is the chunk `settingsChunk.ts` fetches.
 */
