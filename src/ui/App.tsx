import { useMemo } from 'react';
import { searchPlaces, useAppStore } from '../state';
import styles from './App.module.css';
import { Footer } from './components/common/Footer';
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
 * the attributions (FR-X-2).
 */
export const TAGLINE = 'Naked-eye satellite passes for the coming night: which, when, and where to look.';

export function App() {
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
        <h1>What is in your sky right now</h1>
        <p className={styles.tagline}>{TAGLINE}</p>
      </header>
      <main inert={inert} className={styles.main}>
        <LocationInput observer={observer} onObserver={setObserver} onClear={clearSavedObserver} search={searchPlaces} />
        <ElementsBanners />
        <NowPanel />
        <PassList onOpenPass={open} />
      </main>
      <Footer inert={inert} />
      {selected && <PassDetail pass={selected} timeZone={observer?.timeZone ?? null} onClose={close} />}
    </>
  );
}
