/**
 * R202 (FR-OPEN-3, FR-OPEN-4, FR-OPEN-12..14; D-1179, D-1209..D-1211): the example band — its blocks in order, the
 * card as a control, the action's name, the waiting state, the look line's minutes, words in place of every degree
 * and magnitude, and the day line at an instant in each of the stripe's bands.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { SkyBand } from '../../../lib/timeStripe';
import type { Observer, Pass } from '../../../model';
import { appStore, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { NextEventBlock } from '../../components/passes/NextEventBlock';
import type { Tonight } from '../../components/now/useTonight';
import { ExampleBand, isDay } from './ExampleBand';

const HOUR = 3_600_000;
const pass = goldenPassFixture();
const NOW = goldenWindowStart();
// A day from 12 h before the pass, bright twilight for the hour before its dark band, the dark band round the pass.
const BANDS: SkyBand[] = [
  { from: pass.start.t - 14 * HOUR, to: pass.start.t - 3 * HOUR, sky: 'day' },
  { from: pass.start.t - 3 * HOUR, to: pass.start.t - 2 * HOUR, sky: 'bright-twilight' },
  { from: pass.start.t - 2 * HOUR, to: pass.start.t + 6 * HOUR, sky: 'dark' },
];
const tonight = vi.hoisted(() => ({ value: null as Tonight | null }));
vi.mock('../../components/now/useTonight', () => ({ useTonight: () => tonight.value }));

const example: Observer = { lat: -34.6, lon: -58.45, altM: 0, label: 'Buenos Aires', source: 'example', timeZone: 'America/Argentina/Buenos_Aires' };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

/** The band at `now`, the example's run in the store as the effects leave it. */
function at(now: number, passes: Pass[] = [pass]): void {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  tonight.value = { bands: BANDS, sampledFrom: BANDS[0]?.from ?? now, now };
  act(() => {
    appStore.setState({ example, exampleStartedMs: now, exampleOutcome: 'pass', nowMs: now, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: example, passes, hasDarkness: true } });
  });
}

const onSetPlace = vi.fn();
const onOpenPass = vi.fn();
const band = (pending = false, observer: Observer | null = example) => <ExampleBand observer={observer} pending={pending} onSetPlace={onSetPlace} onOpenPass={onOpenPass} selectedPassId={null} />;

