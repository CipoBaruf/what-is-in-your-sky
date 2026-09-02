import { useMemo } from 'react';
import { searchPlaces, useAppStore } from '../state';
import { CoordsInput } from './components/location/CoordsInput';
import { PlacePicker } from './components/location/PlacePicker';
import { NowPanel } from './components/now/NowPanel';
import { PassList } from './components/passes/PassList';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection } from './screens/passSelection';

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`). R7: the Now panel
 * sits between the input and the pass list. R6: the selected pass lives in
 * the URL hash (D-13) and opens the detail sheet over the list, which is made
 * inert while the sheet is up. R9: the place picker comes first (US-1); its
 * empty and error states link to the coordinates input by id.
 */
const COORDS_INPUT_ID = 'coords';

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
        <PlacePicker search={searchPlaces} onObserver={setObserver} observer={observer} coordsInputId={COORDS_INPUT_ID} />
        <CoordsInput id={COORDS_INPUT_ID} onObserver={setObserver} />
        <NowPanel />
        <PassList onOpenPass={open} />
      </main>
      {selected && <PassDetail pass={selected} timeZone={observer?.timeZone ?? null} onClose={close} />}
    </>
  );
}
