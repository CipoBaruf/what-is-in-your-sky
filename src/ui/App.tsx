import { useAppStore } from '../state';
import { CoordsInput } from './components/location/CoordsInput';
import { PassList } from './components/passes/PassList';

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`).
 */
export function App() {
  const setObserver = useAppStore((s) => s.setObserver);
  return (
    <main>
      <h1>What is in your sky right now</h1>
      <CoordsInput onObserver={setObserver} />
      <PassList />
    </main>
  );
}
