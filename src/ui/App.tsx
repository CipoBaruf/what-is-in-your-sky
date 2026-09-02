import { useMemo } from 'react';
import { useAppStore } from '../state';
import { CoordsInput } from './components/location/CoordsInput';
import { PassList } from './components/passes/PassList';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection } from './screens/passSelection';

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`). R6: the selected
 * pass lives in the URL hash (D-13) and opens the detail sheet over the list,
 * which is made inert while the sheet is up.
 */
export function App() {
  const setObserver = useAppStore((s) => s.setObserver);
  const observer = useAppStore((s) => s.observer);
  const passes = useAppStore((s) => s.passes.passes);
  const { selectedId, open, close } = usePassSelection();
  const selected = useMemo(() => findSelectedPass(passes, selectedId), [passes, selectedId]);
  return (
    <>
      <main inert={selected !== null}>
        <h1>What is in your sky right now</h1>
        <CoordsInput onObserver={setObserver} />
        <PassList onOpenPass={open} />
      </main>
      {selected && <PassDetail pass={selected} timeZone={observer?.timeZone ?? null} onClose={close} />}
    </>
  );
}
