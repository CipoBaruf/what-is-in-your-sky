/** R197 (FR-MEAS-6, D-1149): the funnel report on a fixture of stored rows, and the command's refusals. No test reaches the API. */
import { describe, expect, it } from 'vitest';
import { funnelQuery, funnelReport, main, parseRows, type Fetch, type FunnelRow } from '../../scripts/funnel';

const row = (name: string, detail: string, visit: string, layout: string, lang: string, count: number): FunnelRow => ({ name, detail, visit, layout, lang, count });

const ROWS: FunnelRow[] = [
  row('open', 'home', 'first', 'compact', 'en', 8),
  row('open', 'pass', 'first', 'wide', 'es', 2),
  row('open', 'home', 'return', 'compact', 'en', 5),
  row('where_shown', '', 'first', 'compact', 'en', 8),
  row('where_shown', '', 'first', 'wide', 'es', 2),
  row('place_set', 'search', 'first', 'compact', 'en', 3),
  row('place_set', 'device', 'first', 'compact', 'en', 1),
  row('place_set', 'link', 'first', 'wide', 'es', 1),
  row('when_shown', '', 'first', 'compact', 'en', 4),
  row('what_shown', '', 'first', 'compact', 'en', 3),
  row('door', 'satellites', 'first', 'compact', 'en', 2),
  row('pass_open', '', 'first', 'compact', 'en', 1),
  row('where_shown', '', 'return', 'compact', 'en', 5),
  row('device_refused', 'denied', 'first', 'compact', 'en', 1),
  row('failure', 'forecast', 'return', 'compact', 'en', 2),
  row('no_passes', '', 'first', 'wide', 'es', 1),
];

/** Runs of spaces to one, so a column's width is not what is tested. */
const squash = (text: string): string => text.replace(/ {2,}/g, ' ');

describe('FR-MEAS-6 funnelReport', () => {
  it('FR-MEAS-6: prints the expected table with shares of where_shown', () => {
    const report = squash(funnelReport(ROWS, { days: 14 }));
    expect(report).toContain('Funnel, last 14 days\n');
    expect(report).toContain(' visit first 10\n visit return 5\n');
    expect(report).toContain(' where_shown 10 100%\n');
    expect(report).toContain(' place_set 5 50%\n search 3 30%\n coords 0 0%\n');
    expect(report).toContain(' when_shown 4 40%\n what_shown 3 30%\n');
    expect(report).toContain(' door 2 20%\n satellites 2 20%\n');
    expect(report).toContain(' pass_open 1 10%\n');
    expect(report).toContain(' device_refused 1\n denied 1\n');
    expect(report).toContain(' failure 2\n elements 0\n forecast 2\n');
    expect(report).toContain(' no_passes 1\n');
  });

  it('FR-MEAS-6: --layout and --lang narrow every row', () => {
    const wide = squash(funnelReport(ROWS, { days: 14, layout: 'wide' }));
    expect(wide).toContain('Funnel, last 14 days (layout wide)');
    expect(wide).toContain(' where_shown 2 100%\n');
    expect(wide).toContain(' place_set 1 50%\n');
    expect(wide).toContain(' no_passes 1\n');
    expect(wide).toContain(' device_refused 0\n');
    const both = squash(funnelReport(ROWS, { days: 7, layout: 'compact', lang: 'en' }));
    expect(both).toContain('Funnel, last 7 days (layout compact, lang en)');
    expect(both).toContain(' where_shown 8 100%\n');
    expect(both).toContain(' no_passes 0\n');
    expect(funnelReport(ROWS, { days: 14, lang: 'es' })).toContain('(lang es)');
  });

  it('FR-MEAS-6: an empty store prints zeros and no division error', () => {
    const report = squash(funnelReport([], { days: 14 }));
    expect(report).toContain(' where_shown 0 -\n');
    expect(report).toContain(' visit first 0\n');
    expect(report).not.toMatch(/NaN|Infinity/);
  });
});

describe('FR-MEAS-6 the command', () => {
  const io = () => {
    const state = { out: '', err: '' };
    return {
      state,
      io: {
        out: (t: string) => {
          state.out += t;
        },
        err: (t: string) => {
          state.err += t;
        },
      },
    };
  };
  const never: Fetch = () => Promise.reject(new Error('the API must not be called'));

  it('FR-MEAS-6: a missing credential exits non-zero naming the variable', async () => {
    const a = io();
    expect(await main([], { CF_API_TOKEN: 't' }, never, a.io)).not.toBe(0);
    expect(a.state.err).toContain('CF_ACCOUNT_ID');
    const b = io();
    expect(await main([], { CF_ACCOUNT_ID: 'a' }, never, b.io)).not.toBe(0);
    expect(b.state.err).toContain('CF_API_TOKEN');
  });

  it('posts the query with the bearer token and prints the report', async () => {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const fetchFn: Fetch = (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [{ blob1: 'where_shown', blob2: '', blob3: 'first', blob4: 'wide', blob5: 'en', n: '4' }] }) });
    };
    const a = io();
    expect(await main(['--days', '3'], { CF_ACCOUNT_ID: 'acc', CF_API_TOKEN: 'tok' }, fetchFn, a.io)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/analytics_engine/sql');
    expect(calls[0]?.headers['Authorization']).toBe('Bearer tok');
    expect(calls[0]?.body).toBe(funnelQuery(3));
    expect(a.state.out).toContain('Funnel, last 3 days');
    expect(squash(a.state.out)).toContain(' where_shown 4 100%\n');
  });

  it('FUNNEL_DAYS sets the default, a bad flag exits 2, an API error exits 1', async () => {
    const env = { CF_ACCOUNT_ID: 'a', CF_API_TOKEN: 't', FUNNEL_DAYS: '30' };
    const ok: Fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
    const a = io();
    expect(await main([], env, ok, a.io)).toBe(0);
    expect(a.state.out).toContain('last 30 days');
    expect(await main(['--days', 'x'], env, never, io().io)).toBe(2);
    expect(await main(['--layout', 'tall'], env, never, io().io)).toBe(2);
    const bad: Fetch = () => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) });
    const b = io();
    expect(await main([], env, bad, b.io)).toBe(1);
    expect(b.state.err).toContain('403');
  });

  it('parseRows reads the grouped rows and refuses an answer without data', () => {
    expect(parseRows({ data: [{ blob1: 'open', blob2: 'home', blob3: 'first', blob4: 'wide', blob5: 'es', n: 7 }] })).toEqual([
      { name: 'open', detail: 'home', visit: 'first', layout: 'wide', lang: 'es', count: 7 },
    ]);
    expect(() => parseRows({})).toThrow('data');
  });
});
