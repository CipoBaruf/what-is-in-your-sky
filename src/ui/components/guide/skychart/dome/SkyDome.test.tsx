/**
 * FR-GUIDE-2, FR-GUIDE-4, FR-GUIDE-7 (R15), in jsdom: the dome faces the
 * rise azimuth by default (or the facing it is given), the arrow keys turn
 * it by 15° and tilt it by 5° with the tilt held inside [5°, 80°], a pointer
 * drag turns and tilts it at 4 px per degree, the readout follows, the
 * labels run away from the drawing's edge, a click on the pass label
 * reports the pass id, and other passes are drawn dim. The Playwright spec
 * repeats the interaction checks on the production build.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import type { Observer, Pass } from '../../../../../model';
import { DRAG_PX_PER_DEG } from './camera';
import { SkyDome } from './SkyDome';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const other: Pass = { ...pass, id: 'other', name: 'Tiangong', start: { ...pass.start, t: pass.start.t + 3_600_000 } };

function mount(extra: Partial<Parameters<typeof SkyDome>[0]> = {}) {
  const utils = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} {...extra} />);
  const stage = utils.getByRole('group', { name: 'Sky dome' });
  const readout = () => utils.getByTestId('dome-readout').textContent;
  const facing = () => Number(utils.container.querySelector('[data-facing-az]')?.getAttribute('data-facing-az'));
  const tilt = () => Number(utils.container.querySelector('[data-tilt]')?.getAttribute('data-tilt'));
  return { ...utils, stage, readout, facing, tilt };
}

describe('<SkyDome>', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faces the rise azimuth at tilt 45° by default, and the given facing when there is one', () => {
    const { readout, facing, unmount } = mount();
    expect(readout()).toBe('Facing NE (46°) · tilt 45°');
    expect(facing()).toBe(46);
    unmount();
    const explicit = mount({ initialFacingAzDeg: 202.5 });
    expect(explicit.readout()).toBe('Facing SSW (203°) · tilt 45°');
  });

  it('hides the drawing from assistive technology, draws no canvas, and the wrapper is a labelled focusable group described by the readout', async () => {
    const { container, stage } = mount();
    const drawing = container.querySelector('[data-drawing="dome"]');
    expect(drawing).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('pre.glyph-output')).not.toBeNull();
    // D-61: the base rules come from our stylesheet; the library's <style> injection is kept off by the sentinel id (the CSP would block and report it).
    expect(document.querySelector('style#glyph-styles')).toBeNull();
    expect(container.querySelector('#glyph-styles')).not.toBeNull();
    expect(stage).toHaveAttribute('tabindex', '0');
    expect(stage).toHaveAccessibleDescription(/^Facing NE/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('arrow keys turn by 15° and tilt by 5°; the tilt never leaves [5°, 80°]', () => {
    const { stage, readout, facing, tilt } = mount();
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(facing()).toBe(31);
    expect(readout()).toBe('Facing NNE (31°) · tilt 45°');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(facing()).toBe(61);
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(facing()).toBe(1);
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(facing()).toBe(346);
    for (let i = 0; i < 20; i++) fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(tilt()).toBe(80);
    expect(readout()).toBe('Facing NNW (346°) · tilt 80°');
    for (let i = 0; i < 20; i++) fireEvent.keyDown(stage, { key: 'ArrowDown' });
    expect(tilt()).toBe(5);
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(readout()).toBe('Facing NNW (346°) · tilt 5°');
  });

  it('a pointer drag turns the view against the drag and tilts it, at 4 px per degree, one update per animation frame', async () => {
    const { stage, facing, tilt } = mount();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    expect(stage).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100 + 10 * DRAG_PX_PER_DEG, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100 + 20 * DRAG_PX_PER_DEG, clientY: 100 + 8 * DRAG_PX_PER_DEG });
    expect(facing()).toBe(46); // not before the frame
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(facing()).toBe(26);
    expect(tilt()).toBe(37);
    // A second pointer is ignored; the first one ends the drag.
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 180, clientY: 132 });
    expect(stage).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 400, clientY: 400 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(facing()).toBe(26);
    // Dragging up past the clamp stops at 80°.
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 100, clientY: 500, button: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(stage, { pointerId: 3, clientX: 100, clientY: 0 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(tilt()).toBe(80);
    // A right button press starts nothing.
    fireEvent.pointerUp(stage, { pointerId: 3, clientX: 100, clientY: 0 });
    fireEvent.pointerDown(stage, { pointerId: 4, clientX: 100, clientY: 100, button: 2, pointerType: 'mouse' });
    expect(stage).toHaveAttribute('data-dragging', 'false');
  });

  /** R34 (FR-LIVE-8, D-176): the live page turns the dome to the phone's heading, and learns of a drag. */
  it('turns to a facing set from outside, keeps the tilt, reports the first movement of a drag once, and not a tap', async () => {
    const onDrag = vi.fn();
    const { stage, facing, tilt, readout, rerender } = mount({ facingAzDeg: 90, onDrag });
    expect(facing()).toBe(90);
    expect(readout()).toBe('Facing E (90°) · tilt 45°');
    const turned = (to: number | undefined) => rerender(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} facingAzDeg={to} onDrag={onDrag} />);
    turned(180);
    expect(facing()).toBe(180);
    turned(-30);
    expect(facing()).toBe(330);
    // Undefined leaves the camera where it is; the keys still move it in between.
    turned(undefined);
    expect(facing()).toBe(330);
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(facing()).toBe(345);
    turned(10);
    expect(facing()).toBe(10);
    expect(tilt()).toBe(50);
    expect(onDrag).not.toHaveBeenCalled();
    // A tap: down and up with no movement is not a drag.
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(onDrag).not.toHaveBeenCalled();
    // A drag: reported on its first movement, once, however many moves follow.
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 104, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 108, clientY: 100 });
    expect(onDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 108, clientY: 100 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(facing()).toBe(8);
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(stage, { pointerId: 3, clientX: 100, clientY: 104 });
    expect(onDrag).toHaveBeenCalledTimes(2);
  });

  it('labels the compass points and the pass with its legend key at the peak, nothing else; compass labels run away from the drawing edge; a click on the key reports the pass id', () => {
    const onSelectPass = vi.fn();
    const { container, unmount } = mount({ onSelectPass, legendKeys: { [pass.id]: 'A' } });
    for (const label of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) expect(container.querySelector(`[data-anchor="${label}"]`)?.textContent).toBe(label);
    // Facing NE: NW and W are on the left half, SE and E on the right; N and SW straddle the centre line.
    expect(container.querySelector('[data-anchor="NW"]')).toHaveAttribute('data-side', 'left');
    expect(container.querySelector('[data-anchor="SE"]')).toHaveAttribute('data-side', 'right');
    expect(container.querySelector('[data-anchor="NE"]')).toHaveAttribute('data-side', 'centre');
    // FR-LEG-1 (R45): the key is the pass's one label, and the one element carrying `data-pass-id`.
    const key = container.querySelector('[data-anchor="key"]');
    expect(key?.textContent).toBe('A');
    expect(key).toHaveAttribute('data-key', 'A');
    expect(key).toHaveAttribute('data-pass-id', pass.id);
    expect(container.querySelectorAll('[data-pass-id]')).toHaveLength(1);
    expect(container.querySelector('[data-anchor="pass"]')).toBeNull();
    expect(container.querySelector('[data-anchor="peak"]')).toBeNull();
    expect(container.textContent).not.toContain('ISS');
    expect(container.textContent).not.toContain('max ');
    if (!key) throw new Error('no key element');
    fireEvent.click(key);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
    // Without keys (a view mounted alone) the pass draws no label at all.
    unmount();
    expect(mount().container.querySelector('[data-anchor="key"]')).toBeNull();
  });

  it('draws every pass, the highlighted one in the accent and the others dim, and marks the current position only inside a pass', () => {
    const keys = { [pass.id]: 'A', other: 'B' };
    const { container, rerender } = mount({ passes: [other, pass], now: pass.start.t + 10_000, legendKeys: keys });
    expect(container.querySelectorAll('[data-pass-id]')).toHaveLength(2);
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)?.className).toMatch(/passLabel(?!Dim)/);
    expect(container.querySelector('[data-pass-id="other"]')?.className).toMatch(/passLabelDim/);
    expect(container.querySelector(`[data-glyph-mesh-id="now-${pass.id}"]`)).not.toBeNull();
    expect(container.querySelector('[data-glyph-mesh-id="now-other"]')).toBeNull();
    rerender(<SkyDome passes={[other, pass]} observer={observer} highlightedPassId={pass.id} now={pass.end.t + 1} legendKeys={keys} />);
    expect(container.querySelector(`[data-glyph-mesh-id="now-${pass.id}"]`)).toBeNull();
  });

  /** FR-TRAJ-1 / D-189 (R45): the same pass in its other states, as the meshes glyphcss is given. */
  it('draws a pass in its arc state: the cut track with the marker when live, a rise marker when ahead, the strip alone when lingering, nothing when hidden', () => {
    const mesh = (container: HTMLElement, id: string) => container.querySelector(`[data-glyph-mesh-id="${id}"]`);
    const live = mount({ passes: [{ ...pass, arc: 'live' }], now: pass.start.t + 20_000, legendKeys: { [pass.id]: 'A' } });
    expect(mesh(live.container, `pass-${pass.id}`)).not.toBeNull();
    expect(mesh(live.container, `now-${pass.id}`)).not.toBeNull();
    expect(mesh(live.container, `flown-${pass.id}`)).toBeNull();
    live.unmount();
    const ahead = mount({ passes: [{ ...pass, arc: 'ahead' }], now: pass.start.t - 60_000, legendKeys: { [pass.id]: 'A' } });
    expect(mesh(ahead.container, `rise-${pass.id}`)).not.toBeNull();
    expect(mesh(ahead.container, `now-${pass.id}`)).toBeNull();
    expect(ahead.container.querySelector('[data-anchor="key"]')?.textContent).toBe('A');
    ahead.unmount();
    const linger = mount({ passes: [{ ...pass, arc: 'linger' }], now: pass.end.t + 60_000, legendKeys: { [pass.id]: 'A' } });
    expect(mesh(linger.container, `pass-${pass.id}`)).not.toBeNull();
    expect(mesh(linger.container, `markers-${pass.id}`)).toBeNull();
    linger.unmount();
    const hidden = mount({ passes: [{ ...pass, arc: 'hidden' }], now: pass.end.t + 3_600_000, legendKeys: { [pass.id]: 'A' } });
    expect(mesh(hidden.container, `pass-${pass.id}`)).toBeNull();
    expect(hidden.container.querySelector('[data-anchor="key"]')).toBeNull();
  });
});
