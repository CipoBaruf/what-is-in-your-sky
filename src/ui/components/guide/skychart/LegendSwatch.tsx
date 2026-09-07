import type { LegendColor } from '../../../../lib/legend';
import styles from './LegendSwatch.module.css';

/**
 * FR-LEG-5 (R45, extracted R51): the two-cell block of colour that ties a
 * legend line to its arc. One component, because `data-color` is mapped to
 * the `--chart-*` custom properties in one stylesheet and nowhere else
 * (FR-THEME-3: the token carries both themes), and because R51 puts a swatch
 * in the pass detail's numeric table as well as in the list — the table is
 * the legend there (FR-LEG-3), so its heading needs the same block of colour
 * the drawing's arc is in. Decorative: the key beside it is the channel that
 * carries the mapping without colour (FR-DOME-2), so it is hidden from
 * assistive technology.
 */
export interface LegendSwatchProps {
  /** A row's arc token, or one of the two bodies (FR-DOME-6 as amended). */
  color: LegendColor | 'sun' | 'moon';
  className?: string | undefined;
}

export function LegendSwatch({ color, className }: LegendSwatchProps) {
  return <span className={[styles.swatch, className].filter(Boolean).join(' ')} data-color={color} aria-hidden="true" />;
}
