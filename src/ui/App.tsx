import { useMemo } from 'react';
import { I18nProvider, useT } from '../i18n/useT';
import { searchPlaces, useAppStore } from '../state';
import styles from './App.module.css';
import { Footer } from './components/common/Footer';
import { LanguageToggle } from './components/common/LanguageToggle';
import { ElementsBanners } from './components/elements/ElementsBanners';
import { LocationInput } from './components/location/LocationInput';
import { NowPanel } from './components/now/NowPanel';
import { PassList } from './components/passes/PassList';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection } from './screens/passSelection';

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`). R7: the Now panel
 * sits between the input and the pass list. R6: the selected pass lives in
 * the URL hash (D-13) and opens the detail sheet over the list; header, main
 * and footer are made inert while the sheet is up. R9/R10: the location
 * section holds the place picker, the coordinates, the device button and the
 * clear action. R11: the elements banners (epoch age, stale, not cached,
 * objects without elements) sit between the location and the Now panel.
 * R12: the frame is header (title and tagline), main, and the footer with
 * the attributions (FR-X-2). R17: the header also carries the language
 * switch (US-13), and `AppRoot` is what `main.tsx` renders — the store's
 * locale wrapped around the screen, so switching re-renders everything
 * without touching the URL or the state (FR-I18N-5).
 */
export function App() {
  const t = useT();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const observer = useAppStore((s) => s.observer);
  const passes = useAppStore((s) => s.passes.passes);
  const { selectedId, open, close } = usePassSelection();
  const selected = useMemo(() => findSelectedPass(passes, selectedId), [passes, selectedId]);
  const inert = selected !== null;
  return (
    <>
      <header inert={inert} className={styles.header}>
        <h1>{t.app.title}</h1>
        <p className={styles.tagline}>{t.app.tagline}</p>
        <LanguageToggle />
      </header>
      <main inert={inert} className={styles.main}>
        <LocationInput observer={observer} onObserver={setObserver} onClear={clearSavedObserver} search={searchPlaces} />
        <ElementsBanners />
        <NowPanel />
        <PassList onOpenPass={open} />
      </main>
      <Footer inert={inert} />
      {selected && observer && <PassDetail pass={selected} observer={observer} onClose={close} />}
    </>
  );
}

/** The app as `main.tsx` mounts it: the active language around the screen (D-70). */
export function AppRoot() {
  const locale = useAppStore((s) => s.locale);
  return (
    <I18nProvider locale={locale}>
      <App />
    </I18nProvider>
  );
}
