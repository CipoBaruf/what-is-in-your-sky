import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useStarsPageT } from '../../../i18n/starsPageT';
import { useT } from '../../../i18n/useT';
import { BOX_CELLS, SHELL_PADDING_CELLS } from '../../../lib/layout';
import type { ChartView, GlobeTurn } from '../../../model';
import { useAppStore } from '../../../state';
import type { StarField } from '../guide/skychart/window/scene';
import { OptionToggle } from '../primitives/OptionToggle';
import { SectionHeading } from '../primitives/SectionHeading';
import { ToggleGroup } from '../primitives/ToggleGroup';
import styles from './SkyLayers.module.css';

/**
 * R222 (FR-LAND-3, FR-STAR-3 as amended; D-1240): the stars page's `Turn` and `Layers`, moved into the live page's
 * `turn` and `layers` slots. The choices are the kept ones (FR-KEEP-1): `globeTurn`, `starLayers`, `namesChoice` and
 * `faintStars`. Composition over the store; the scene and the globe read `useSkyLayers`'s answer through the page.
 */

/** FR-STAR-3 as amended v2.11: the four layer toggles in this order. */
export const LAYER_KEYS = ['stars', 'figures', 'planets', 'names'] as const satisfies readonly (keyof StarField['layers'])[];

/** FR-COMP-4's 36 cells at 390 px less the shell's padding each side (R163): the room a layer row has, 32 cells. */
const LAYER_ROW_BUDGET = 36 - 2 * SHELL_PADDING_CELLS;
/** FR-CTRL-3, D-1248: a quarter cell between two options side by side (`OptionToggle.module.css`). */
const OPTION_GAP_CELLS = 0.25;

/**
 * R132 (FR-FLOW-8, D-865), R206 (D-1226, D-1249): how many of the layer toggles the first row holds — as many as fit
 * the budget as a word in two cells of box, a quarter cell between, at least one and never all of them. Three in both
 * languages at 32 cells (25.5 in English, 30.5 in Spanish), then `names`.
 */
export function firstRowCount(labels: readonly string[], budget: number): number {
  let cells = 0;
  let count = 0;
  for (const label of labels) {
    const next = cells + (count > 0 ? OPTION_GAP_CELLS : 0) + BOX_CELLS + label.length;
    if (next > budget && count > 0) break;
    cells = next;
    count += 1;
  }
  return Math.max(1, Math.min(count, labels.length - 1));
}

export interface SkyLayersState {
  /** The four layers as drawn: the three switches and the names, whose default is by view until tapped (FR-PHONE-8). */
  layers: StarField['layers'];
  /** `[ ] faint` as drawn: the kept choice, unless the deep catalogue failed to load this visit. */
  faint: boolean;
  toggle: (key: keyof StarField['layers']) => void;
  setFaint: (on: boolean) => void;
  onFaintFailed: () => void;
}

/**
 * The kept layer choices as the page draws them. R160 (FR-PHONE-8, D-968, D-990): the names are on for every view but
 * the polar chart until `[x] names` is tapped, from when the tap holds for every view. FR-GLOBE-10 as amended by
 * FR-KEEP-1: a failed deep load unpresses `faint` for the visit and leaves the saved choice alone.
 */
export function useSkyLayers(view: ChartView): SkyLayersState {
  const kept = useAppStore((s) => s.starLayers);
  const setKept = useAppStore((s) => s.setStarLayers);
  const namesChoice = useAppStore((s) => s.namesChoice);
  const setNamesChoice = useAppStore((s) => s.setNamesChoice);
  const faintStars = useAppStore((s) => s.faintStars);
  const setFaintStars = useAppStore((s) => s.setFaintStars);
  const [faintFailed, setFaintFailed] = useState(false);
  const names = namesChoice ?? view !== 'polar';
  const layers = useMemo<StarField['layers']>(() => ({ ...kept, names }), [kept, names]);
  const toggle = useCallback(
    (key: keyof StarField['layers']) => {
      if (key === 'names') setNamesChoice(!names);
      else setKept({ ...kept, [key]: !kept[key] });
    },
    [kept, names, setKept, setNamesChoice],
  );
  const setFaint = useCallback(
    (on: boolean) => {
      setFaintFailed(false);
      setFaintStars(on);
    },
    [setFaintStars],
  );
  const onFaintFailed = useCallback(() => {
    setFaintFailed(true);
  }, []);
  return { layers, faint: faintStars && !faintFailed, toggle, setFaint, onFaintFailed };
}

/** FR-GLOBE-5: `Turn` — `[x] with you [ ] with the stars`, wide only, while the globe is the view. */
export function TurnGroup({ turn, onTurn }: { turn: GlobeTurn; onTurn: (turn: GlobeTurn) => void }) {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.block} data-testid="globe-turn">
      <SectionHeading id={headingId}>{t.globe.turnHeading}</SectionHeading>
      <div className={styles.row} data-testid="globe-turn-row">
        <ToggleGroup
          name={t.globe.turnHeading}
          options={[
            { value: 'you', label: t.globe.turn.you },
            { value: 'stars', label: t.globe.turn.stars },
          ]}
          value={turn}
          onChange={onTurn}
        />
      </div>
    </section>
  );
}

export interface LayersGroupProps {
  state: SkyLayersState;
  /** `[ ] faint` is offered: the globe is the view (FR-GLOBE-10). */
  withFaint: boolean;
  /** The page's own last row: the live page's `Hidden objects` (FR-LIVE-6). */
  children?: ReactNode;
  /** The compact sheet's rhythm attribute (D-851); wide's rail sets its own. */
  rhythm?: boolean;
}

/**
 * FR-LAND-3: `Layers` — `[x] stars [x] figures [x] planets` over `[x] names` (and `[ ] faint` on the globe), split by
 * the row's room (`firstRowCount`), then the page's own row. Every toggle carries `data-layer` for the tests.
 */
export function LayersGroup({ state, withFaint, children, rhythm = false }: LayersGroupProps) {
  const p = useStarsPageT();
  const t = useT();
  const headingId = useId();
  const first = firstRowCount(
    LAYER_KEYS.map((key) => p.layers[key]),
    LAYER_ROW_BUDGET,
  );
  const faint = withFaint ? <OptionToggle key="faint" label={t.globe.faint} pressed={state.faint} onPress={() => { state.setFaint(!state.faint); }} data-layer="faint" alone /> : null;
  const layer = (key: keyof StarField['layers'], alone: boolean) => <OptionToggle key={key} label={p.layers[key]} pressed={state.layers[key]} onPress={() => { state.toggle(key); }} data-layer={key} alone={alone} />;
  const row = rhythm ? { 'data-rhythm': 'row' } : {};
  return (
    <section className={styles.block} aria-labelledby={headingId} data-testid="live-layers" {...(rhythm ? { 'data-rhythm': 'group' } : {})}>
      <SectionHeading id={headingId}>{t.skyView.layers}</SectionHeading>
      <div role="group" aria-label={t.skyView.layers} className={styles.rows} data-testid="stars-layers">
        <div className={styles.row} data-testid="stars-layers-row" {...row}>
          {LAYER_KEYS.slice(0, first).map((key, index) => layer(key, index > 0))}
        </div>
        <div className={styles.row} data-testid="stars-layers-row" {...row}>
          {/* The last option of a row stands alone (no trailing cell); with `[ ] faint` after them, `names` is not the last. */}
          {LAYER_KEYS.slice(first).map((key, index) => layer(key, index > 0 && faint === null))}
          {faint}
        </div>
        {children !== undefined && children !== null && (
          <div className={styles.row} data-testid="live-layers-own" {...row}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
