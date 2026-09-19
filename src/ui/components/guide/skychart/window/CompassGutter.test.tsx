/**
 * R79 (FR-GUT-2..5, FR-GUT-8; US-28 AC1..AC3): the gutter as rendered. Where
 * anything goes is `gutter.test.ts`'s — this asserts only that the component
 * renders what the model says: a name per compass point on the band, a tick
 * per drawn pass with the key only outside the bracket, an edge marker per
 * off-band pass with the angle in it, and the marks as words for what reads
 * the page (FR-X-5). No geometry through the DOM (FR-GUT-5).
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { es } from '../../../../../i18n/es';
import { I18nProvider } from '../../../../../i18n/useT';
import { CompassGutter } from './CompassGutter';
import { gutterMarks, type GutterPass } from './gutter';
import { WINDOW_FOV, type View } from './projection';

const SIDEWAYS: View = { fovDeg: WINDOW_FOV, width: 844, height: 390, screenAngleDeg: 0 };

const passes: GutterPass[] = [
  { id: 'a', name: 'ISS', key: 'A', color: 'series-1', bearingDeg: 10 },
  { id: 'b', name: 'Tiangong', key: 'B', color: 'series-2', bearingDeg: 75 },
  { id: 'c', name: 'Hubble', key: 'C', color: 'series-3', bearingDeg: 200 },
  { id: 'd', name: 'Starlink', key: 'D', color: 'series-4', bearingDeg: 120 },
  { id: 'e', name: 'CSS', key: 'E', color: 'series-5', bearingDeg: 250 },
];

function gutter(facingDeg = 0) {
  return render(<CompassGutter facingDeg={facingDeg} view={SIDEWAYS} marks={gutterMarks(passes, facingDeg, SIDEWAYS)} />);
}

describe('<CompassGutter>', () => {
  it('names each compass point that falls on the band, and none that does not', () => {
    const { container } = gutter(0);
    expect([...container.querySelectorAll('[data-compass]')].map((el) => el.textContent)).toEqual(['N', 'NE', 'E', 'W', 'NW']);
    expect(container.querySelector('[data-compass="S"]')).toBeNull();
  });

  it('draws a tick per pass on the band, with its key only outside the bracket', () => {
    const { container } = gutter(0);
    const band = container.querySelectorAll('[data-branch="in-bracket"], [data-branch="on-band"]');
    expect([...band].map((el) => el.getAttribute('data-gutter-mark'))).toEqual(['a', 'b']);
    const inside = container.querySelector('[data-gutter-mark="a"]');
    const outside = container.querySelector('[data-gutter-mark="b"]');
    expect(inside).toHaveAttribute('data-branch', 'in-bracket');
    expect(inside?.textContent).toBe('');
    expect(inside?.querySelector('[data-color="series-1"]')).not.toBeNull();
    expect(outside).toHaveAttribute('data-branch', 'on-band');
    expect(outside?.textContent).toBe('B');
    expect(screen.getByTestId('gutter-bracket')).toBeInTheDocument();
  });

  it('puts every pass off the band at its nearer end with the angle to turn, nearest first', () => {
    const { container } = gutter(0);
    expect([...container.querySelectorAll('[data-edge="left"]')].map((el) => el.textContent)).toEqual(['◀ E 110°', '◀ C 160°']);
    expect([...container.querySelectorAll('[data-edge="right"]')].map((el) => el.textContent)).toEqual(['D 120° ▶']);
  });

  it('is a picture for the eye and a list of sentences for everything else', () => {
    const { container } = gutter(0);
    const group = screen.getByRole('group', { name: 'Which way to turn' });
    expect(container.querySelector('[aria-hidden="true"]')).toContainElement(screen.getByTestId('gutter-bracket'));
    expect(within(group).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'A ISS: in view',
      'B Tiangong: 75° to the right',
      'C Hubble: 160° to the left',
      'D Starlink: 120° to the right',
      'E CSS: 110° to the left',
    ]);
  });

  it('says it in Spanish', () => {
    render(
      <I18nProvider locale="es">
        <CompassGutter facingDeg={0} view={SIDEWAYS} marks={gutterMarks(passes, 0, SIDEWAYS)} />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: es.window.gutterLabel })).toHaveTextContent('D Starlink: 120° a la derecha');
  });
});
