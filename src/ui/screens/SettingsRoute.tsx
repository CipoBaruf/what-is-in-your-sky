import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import type { Messages } from '../../i18n/messages';
import { Footer } from '../components/common/Footer';
import { Header } from '../components/common/Header';
import type { ShellProps } from '../Shell';
import styles from './Settings.module.css';
import type { SettingsPageProps } from './Settings';
import { loadSettingsChunk } from './settingsChunk';

/**
 * R92 (D-529): the settings route as the shell's slots — the header as its
 * `banner`, the page as its `main`, the app's footer as its `contentinfo`.
 * `App` spreads it into the one `Shell` every route shares — the same element
 * in every branch, so the announcer and the focus live across the change
 * rather than being remounted with it — and the page's own `main` is the
 * shell's, with this page's class.
 *
 * R93 (D-545, F-69): the page itself is a chunk of its own — `lazy` over
 * `settingsChunk`'s one import — so the shell pays nothing for a route reached
 * by one link. The fallback is the shell with the mark's bead moving
 * (FR-MARK-5): while the chunk is on its way the header is told so, through a
 * flag `App` holds. The chunk is prefetched on idle after first paint (`App`)
 * and on the header link's `pointerenter` and `focus` (`Header`), so the bead
 * is for the reload on `#settings` and the tap that beat the network.
 */
const SettingsPage = lazy(() => loadSettingsChunk().then((module) => ({ default: module.SettingsPage })));

/** Mounted only while the chunk is on its way: it turns the header's bead on for as long as it stands. */
function Arriving({ onChange }: { onChange: (arriving: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => {
      onChange(false);
    };
  }, [onChange]);
  return null;
}

export interface SettingsRouteOptions {
  /** Whether the chunk is still on its way, and where to say so: `App`'s state, read by the header's bead. */
  arriving?: boolean;
  onArriving?: (arriving: boolean) => void;
  /** R129 (FR-FLOW-3): the place, the header's context. */
  place?: string | null;
  /** Tests: the page rendered in place of the chunk, so the route composes synchronously. */
  page?: ReactNode;
}

/** The page's props, and the route's way out: the header's `[ ← ]` (US-20 AC4). */
interface SettingsShellProps extends SettingsPageProps {
  onLeave: () => void;
}

const noop = (): void => undefined;

export function settingsShell(t: Messages, { onLeave, ...props }: SettingsShellProps, { arriving = false, onArriving = noop, place = null, page }: SettingsRouteOptions = {}): Pick<ShellProps, 'chrome' | 'banner' | 'footer' | 'mainProps' | 'children'> {
  return {
    chrome: 'settings',
    // R129 (D-845): the header is the page's top row, its `[ ← ]` the page's way back (US-20 AC4).
    banner: <Header page="settings" context={place} onBack={onLeave} backRef={props.backRef} busy={arriving} />,
    mainProps: { className: styles.page, 'aria-label': t.settings.heading },
    // D-1023 (FR-X-2 and FR-SET-1 as amended 2026-11-02): the app's footer, as on every page — the full credits on a
    // phone, D-120's one row on a desk. R190 (FR-KEEP-4, D-1129): its privacy part plain, always shown and with no `[ × ]`.
    footer: <Footer privacy="plain" />,
    children: page ?? (
      <Suspense fallback={<Arriving onChange={onArriving} />}>
        <SettingsPage {...props} />
      </Suspense>
    ),
  };
}
