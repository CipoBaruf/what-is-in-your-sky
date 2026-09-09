import { createContext, useContext, type ReactNode } from 'react';
import type { Quarter } from '../guide/skychart/window/screenTurn';

/**
 * R73 (FR-FSC-10; PLAN D-429): the one way the quarter travels.
 *
 * The rotation lives in `SkyWindow` — the sensor hook is its — and the
 * transform lives in `SkyScreen`, because the layer is its; `SkyChart` sits
 * between them with no business in either. A second `deviceorientation`
 * listener in the layer would answer that and would be exactly the duplicated
 * work R68 has just removed (F-57, F-58), so the window reports the quarter it
 * has already computed and the layer turns by it.
 *
 * With no provider — the spike's harness, the pass detail's window before R66,
 * any window not mounted in a layer — `report` is a no-op and the quarter is
 * `0`, so nothing anywhere has to know whether it is on a screen to compile or
 * to run.
 *
 * The window uses the quarter it computed for its own projection rather than
 * the one it reads back here, so the two can never disagree about geometry;
 * the layer's transform lands one commit later, which the `ResizeObserver`
 * settles in the frame after, and a quarter flip is something that happens
 * once when a hand turns, not once a frame.
 */
export interface ScreenTurn {
  /** What the window last read from the pose, in `screen.orientation.angle`'s own convention. */
  quarter: Quarter;
  /** The window's report, in an effect, when the quarter it computed changes. */
  report: (quarter: Quarter) => void;
}

/** No layer to turn: quarter 0 and a report nobody is listening to. */
const OFF_SCREEN: ScreenTurn = { quarter: 0, report: () => undefined };

const ScreenTurnContext = createContext<ScreenTurn>(OFF_SCREEN);

export function ScreenTurnProvider({ value, children }: { value: ScreenTurn; children: ReactNode }) {
  return <ScreenTurnContext.Provider value={value}>{children}</ScreenTurnContext.Provider>;
}

export function useScreenTurn(): ScreenTurn {
  return useContext(ScreenTurnContext);
}
