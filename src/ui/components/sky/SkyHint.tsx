import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { HINT_TOUCH_CLAUSES } from '../../../lib/layout';
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
 * R157 (FR-PHONE-5, D-966): on a touch pointer the line is `HINT_TOUCH_CLAUSES`
 * clauses — "Drag to look · pinch to zoom", the star clause dropped — and with a
 * highlighted pass the follow clause takes the zoom clause's place, so the line
 * is never three ("Drag to look · tap A to follow"). The fine line is unchanged.
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
  /**
   * R157 (FR-PHONE-5, D-981): the compact live page's overlay — the line is drawn whole and never cut, so where it is
   * wider than its room (the Spanish touch line at 360 and 390 px) it breaks between its clauses into two lines, and
   * the surface is cut to the wider of them rather than to the row, so the two lines cover no more sky than they need.
   */
  fit?: boolean;
}

const SEPARATOR = ' · ';

/** Whether the hint has a line for `view`: not once a gesture has set `skyHintSeen`, and never on the polar chart (D-864). */
export function useSkyHintShown(view: ChartView): boolean {
  const seen = useAppStore((s) => s.skyHintSeen);
  return !seen && view !== 'polar';
}

/**
 * R157 (FR-PHONE-5, D-966): the hint's words for `view` and `pointer`, pure. Fine: the window's three clauses (drag,
 * zoom, star), the dome's drag clause alone, never a follow clause. Coarse: the drag clause, then the follow clause
 * where the live page names a key, else the window's zoom clause — at most `HINT_TOUCH_CLAUSES`. The polar chart has
 * no hint (D-864) and is not asked.
 */
export function skyHintLine(words: Messages['window']['skyHint'], view: ChartView, pointer: 'coarse' | 'fine', { follow }: { follow: string | null }): string {
  if (pointer === 'fine') return (view === 'window' ? [words.drag.fine, words.zoom.fine, words.star.fine] : [words.drag.fine]).join(SEPARATOR);
  const second = follow !== null ? words.follow({ key: follow }) : view === 'window' ? words.zoom.coarse : null;
  return [words.drag.coarse, ...(second === null ? [] : [second])].slice(0, HINT_TOUCH_CLAUSES).join(SEPARATOR);
}

/**
 * R148 (FR-FULL-3, D-924): the hint's line and the pointer it is worded for, or `null` where there is none — the
 * same words `SkyHint` draws, so the compact live page can ask `hintFitsBeside` whether the line shares the overlay's
 * bottom row before it places the hint in its overlay.
 */
export function useSkyHintLine(view: ChartView, followKey: string | null = null): { text: string; pointer: 'coarse' | 'fine' } | null {
  const t = useT();
  const shown = useSkyHintShown(view);
  const [pointer] = useState<'coarse' | 'fine'>(() => (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine'));
  if (!shown) return null;
  return { text: skyHintLine(t.window.skyHint, view, pointer, { follow: followKey }), pointer };
}

export function SkyHint({ view, followKey = null, fit = false }: SkyHintProps) {
  const line = useSkyHintLine(view, followKey);
  const ref = useRef<HTMLParagraphElement>(null);
  const text = line?.text ?? null;
  /*
   * R157 (D-981): whether the line, laid out at its natural width, takes more than one row — measured with the mark off,
   * then the mark set, so `width: min-content` (each clause unbroken) cuts the surface to the wider clause. Again on a
   * resize of the viewport, which is what changes the room, and once the fonts are ready; never on the line's own size,
   * which the mark changes.
   */
  useLayoutEffect(() => {
    const p = ref.current;
    if (!fit || p === null) return;
    const measure = (): void => {
      p.removeAttribute('data-wrapped');
      const row = parseFloat(getComputedStyle(p).lineHeight);
      if (Number.isFinite(row) && row > 0 && p.getBoundingClientRect().height > row * 1.5) p.setAttribute('data-wrapped', '');
    };
    measure();
    // The stack is the device's own monospace, but a face that arrives late measures differently: again once fonts are in.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    window.addEventListener('resize', measure);
    return () => {
      live = false;
      window.removeEventListener('resize', measure);
    };
  }, [fit, text]);
  if (line === null) return null;
  const clauses = line.text.split(SEPARATOR);
  return (
    <p ref={ref} className={styles.hint} data-testid="sky-hint" data-pointer={line.pointer} {...(fit ? { 'data-fit': '' } : {})}>
      {fit
        ? clauses.map((clause, i) =>
            i < clauses.length - 1 ? (
              <Fragment key={clause}>
                <span className={styles.clause}>{`${clause}${SEPARATOR.trimEnd()}`}</span>{' '}
              </Fragment>
            ) : (
              <span key={clause} className={styles.clause}>
                {clause}
              </span>
            ),
          )
        : line.text}
    </p>
  );
}