beforeEach(() => {
  onSetPlace.mockClear();
  onOpenPass.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('<ExampleBand>', () => {
  it('FR-OPEN-3: the label, the next pass as the first card — a control — tonight’s stripe and the action, in that order', () => {
    at(pass.start.t - 12 * 60_000);
    render(band());
    const box = screen.getByTestId('example-band');
    expect(box).toHaveAccessibleName('Example: Buenos Aires, from your time zone');
    expect(box).toHaveAttribute('data-state', 'pass');
    const label = within(box).getByTestId('example-label');
    const card = within(box).getByTestId('next-event');
    const stripe = within(box).getByTestId('tonight-stripe');
    const action = within(box).getByRole('button', { name: 'Not there? Set your place' });
    expect([...box.children]).toEqual([label, card, stripe.parentElement, action]);
    expect(label).toHaveTextContent('Example: Buenos Aires, from your time zone');
    expect(card).toHaveAttribute('data-form', 'card');
    expect(within(card).getByTestId('next-event-label')).toHaveTextContent('First up · in 12:00');
    // The stripe's tick is under this pass.
    expect(stripe.textContent).toContain('▲');

    fireEvent.click(within(card).getByRole('button', { name: `${en.passes.openGuide} ${pass.name}` }));
    expect(onOpenPass).toHaveBeenCalledWith(pass.id);
    fireEvent.click(action);
    expect(onSetPlace).toHaveBeenCalledTimes(1);
    // There is no step line and no dome.
    expect(box.querySelector('ol, canvas, [data-drawing]')).toBeNull();
  });

  it('FR-OPEN-4: waiting, the label, "Finding tonight\'s passes over <city>…" and the action, already live; the card and the stripe hold their place', () => {
    at(pass.start.t - 12 * 60_000);
    render(band(true));
    const box = screen.getByTestId('example-band');
    expect(box).toHaveAttribute('data-state', 'pending');
    expect(within(box).getByTestId('example-label')).toHaveTextContent(en.example.label('Buenos Aires'));
    expect(within(box).getByRole('status')).toHaveTextContent("Finding tonight's passes over Buenos Aires…");
    expect(within(box).getByTestId('example-hold')).toContainElement(within(box).getByTestId('example-finding'));
    for (const id of ['next-event', 'tonight-stripe', 'example-after-dusk']) expect(within(box).queryByTestId(id)).toBeNull();
    expect(box.children).toHaveLength(4);
    fireEvent.click(within(box).getByRole('button', { name: en.example.setPlace }));
    expect(onSetPlace).toHaveBeenCalledTimes(1);
  });

  it('FR-OPEN-4: in Spanish, and before the city is known the same shape with no words but the action’s', () => {
    at(pass.start.t - 12 * 60_000);
    const first = render(<I18nProvider locale="es">{band(true)}</I18nProvider>);
    expect(screen.getByTestId('example-label')).toHaveTextContent('Ejemplo: Buenos Aires, según tu zona horaria');
    expect(screen.getByTestId('example-finding')).toHaveTextContent('Buscando los pases de esta noche sobre Buenos Aires…');
    expect(screen.getByRole('button', { name: es.example.setPlace })).toBeInTheDocument();
    first.unmount();
    render(band(false, null));
    const box = screen.getByTestId('example-band');
    expect(box).toHaveAttribute('data-state', 'pending');
    expect(within(box).queryByTestId('example-finding')).toBeNull();
    expect(box.children).toHaveLength(4);
    expect(within(box).getByRole('button', { name: en.example.setPlace })).toBeEnabled();
  });

  it('FR-OPEN-13: every height and brightness in the band is a phrase — no degree, no magnitude', () => {
    const high: Pass = { ...pass, durationS: 340, peakMagnitude: -3.4, peak: { ...pass.peak, elDeg: 80 }, start: { ...pass.start, azDeg: 315 }, end: { ...pass.end, azDeg: 135 } };
    at(pass.start.t - 12 * 60_000, [high]);
    const first = render(band());
    const box = screen.getByTestId('example-band');
    expect(within(box).getByTestId('next-event-path')).toHaveTextContent('NW low → almost overhead → SE · 6 min');
    expect(within(box).getByTestId('next-event-brightness')).toHaveTextContent(/^Brighter than any star$/);
    expect(box.textContent).not.toMatch(/°|mag|−3|-3/);
    first.unmount();
    render(<I18nProvider locale="es">{band()}</I18nProvider>);
    expect(screen.getByTestId('next-event-path')).toHaveTextContent('NW bajo → casi en el cenit → SE · 6 min');
    expect(screen.getByTestId('example-band').textContent).not.toMatch(/°|mag/);
  });

  it.each([
    ['in the day band', pass.start.t - 8 * HOUR, true],
    ['in bright twilight', pass.start.t - 2.5 * HOUR, false],
    ['in the dark band', pass.start.t - 12 * 60_000, false],
  ] as const)('FR-OPEN-14: %s the line after the card is %s', (_name, now, day) => {
    at(now);
    render(band());
    const box = screen.getByTestId('example-band');
    expect(isDay(BANDS, now)).toBe(day);
    if (!day) {
      expect(within(box).queryByTestId('example-after-dusk')).toBeNull();
      return;
    }
    const line = within(box).getByTestId('example-after-dusk');
    expect(line).toHaveTextContent('Satellites are only visible after dusk.');
    expect(within(box).getByTestId('next-event').nextElementSibling).toBe(line);
  });

  it('FR-OPEN-14: the day line in Spanish', () => {
    at(pass.start.t - 8 * HOUR);
    render(<I18nProvider locale="es">{band()}</I18nProvider>);
    expect(screen.getByTestId('example-after-dusk')).toHaveTextContent('Los satélites solo se ven después del anochecer.');
  });
});

describe('FR-OPEN-12: what a pass looks like, on the example’s card and block', () => {
  const block = (durationS: number, props: Partial<Parameters<typeof NextEventBlock>[0]> = {}) => (
    <NextEventBlock passes={[{ ...pass, durationS }]} timeZone={null} now={pass.start.t - 60_000} hours={72} {...props} />
  );

  it.each([
    ['5 min 40 s', 340, 6],
    ['40 s', 40, 1],
  ] as const)('a %s pass crosses in about %s… min, the card’s and the block’s last line', (_name, durationS, _minutes) => {
    const minutes = durationS === 340 ? 6 : 1;
    const first = render(block(durationS, { form: 'card', plain: true }));
    const card = screen.getByTestId('next-event');
    expect(within(card).getByTestId('example-looks')).toHaveTextContent(`A steady moving dot, no blinking, crosses in about ${String(minutes)} min.`);
    expect(card.lastElementChild).toBe(within(card).getByTestId('example-looks'));
    first.unmount();
    render(<I18nProvider locale="es">{block(durationS, { plain: true, liveLink: false })}</I18nProvider>);
    const wide = screen.getByTestId('next-event');
    expect(wide.lastElementChild).toHaveTextContent(`Un punto que se mueve parejo, sin parpadear, cruza en unos ${String(minutes)} min.`);
    expect(wide.textContent).not.toMatch(/°|mag/);
  });

  it('is not drawn for a set place, whose card and block keep their figures (FR-OPEN-13)', () => {
    const first = render(block(340, { form: 'card' }));
    expect(screen.queryByTestId('example-looks')).toBeNull();
    expect(screen.getByTestId('next-event-path')).toHaveTextContent(/\d+° NE/);
    expect(screen.getByTestId('next-event-brightness')).toHaveTextContent(/\(\+?[−-]?\d/);
    first.unmount();
    render(block(340));
    expect(screen.queryByTestId('example-looks')).toBeNull();
    expect(screen.getByTestId('next-event-path')).toHaveTextContent(/\d+° NE/);
  });
});
