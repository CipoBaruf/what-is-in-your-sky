import { Fragment, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { HINT_TOUCH_CLAUSES } from '../../../lib/layout';
import type { ChartView } from '../../../model';
import { useAppStore } from '../../../state';
import styles from './SkyHint.module.css';

/**
 * R132 (FR-FLOW-6, D-848): the hint over the box's corner, one line at
 * `--small` in `--fg-dim`, worded by the pointer — `(pointer: coarse)` is a
 * touch screen, anything else a mouse — read once per mount.
 *
 * R214 (FR-CTRL-9; D-1241, D-1273): the window and the globe, which zoom, read
 * "drag to turn · scroll to zoom", on touch "drag to turn · pinch to zoom",
 * until the first drag or zoom on either; then `SKY_HINT_KEY` is set on the
 * device and the line is gone from both for good.
 *
 * The dome keeps its own line: the drag clause, and on a touch pointer on the
 * live page with a highlighted pass "· tap A to follow" (FR-SKY-13,
 * FR-PHONE-5: at most `HINT_TOUCH_CLAUSES`), until a first gesture on any sky
 * view sets `skyHintSeen` in the prefs. The polar chart, which has no drag,
 * has no hint (D-864). A page asks `useSkyHintShown` first and hands the
 * layout's `hint` slot nothing when there is no line, so the slot is not
 * rendered at all.
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

/** FR-CTRL-9 (D-1241): the device's key, `'1'` once the globe or the window was dragged or zoomed. */
const SKY_HINT_KEY = 'wiys:hint:globe:v1';
const zoomHintListeners = new Set<() => void>();

function zoomHintDone(): boolean {
  try {
    return globalThis.localStorage?.getItem(SKY_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** The first drag or zoom on a view that zooms: the view calls it, and the hint goes from both. */
export function markZoomHintDone(): void {
  if (zoomHintDone()) return;
  try {
    globalThis.localStorage?.setItem(SKY_HINT_KEY, '1');
  } catch {
    // A storage that refuses the write (full, or private) only means the hint stays.
    return;
  }
  for (const listener of [...zoomHintListeners]) listener();
}

function onZoomHintDone(listener: () => void): () => void {
  zoomHintListeners.add(listener);
  return () => {
    zoomHintListeners.delete(listener);
  };
}

const zooms = (view: ChartView): boolean => view === 'window' || view === 'globe';

/** Whether the hint has a line for `view`: the zooming views' until their key is set, the dome's until `skyHintSeen`, never the polar chart's (D-864). */
export function useSkyHintShown(view: ChartView): boolean {
  const seen = useAppStore((s) => s.skyHintSeen);
  const done = useSyncExternalStore(onZoomHintDone, zoomHintDone);
  return zooms(view) ? !done : !seen && view !== 'polar';
}

/**
 * R157 (FR-PHONE-5, D-966), R214 (FR-CTRL-9, D-1241): the hint's words for `view` and `pointer`, pure. A view that
 * zooms: turn, then zoom by the pointer, never a follow clause. The dome: the drag clause, and on touch the follow
 * clause where the live page names a key. The polar chart has no hint (D-864) and is not asked.
 */
export function skyHintLine(words: Messages['window']['skyHint'], view: ChartView, pointer: 'coarse' | 'fine', { follow }: { follow: string | null }): string {
  if (zooms(view)) return [words.turn, words.zoom[pointer]].join(SEPARATOR);
  if (pointer === 'fine') return words.drag.fine;
  const second = follow === null ? [] : [words.follow({ key: follow })];
  return [words.drag.coarse, ...second].slice(0, HINT_TOUCH_CLAUSES).join(SEPARATOR);
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
