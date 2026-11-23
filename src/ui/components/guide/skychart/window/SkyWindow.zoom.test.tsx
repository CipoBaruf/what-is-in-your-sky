// @vitest-environment jsdom
/**
 * R214 (FR-CTRL-9; D-1241, D-1271..D-1273): the window in a desk's sky layout — the three keys in the row under
 * the box, the wheel's equal step, `⟲` to the opening camera, and what puts the hint away.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../../../tests/support/matchMedia';
import type { Observer } from '../../../../../model';
import { SkyHint } from '../../../sky/SkyHint';
import { SkyViewLayout } from '../../../sky/SkyViewLayout';
import { createHandCamera, facePeak, initialHand, type HandCamera } from './camera';
import { resetOrientationAccess } from './orientationAccess';
import { SkyWindow, type SkyWindowProps } from './SkyWindow';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const pass = goldenPassFixture();

let media: MatchMediaStub;
beforeEach(() => {
  resetOrientationAccess();
  media = stubMatchMedia(WIDE_PX);
});
afterEach(() => {
  cleanup();
  media.restore();
  localStorage.clear();
});

function mount(camera: HandCamera, extra: Partial<SkyWindowProps> = {}) {
  const onFieldChoice = vi.fn<(fovDeg: number) => void>();
  const { container } = render(
    <SkyViewLayout data-testid="layout" drawing={<SkyWindow passes={[]} observer={observer} highlightedPassId={null} camera={camera} onFieldChoice={onFieldChoice} {...extra} />} hint={<SkyHint view="window" />} />,
  );
  const row = container.querySelector('[data-slot="drawing"] > [data-zoom-row]') as HTMLElement;
  const box = container.querySelector('[tabindex="0"][data-dragging]') as HTMLElement;
  const key = (name: string): HTMLButtonElement => within(row).getByRole('button', { name });
  return { row, box, key, onFieldChoice };
}

describe('the window’s zoom keys (FR-CTRL-9)', () => {
  it('FR-CTRL-9: − + ⟲ in the row under the box, + and − a step each, ⟲ the opening camera', () => {
    const camera = createHandCamera({ azDeg: 90, altDeg: 10 });
    const { row, key, onFieldChoice } = mount(camera);
    expect(within(row).getAllByRole('button').map((button) => button.textContent)).toEqual(['−', '+', '⟲']);
    fireEvent.click(key('Zoom in'));
    expect(camera.get()).toEqual({ azDeg: 90, altDeg: 10, fovDeg: 48 });
    fireEvent.click(key('Zoom out'));
    fireEvent.click(key('Zoom out'));
    expect(camera.get().fovDeg).toBeCloseTo(75, 6);
    fireEvent.click(key('Zoom out'));
    expect(camera.get().fovDeg).toBe(90);
    expect(key('Zoom out').disabled).toBe(true);
    fireEvent.click(key('Reset view'));
    expect(camera.get()).toEqual(initialHand(observer.lat));
    expect(onFieldChoice).toHaveBeenLastCalledWith(60);
    expect(key('Zoom out').disabled).toBe(false);
  });

  it('FR-CTRL-9: ⟲ is the peak where the page opens on the peak', () => {
    const camera = createHandCamera({ azDeg: 90, altDeg: 10, fovDeg: 30 });
    const { key } = mount(camera, { passes: [pass], highlightedPassId: pass.id, facingOptions: ['peak', 'N', 'up'] });
    fireEvent.click(key('Reset view'));
    expect(camera.get()).toEqual(facePeak(pass.peak, 60));
  });

  it('FR-CTRL-9: in a layout a plain wheel zooms by the keys’ step and is taken from the page; cmd + wheel is the browser’s', async () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    const { box } = mount(camera);
    expect(fireEvent.wheel(box, { deltaY: -100, metaKey: true })).toBe(true);
    expect(fireEvent.wheel(box, { deltaY: -100 })).toBe(false);
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(camera.get().fovDeg).toBeCloseTo(48, 6);
  });
});

describe('what puts the hint away (FR-CTRL-9)', () => {
  it('FR-CTRL-9: a zoom does', () => {
    const { key } = mount(createHandCamera({ azDeg: 180, altDeg: 35 }));
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    act(() => {
      key('Zoom in').click();
    });
    expect(screen.queryByTestId('sky-hint')).toBeNull();
  });

  it('FR-CTRL-9: a drag does, and a tap does not', () => {
    const { box } = mount(createHandCamera({ azDeg: 180, altDeg: 35 }));
    const at = (clientX: number) => ({ pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse', clientX, clientY: 100 });
    fireEvent.pointerDown(box, at(100));
    fireEvent.pointerMove(box, at(103));
    fireEvent.pointerUp(box, at(103));
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    fireEvent.pointerDown(box, at(100));
    fireEvent.pointerMove(box, at(160));
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(localStorage.getItem('wiys:hint:globe:v1')).toBe('1');
  });
});
