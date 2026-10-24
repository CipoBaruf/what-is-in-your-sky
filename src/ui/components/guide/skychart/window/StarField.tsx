import { memo, useLayoutEffect, useRef } from 'react';
import { groundState, lookDirection, type Mat3, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import styles from './SkyWindow.module.css';
import type { RotationListener } from './useViewRotation';

/**
 * R113 (FR-STAR-9 as amended, FR-STAR-11; PLAN D-751, D-744): the star field's
 * node set, the window's one layer written outside React. The component is a
 * `memo` child whose props change only when the catalogue, the layer set or
 * the box does; its nodes are rendered then and never again, and each
 * rotation the window publishes is written to them by the subscriber below —
 * `x`, `y`, `dx`, `dy` and `visibility` per node once R114 draws the stars,
 * the figures and the planets.
 *
 * In R113 the group is empty and the one write per rotation is the group's
 * own `visibility`: hidden when FR-FOL-5's `buried` state leaves no sky in the
 * field (the frame the window itself draws nothing in), visible otherwise.
 * That is the channel proven end to end — one subscriber, one write per
 * published rotation, no render of this component in between — with the
 * drawing left to the task that owns it.
 */
export interface StarFieldProps {
  field: StarFieldData;
  view: View;
  /** `useViewRotation`'s channel: one call per rotation the window draws, in the commit that draws it. */
  subscribe: (listener: RotationListener) => () => void;
}

/** The per-rotation write: everything the field changes outside render goes through here (R114 fills it). */
function drawField(group: SVGGElement, rotation: Mat3, view: View): void {
  group.setAttribute('visibility', groundState(lookDirection(rotation).altDeg, view) === 'buried' ? 'hidden' : 'visible');
}

export const StarField = memo(function StarField({ field, view, subscribe }: StarFieldProps) {
  const group = useRef<SVGGElement>(null);
  // A layout effect, like the publisher's: the subscription is in place before the window's first publish of
  // this commit reaches the list, and a late mount is given the current rotation by `subscribe` itself.
  useLayoutEffect(
    () =>
      subscribe((rotation) => {
        if (group.current) drawField(group.current, rotation, view);
      }),
    [subscribe, view],
  );
  return <g ref={group} className={styles.stars} data-layer="stars" data-stars={field.catalog.mag.length} data-planets={field.positions.planets.length} />;
});
