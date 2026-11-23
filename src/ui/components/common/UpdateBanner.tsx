import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { TextButton } from '../primitives/TextButton';
import { Banner } from './Banner';

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
 * R212 (FR-UPD-2, D-1237, in place of D-154's home): it is the shell's, under
 * the header on every page, and no timer hides it. It is `inert` only while a
 * layer stands over the page — the shortcuts, the phone's pass sheet.
 *
 * R104 (D-704): the banner has no stylesheet of its own any more.
 *
 * R220 (FR-UPD-2, FR-CTRL-16, D-1237): `New version ready · reload`, and
 * `reload` stands on its own as FR-CTRL-1's box, not a link in the line. Where
 * the bar stands against the sky's box is the shell's (`Shell.module.css`).
 */
export interface UpdateBannerProps {
  inert?: boolean;
}

export function UpdateBanner({ inert = false }: UpdateBannerProps) {
  const t = useT();
  const updateReady = useAppStore((s) => s.updateReady);
  const applyUpdate = useAppStore((s) => s.applyUpdate);
  if (!updateReady || applyUpdate === null) return null;
  return (
    <Banner variant="info" testId="update-banner" inert={inert}>
      {t.update.ready}
      {' · '}
      <TextButton label={t.update.reload} onClick={applyUpdate} />
    </Banner>
  );
}
