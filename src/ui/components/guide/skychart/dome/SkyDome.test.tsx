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

  it('labels the compass points, the pass and its peak; labels run away from the drawing edge; a click on the pass reports its id', () => {
    const onSelectPass = vi.fn();
    const { container } = mount({ onSelectPass });
    for (const label of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) expect(container.querySelector(`[data-anchor="${label}"]`)?.textContent).toBe(label);
    // Facing NE: NW and W are on the left half, SE and E on the right; N and SW straddle the centre line.
    expect(container.querySelector('[data-anchor="NW"]')).toHaveAttribute('data-side', 'left');
    expect(container.querySelector('[data-anchor="SE"]')).toHaveAttribute('data-side', 'right');
    expect(container.querySelector('[data-anchor="NE"]')).toHaveAttribute('data-side', 'centre');
    const name = container.querySelector('[data-anchor="pass"]');
    expect(name?.textContent).toBe('ISS (Zarya) 09:48:14 UTC');
    expect(container.querySelector('[data-anchor="peak"]')?.textContent).toBe('max 10°');
    const group = name?.closest('[data-pass-id]');
    expect(group).toHaveAttribute('data-pass-id', pass.id);
    if (!group) throw new Error('no pass element');
    fireEvent.click(group);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
  });

  it('draws every pass, the highlighted one in the accent and the others dim, and marks the current position only inside a pass', () => {
    const { container, rerender } = mount({ passes: [other, pass], now: pass.start.t + 10_000 });
    expect(container.querySelectorAll('[data-pass-id]')).toHaveLength(2);
    expect(container.querySelector(`[data-pass-id="${pass.id}"]`)?.className).toMatch(/passLabel(?!Dim)/);
    expect(container.querySelector('[data-pass-id="other"]')?.className).toMatch(/passLabelDim/);
    expect(container.querySelector(`[data-glyph-mesh-id="now-${pass.id}"]`)).not.toBeNull();
    expect(container.querySelector('[data-glyph-mesh-id="now-other"]')).toBeNull();
    rerender(<SkyDome passes={[other, pass]} observer={observer} highlightedPassId={pass.id} now={pass.end.t + 1} />);
    expect(container.querySelector(`[data-glyph-mesh-id="now-${pass.id}"]`)).toBeNull();
  });
});
