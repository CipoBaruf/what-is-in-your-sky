import type { MouseEvent } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { passIdHash, STARS_HASH } from '../../../lib/shareLinks';
import { isNoEvent, nextEvent } from '../../../lib/nextEvent';
import type { Observer } from '../../../model';
import { SEARCH_WINDOW_HOURS } from '../../../state';
import { NEXT_EVENT_TICK_MS } from '../../components/passes/NextEventBlock';
import { Card } from '../../components/primitives/Card';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useNow } from '../../hooks/useNow';
import { doorLines, WHAT_ID, type Door } from './doorLines';
import styles from './HomeDoors.module.css';
import { usePassContext, useShownPasses } from './shownPasses';
import { useDoorSky } from './useDoorSky';
import { useNight } from './useNight';

/**
 * R130 (FR-FLOW-1, D-843): the home's three doors — Satellites, Stars, Both —
 * in that fixed order, each one link over the whole of a ruled box (`Card`'s
 * `a`), its title in `--fg` and its answer lines at `--small` (`doorLines`).
 * Full width and stacked on compact, under the Where reading; on wide one row
 * of three equal boxes over the panes, each with one more line.
 *
 * The Satellites door opens the next event's pass (`#pass=<id>`, the hash the
 * cards open), or with no visible pass in the span the What reading: its
 * `#what` is the reading's own id, so a new tab or a copied link lands on it,
 * and a plain click opens it in place — the page scrolls to it and its heading
 * takes the focus, and the hash is not touched. The Stars door opens `#stars`, the Both door `#live`, where the
 * saved `starsLayer` is the live page's own.
 */
export interface HomeDoorsProps {
  observer: Observer;
  /** The open pass, which the shown passes keep whether or not it is faint (FR-FAINT-1), as the list does. */
  selectedPassId: string | null;
  className?: string;
}

/** A plain click opens the What reading in place; a new-tab or new-window gesture is the browser's, with the href. */
function openWhat(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const what = document.getElementById(WHAT_ID);
  if (!what) return;
  event.preventDefault();
  // Not every host has it (jsdom), and the focus below is what matters to a reader who cannot see the scroll.
  if ('scrollIntoView' in what) what.scrollIntoView({ block: 'start' });
  const heading = what.querySelector<HTMLElement>('h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function DoorBox({ door, href, wide, testId, onClick }: { door: Door; href: string; wide: boolean; testId: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const lines = wide && door.wide !== undefined ? [...door.lines, door.wide] : door.lines;
  return (
    <li className={styles.item}>
      <Card as="a" href={href} className={styles.door} data-testid={testId} {...(onClick ? { onClick } : {})}>
        <span className={styles.title}>{door.title}</span>
        {lines.map((line, i) => (
          // A line not in yet is drawn empty at its full height (`min-height: 1lh`), so nothing below moves when it lands.
          <span key={i} className={styles.line} data-pending={line === null ? '' : undefined} data-testid={`${testId}-line`}>
            {line ?? ''}
          </span>
        ))}
      </Card>
    </li>
  );
}

export function HomeDoors({ observer, selectedPassId, className }: HomeDoorsProps) {
  const t = useT();
  const locale = useLocale();
  const wide = useLayoutMode() === 'wide';
  const now = useNow(NEXT_EVENT_TICK_MS);
  const passes = useShownPasses(selectedPassId);
  const { elementCount, hasDarkness, pending } = usePassContext();
  const night = useNight(observer);
  // Worked out once per tick: the doors' lines and the landmark's pass are the same event's.
  const event = nextEvent(passes, now, { elementCount, hasDarkness });
  const sky = useDoorSky(observer, now, isNoEvent(event) ? null : event.pass);
  const doors = doorLines(
    { now, zone: observer.timeZone, locale, passes, event, pending, hours: SEARCH_WINDOW_HOURS, bandsKnown: night.bands.length > 0, dark: night.dark, cloud: night.clouds.state, sky },
    t,
  );
  const { passId } = doors.satellites;
  return (
    // A labelled list of links and not a `nav`: the page's one navigation landmark is the header's (FR-A11Y-1).
    <div className={[styles.doors, className].filter(Boolean).join(' ')} data-testid="home-doors" data-rhythm="section">
      <ul aria-label={t.doors.region} className={styles.list}>
        <DoorBox door={doors.satellites} href={passId === null ? `#${WHAT_ID}` : passIdHash(passId)} wide={wide} testId="door-satellites" {...(passId === null ? { onClick: openWhat } : {})} />
        <DoorBox door={doors.stars} href={STARS_HASH} wide={wide} testId="door-stars" />
        <DoorBox door={doors.both} href="#live" wide={wide} testId="door-both" />
      </ul>
    </div>
  );
}
