import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import styles from './Mark.module.css';
import rastersJson from './rasters.json';
import { denseFrame, markCells, MARK_FRAME_MS, MARK_ORBIT_FRAMES, type MarkRasters, type MarkTier } from './tiers';

/**
 * R74 (FR-MARK-1..FR-MARK-5, D-439): the app's mark, "Aperture".
 *
 * Two `<pre>`s in one box: the body, written once and never again, and the
 * bead's layer, whose text is swapped once a second while it runs. The
 * component holds no geometry at all — no rings, no radii, no camera. Every
 * tier is a committed raster in `rasters.json`, generated from the scene under
 * `spike/mark/` by `npm run build:icons` (D-438), so the drawing in the header
 * and the drawing in the icons cannot disagree and the page pays nothing to
 * rasterise anything.
 *
 * The animation is FR-MARK-5's: `MARK_ORBIT_FRAMES` pre-rasterised bead
 * positions stepped by a `setInterval` — a second apart, which is what a bead
 * crossing a cell looks like anyway, and between steps the page does nothing.
 * Under `prefers-reduced-motion: reduce` the bead does not advance; the tone
 * and the word beside it still change, so the state is never motion alone.
 *
 * The mark carries no meaning a reader could not get from the words beside it,
 * so it is `aria-hidden`: FR-MARK-5's states are announced by `live` and
 * `held`, and the header's own title names the app.
 */
const RASTERS = rastersJson as MarkRasters;

/** FR-MARK-3: the bead's two tones. The body is always `--fg-dim`. */
export type MarkTone = 'accent' | 'warn';

export interface MarkProps {
  /** Which grid of the ladder to draw (FR-MARK-2). */
  tier: MarkTier;
  /** How wide the drawing is; the box is square, so this is its height too. */
  sizePx: number;
  /** FR-MARK-5: whether the bead advances. */
  running?: boolean;
  /** FR-MARK-3: `--accent` while it runs, `--warn` while an instant is held. */
  tone?: MarkTone;
  className?: string;
}

export function Mark({ tier, sizePx, running = false, tone = 'accent', className }: MarkProps) {
  const raster = RASTERS[tier];
  const reduced = useMediaQuery(REDUCED_MOTION);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!running || reduced) return;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % MARK_ORBIT_FRAMES);
    }, MARK_FRAME_MS);
    return () => {
      clearInterval(timer);
    };
  }, [running, reduced]);

  const bead = useMemo(() => denseFrame(raster.frames[frame % raster.frames.length] ?? [], raster.cols, raster.rows), [raster, frame]);

  // The cell is the placement's pixel size divided by the tier's columns; the
  // advance of the braille font is 0.6 em and its line box is two advances
  // (D-65), which is what keeps the box square at every size.
  const cell = sizePx / raster.cols;
  const style: CSSProperties = { width: `${String(sizePx)}px`, height: `${String(sizePx)}px`, fontSize: `${String(cell / 0.6)}px`, lineHeight: `${String(2 * cell)}px` };

  return (
    <span
      className={className ? `${styles.mark} ${className}` : styles.mark}
      style={style}
      aria-hidden="true"
      data-testid="mark"
      data-mark-tier={tier}
      data-mark-running={running ? 'true' : 'false'}
      // D-441: what the mark costs a control row, for `tests/styles/cells.ts` — a
      // row is measured in characters, and the mark's characters are a drawing.
      data-mark-cells={String(markCells(sizePx))}
    >
      <pre className={`${styles.layer} ${styles.body}`} data-mark-layer="body">
        {raster.body}
      </pre>
      <pre className={`${styles.layer} ${tone === 'warn' ? styles.warn : styles.accent}`} data-mark-layer="bead" data-mark-frame={String(frame)}>
        {bead}
      </pre>
    </span>
  );
}

/** FR-MARK-5: the one query the mark asks. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
