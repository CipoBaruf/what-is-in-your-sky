import type { ReactNode } from 'react';
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
   * R130 (FR-FLOW-2, D-844) as amended by D-1024: compact's form — the place with `[ change ]` at the row's end, its
   * one control, and a fault line under it only while there is a fault, never folded away. The sentence and the rest
   * head the group `[ change ]` opens (`WhereOpenedStatus`).
   */
  folded?: boolean;
}

/**
 * A geocoded label's first part is the place itself ("Cipolletti, Río Negro, Argentina" → "Cipolletti"), and so
 * is a named device fix's (D-1025: "Near Cipolletti, Argentina" → "Near Cipolletti"). Typed coordinates, and a
 * device fix still labelled with its coordinates, have none.
 */
export function placeName(observer: Observer): string | null {
  if (observer.source === 'coords') return null;
  if (observer.source === 'device' && observer.label === coordsLabel(observer.lat, observer.lon)) return null;
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
 * R130 (FR-FLOW-2, D-844): the folded Where's fault line, under the place. A fault takes the line whole, in its own
 * tone: the elements load's failure first, with its `[ retry ]` (a failed load is always a not-ready state too, which
 * would otherwise hide it, D-858), then the readiness line's not-ready state, then the elements warning.
 *
 * D-1024 (FR-FLOW-2 amended 2026-11-02): the line has no `[ details ]` and there is no line at all without a fault —
 * the place line's `[ change ]` is the Where's one control, and the status it used to fold away heads the group it
 * opens (`WhereOpenedStatus`).
 */
function WhereFault({ readiness, age }: { readiness: ReturnType<typeof useReadiness>; age: ReturnType<typeof useElementsAge> }) {
  const t = useT();
  const locale = useLocale();
  const elements = useAppStore((s) => s.elements);
  const retryElements = useAppStore((s) => s.retryElements);
  if (elements.status === 'error') {
    return (
      <Line
        size="small"
        tone="failure"
        ink="tone"
        rows="controls"
        actions={<TextButton label={t.failure.retry} data-testid="where-retry" onClick={retryElements} />}
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
      <Line size="small" tone="notice" ink="tone" dot data-testid="where-status" data-fault="not-ready">
        {t.readiness.notReady(formatList(state.missing.map((gap) => t.readiness.gaps[gap]), locale))}
      </Line>
    );
  }
  if (age?.warn) {
    return (
      <Line size="small" tone="notice" ink="tone" dot data-testid="where-status" data-fault="elements-warning">
        {age.age === null ? t.elements.lineNone : t.elements.line(age.age)}
      </Line>
    );
  }
  return null;
}

/**
 * D-1024 (FR-FLOW-2 amended 2026-11-02): what the compact `[ change ]` shows at the top of the group it opens, above
 * the inputs, in FR-FIRST-11's order — the observer's sentence, then `children` (the readiness line, the elements line
 * with its own `[ details ]`, and the saved places). The Where reading mounts it only while the group is open, so
 * closed, the fault line is the one reader of the readiness and the elements' age.
 */
export function WhereOpenedStatus({ children }: { children?: ReactNode }) {
  const t = useT();
  const observer = useActiveObserver();
  if (observer === null) return null;
  return (
    <Stack gap={2} className={styles.opened} data-testid="where-opened-status">
      <p className={styles.sentence} data-testid="where-sentence">
        {whereSentence(observer, t)} {t.location.savedHere}
      </p>
      {children}
    </Stack>
  );
}

export function WherePlace({ open, onToggle, controls, folded = false }: WherePlaceProps) {
  const t = useT();
  const observer = useActiveObserver();
  if (observer === null) return null;
  const change = <TextButton inline label={t.location.summaryChange} aria-expanded={open} aria-controls={controls} data-testid="location-summary-change" onClick={onToggle} />;
  if (folded) return <FoldedWhere observer={observer} change={change} />;
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

/**
 * R130 (FR-FLOW-2, D-844) as amended by D-1024: compact's Where — the place with `[ change ]` at the row's end, its
 * one control, and under it a fault line only while there is a fault. `data-state` says whether the readiness has
 * answered (`ready`) or not yet (`pending`), which nothing on the folded Where says in words and a capture's wait
 * still needs (R156).
 */
function FoldedWhere({ observer, change }: { observer: Observer; change: ReactNode }) {
  const readiness = useReadiness();
  const age = useElementsAge();
  return (
    <div className={styles.where} data-folded="" data-testid="where-folded" data-state={readiness ? 'ready' : 'pending'}>
      <div className={styles.placeRow} data-testid="where-place-row">
        <p className={styles.place} data-testid="location-summary">
          <PlaceText observer={observer} />
        </p>
        {change}
      </div>
      <WhereFault readiness={readiness} age={age} />
    </div>
  );
}
