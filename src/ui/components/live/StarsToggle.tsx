import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { OptionToggle } from '../primitives/OptionToggle';

/**
 * R123 (FR-SKY-3, US-40 AC1, D-791): `[x] stars` / `[x] estrellas` — the one
 * toggle for the stars, the figures and the planets under the arcs, on the
 * live page's actions row and the pass detail's view row, and on compact in
 * the chart's readout row (`ChartFrameSlots`' `readoutAction`). An
 * `OptionToggle` standing alone, as the hidden-objects toggle is; the state is
 * the store's `starsLayer`, saved in the prefs, so the screen opened from the
 * page draws what the page drew (FR-FSC-1: the screen has no toggle of its
 * own). `inline` where it shares a text row with the readout, so its tap box
 * does not make the row taller.
 */
export function StarsToggle({ inline = false }: { inline?: boolean }) {
  const t = useT();
  const on = useAppStore((s) => s.starsLayer);
  const setStarsLayer = useAppStore((s) => s.setStarsLayer);
  return (
    <OptionToggle
      label={t.live.starsToggle}
      pressed={on}
      alone
      inline={inline}
      data-testid="stars-toggle"
      aria-label={t.live.starsToggleName}
      onPress={() => {
        setStarsLayer(!on);
      }}
    />
  );
}
