import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/useT';
import { Header } from '../components/common/Header';
import type { ShellProps } from '../Shell';
import styles from './Settings.module.css';
import type { SettingsPageProps } from './Settings';
import { loadSettingsChunk } from './settingsChunk';

/**
 * R92 (D-529): the settings route as the shell's slots — the header as its
 * `banner`, the page as its `main`, the privacy line as its `contentinfo`.
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

/** The page's foot, its `contentinfo`: the privacy line, in place of the home's credits (FR-SET-2). */
function SettingsPrivacy() {
  const t = useT();
  return (
    <footer className={styles.privacy} data-testid="settings-privacy">
      <p>{t.settings.privacy}</p>
    </footer>
  );
}

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
  /** Tests: the page rendered in place of the chunk, so the route composes synchronously. */
  page?: ReactNode;
}

const noop = (): void => undefined;

export function settingsShell(t: Messages, props: SettingsPageProps, { arriving = false, onArriving = noop, page }: SettingsRouteOptions = {}): Pick<ShellProps, 'chrome' | 'banner' | 'footer' | 'mainProps' | 'children'> {
  return {
    chrome: 'settings',
    banner: <Header current="settings" busy={arriving} />,
    mainProps: { className: styles.page, 'aria-label': t.settings.heading },
    footer: <SettingsPrivacy />,
    children: page ?? (
      <Suspense fallback={<Arriving onChange={onArriving} />}>
        <SettingsPage {...props} />
      </Suspense>
    ),
  };
}
