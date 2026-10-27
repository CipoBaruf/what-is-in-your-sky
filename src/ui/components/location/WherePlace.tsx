import { useId, useState, type ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import type { Messages } from '../../../i18n/messages';
import { formatList } from '../../../lib/format';
import { coordsLabel } from '../../../lib/place';
import type { Observer } from '../../../model';
import { useActiveObserver, useAppStore } from '../../../state';
import { useReadiness } from '../common/ReadinessLine';
import { useElementsAge } from '../elements/ElementsLine';
import { Line } from '../primitives/Line';
import { Stack } from '../primitives/Stack';
import { TextButton } from '../primitives/TextButton';
import styles from './WherePlace.module.css';

/**
 * R81 (FR-FIRST-11, D-511): the Where reading's head once there is a place, in
 * place of R52/R76's one-line summary. The place in `--fg` with its
 * coordinates after it in `--fg-dim` (`Cipolletti (−38.93, −67.99)`), or the
 * coordinates alone; then at `--small` one sentence by where the place came
 * from — the centre of a place picked by name, coordinates typed in, or the
 * device with its accuracy (US-3 AC3) — then "Saved in this browser only." and
 * `[ change ]`, which opens the home page's input group (FR-FIRST-2) in place
 * and closes it again (`aria-expanded`, `aria-controls`). It never sends the
 * reader to `#settings`, which is not where a place is set (FR-SET-3).
 *
 * The group itself is the Where reading's (`screens/Home.tsx`), not this
 * component's: it is one mounted instance across the cold open and the
 * reading (D-467), so a reader typing a place in it keeps the field they are
 * typing in when the place arrives.
 */
export interface WherePlaceProps {
  /** Whether the input group is open. */
  open: boolean;
  onToggle: () => void;
  /** The id of the group `[ change ]` opens. */
  controls: string;
  /**
   * R130 (FR-FLOW-2, D-844): compact's two lines — the place with `[ change ]` at the row's end, and one status
   * line ending in `[ details ]`, which opens the sentence and then `details` (the readiness line, the elements
   * line and the saved places) in place. A fault takes the status line whole and is never folded away.
   */
  folded?: boolean;
  /** What `[ details ]` opens under the sentence, in FR-FIRST-11's order; the folded form's only. */
  details?: ReactNode;
}

/** A geocoded label's first part is the place itself ("Cipolletti, Río Negro, Argentina" → "Cipolletti"). */
export function placeName(observer: Observer): string | null {
  if (observer.source !== 'geocode') return null;
  return observer.label.split(',')[0]?.trim() || observer.label;
}

/** The sentence under the place, by its source. */
function whereSentence(observer: Observer, t: Messages): string {
  switch (observer.source) {
    case 'geocode':
      return t.home.where.centre(placeName(observer) ?? observer.label);
    case 'coords':
      return t.home.where.coords;
    case 'device':
      return t.home.where.device(observer.accuracyM === undefined ? null : String(Math.round(observer.accuracyM)));
  }
}

function PlaceText({ observer }: { observer: Observer }) {
  const place = placeName(observer);
  const coords = coordsLabel(observer.lat, observer.lon);
  return place === null ? (
    <span className={styles.name}>{coords}</span>
  ) : (
    <>
      <span className={styles.name}>{place}</span> <span className={styles.coords}>({coords})</span>
    </>
  );
}

/**
 * R130 (FR-FLOW-2, D-844): the folded Where's second line. A fault takes the line whole, in its own tone: the
 * elements load's failure first, with its `[ retry ]` (a failed load is always a not-ready state too, which would
 * otherwise hide it, D-858), then the readiness line's not-ready state, then the elements warning. With none it is "Ready offline · elements 4 d old". Either way it ends in `[ details ]`, which opens the rest.
 */
function WhereStatus({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  const t = useT();
  const locale = useLocale();
  const readiness = useReadiness();
  const age = useElementsAge();
  const elements = useAppStore((s) => s.elements);
  const retryElements = useAppStore((s) => s.retryElements);
  const details = <TextButton inline label={t.elements.details} aria-expanded={open} aria-controls={controls} data-testid="where-details" onClick={onToggle} />;
  if (elements.status === 'error') {
    return (
      <Line
        size="small"
        tone="failure"
        ink="tone"
        rows="controls"
        actions={
          <>
            <TextButton label={t.failure.retry} data-testid="where-retry" onClick={retryElements} />
            {details}
          </>
        }
        data-testid="where-status"
        data-fault="failure"
      >
        {t.failure[elements.failure.kind](t.failure.what.elements)}
      </Line>
    );
  }
  const state = readiness?.state;
  if (state && !(state.missing.length === 0 && state.offlineUntil !== null)) {
    return (
      <Line size="small" tone="notice" ink="tone" dot actions={details} data-testid="where-status" data-fault="not-ready">
        {t.readiness.notReady(formatList(state.missing.map((gap) => t.readiness.gaps[gap]), locale))}
      </Line>
    );
  }
  if (age?.warn) {
    return (
      <Line size="small" tone="notice" ink="tone" dot actions={details} data-testid="where-status" data-fault="elements-warning">
        {age.age === null ? t.elements.lineNone : t.elements.line(age.age)}
      </Line>
    );
  }
  const text = age?.age == null ? null : readiness ? t.whereFold.ready(age.age) : t.whereFold.elements(age.age);
  return (
    <Line size="small" ink="dim" dot={text !== null} actions={details} data-testid="where-status">
      {text}
    </Line>
  );
}

export function WherePlace({ open, onToggle, controls, folded = false, details }: WherePlaceProps) {
  const t = useT();
  const observer = useActiveObserver();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  if (observer === null) return null;
  const change = <TextButton inline label={t.location.summaryChange} aria-expanded={open} aria-controls={controls} data-testid="location-summary-change" onClick={onToggle} />;
  if (folded) {
    return (
      <div className={styles.where} data-folded="">
        <div className={styles.placeRow}>
          <p className={styles.place} data-testid="location-summary">
            <PlaceText observer={observer} />
          </p>
          {change}
        </div>
        <WhereStatus
          open={detailsOpen}
          controls={detailsId}
          onToggle={() => {
            setDetailsOpen((o) => !o);
          }}
        />
        {/* FR-FIRST-11's order: the observer's sentence, then the readiness line, the elements line and the saved places.
            `details` is mounted only while open: folded, the status line is the one reader of the readiness and the
            elements' age, not a second set of timers and store reads under it. */}
        <Stack gap={2} id={detailsId} hidden={!detailsOpen} className={styles.details} data-testid="where-details-panel">
          <p className={styles.sentence} data-testid="where-sentence">
            {whereSentence(observer, t)} {t.location.savedHere}
          </p>
          {detailsOpen ? details : null}
        </Stack>
      </div>
    );
  }
  return (
    <div className={styles.where}>
      <p className={styles.place} data-testid="location-summary">
        <PlaceText observer={observer} />
      </p>
      <p className={styles.sentence} data-testid="where-sentence">
        {whereSentence(observer, t)} {t.location.savedHere} {change}
      </p>
    </div>
  );
}
