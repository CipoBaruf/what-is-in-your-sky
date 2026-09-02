/**
 * TASKS R8 component tests: the three states plus unknown; the tooltip
 * states the 30 / 70 % thresholds, the forecast timestamp (in the display
 * zone) and the provider, and is the badge's accessible description.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import type { CloudVerdict } from '../../../model';
import { badgeText, CloudBadge, tooltipText } from './CloudBadge';

const T = 1_789_120_094_063; // 2026-09-11T09:48:14Z
const FETCHED = Date.parse('2026-09-11T02:05:10Z');
const forecast = { provider: 'open-meteo', fetchedAt: FETCHED };
const verdict = (state: CloudVerdict['state'], effectivePct: number | null): CloudVerdict => ({ state, effectivePct, at: T });

describe('badgeText', () => {
  it('names the state and rounds the effective cloud', () => {
    expect(badgeText(verdict('clear', 12.4))).toBe('Clear, 12 % cloud');
    expect(badgeText(verdict('partly', 45))).toBe('Partly cloudy, 45 % cloud');
    expect(badgeText(verdict('obscured', 88.6))).toBe('Likely obscured, 89 % cloud');
    expect(badgeText(verdict('unknown', null))).toBe('Weather unknown');
  });
});

describe('<CloudBadge>', () => {
  it.each([
    ['clear', 12, 'Clear, 12 % cloud'],
    ['partly', 45, 'Partly cloudy, 45 % cloud'],
    ['obscured', 89, 'Likely obscured, 89 % cloud'],
  ] as const)('renders the %s state with its data-state', (state, pct, text) => {
    render(<CloudBadge verdict={verdict(state, pct)} forecast={forecast} timeZone={null} moment="at the pass peak" />);
    const badge = screen.getByText(text);
    expect(badge).toHaveAttribute('data-state', state);
  });

  it('renders unknown without a percentage and says no forecast is available', () => {
    render(<CloudBadge verdict={verdict('unknown', null)} forecast={null} timeZone={null} moment="at the pass peak" />);
    const badge = screen.getByText('Weather unknown');
    expect(badge).toHaveAttribute('data-state', 'unknown');
    expect(badge).toHaveAccessibleDescription(/No cloud forecast at the pass peak\. Clear below 30 %, partly cloudy 30–70 %, likely obscured above 70 %.*No forecast is available\./);
  });

  it('the tooltip states the thresholds, the effective cloud, the provider and the fetch time in the display zone (US-7 AC2/AC3)', async () => {
    const { container } = render(<CloudBadge verdict={verdict('partly', 45)} forecast={forecast} timeZone="America/Argentina/Salta" moment="at the pass peak" />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('45 % effective cloud at the pass peak.');
    expect(tip).toHaveTextContent('30');
    expect(tip).toHaveTextContent('70');
    expect(tip).toHaveTextContent('Forecast by Open-Meteo, fetched 2026-09-10 23:05:10 GMT-3.');
    expect(screen.getByText('Partly cloudy, 45 % cloud')).toHaveAccessibleDescription(tip.textContent ?? '');
    expect(tooltipText(verdict('partly', 45), forecast, null, 'right now')).toContain('fetched 2026-09-11 02:05:10 UTC');
    expect(await axe(container)).toHaveNoViolations();
  });
});
