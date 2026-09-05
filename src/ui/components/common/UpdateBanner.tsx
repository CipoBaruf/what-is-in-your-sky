import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { Banner } from './Banner';
import styles from './UpdateBanner.module.css';

/**
 * FR-OFF-1, OQ-14: a new version of the shell has downloaded and is waiting;
 * this offers the reload and is the only thing that lets it through.
 *
 * The banner holds no service-worker knowledge at all. `state/serviceWorker.ts`
 * puts a function in the store — `applyUpdate`, which posts `SKIP_WAITING` to
 * the worker that is actually waiting and reloads when it takes over (D-126) —
 * and this calls it. That is what keeps the promise negative and checkable:
 * `SKIP_WAITING` is spelled in one module, and the only path to it is this
 * button, so an update cannot swap the shell under a reader.
 *
 * Where it renders is the other half of that promise (D-154). It sits at the
 * top of the home screen, which the compact layout makes `inert` while a pass
 * sheet is open and which is not rendered at all under `#live`, so on both of
 * the screens the task names the button cannot be reached, no timer hides it,
 * and it comes back by itself the moment the reader closes the sheet or
 * leaves the live page.
 */
export function UpdateBanner() {
  const t = useT();
  const updateReady = useAppStore((s) => s.updateReady);
  const applyUpdate = useAppStore((s) => s.applyUpdate);
  if (!updateReady || applyUpdate === null) return null;
  return (
    <Banner variant="info" testId="update-banner">
      {t.update.ready}{' '}
      <button type="button" onClick={applyUpdate} className={`inline-control ${styles.reload}`}>
        {t.update.reload}
      </button>
    </Banner>
  );
}
