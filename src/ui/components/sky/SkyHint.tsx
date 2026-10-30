import { useState } from 'react';
import { useT } from '../../../i18n/useT';
import type { ChartView } from '../../../model';
import { useAppStore } from '../../../state';
import styles from './SkyHint.module.css';

/**
 * R132 (FR-FLOW-6, D-848): the hand hint, one line at `--small` in `--fg-dim`
 * under the facing picker (the layout's `hint` slot), in the reader's terms.
 * Worded by the pointer — `(pointer: coarse)` is a touch screen, anything else
 * a mouse — read once per mount: "Drag to look · pinch to zoom · tap a star" or
 * "Drag or use the arrow keys · ctrl + wheel to zoom · click a star". The dome
 * gets the drag clause alone; the polar chart, which has no drag, gets no hint
 * (D-864). On the live page with a highlighted pass the coarse line ends
 * "· tap A to follow" (FR-SKY-13).
 *
 * It shows until the reader's first drag, pinch or tap on any sky view —
 * `useChartHand`'s gesture sets `skyHintSeen`, saved in the prefs — and is then
 * gone for good. A page asks `useSkyHintShown` first and hands the layout's
 * `hint` slot nothing when there is no line, so the slot is not rendered at all.
 */
export interface SkyHintProps {
  view: ChartView;
  /** FR-SKY-13: the highlighted pass's legend key on the live page, `null` or absent where there is none to follow. */
  followKey?: string | null;
}

const SEPARATOR = ' · ';

/** Whether the hint has a line for `view`: not once a gesture has set `skyHintSeen`, and never on the polar chart (D-864). */
export function useSkyHintShown(view: ChartView): boolean {
  const seen = useAppStore((s) => s.skyHintSeen);
  return !seen && view !== 'polar';
}

/**
 * R148 (FR-FULL-3, D-924): the hint's line and the pointer it is worded for, or `null` where there is none — the
 * same words `SkyHint` draws, so the compact live page can ask `hintFitsBeside` whether the line shares
 * `[ controls ]`'s row before it places the hint in its overlay.
 */
export function useSkyHintLine(view: ChartView, followKey: string | null = null): { text: string; pointer: 'coarse' | 'fine' } | null {
  const t = useT();
  const shown = useSkyHintShown(view);
  const [pointer] = useState<'coarse' | 'fine'>(() => (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine'));
  if (!shown) return null;
  const words = t.window.skyHint;
  const clauses = view === 'window' ? [words.drag[pointer], words.zoom[pointer], words.star[pointer]] : [words.drag[pointer]];
  if (pointer === 'coarse' && followKey !== null) clauses.push(words.follow({ key: followKey }));
  return { text: clauses.join(SEPARATOR), pointer };
}

export function SkyHint({ view, followKey = null }: SkyHintProps) {
  const line = useSkyHintLine(view, followKey);
  if (line === null) return null;
  return (
    <p className={styles.hint} data-testid="sky-hint" data-pointer={line.pointer}>
      {line.text}
    </p>
  );
}
