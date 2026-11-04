/**
 * FR-SDD-1 (D-1058): a recorded `stream-json` result event becomes one ledger
 * line carrying every field the requirement names.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendLedger, budgetOverrun, entryTokens, ledgerEntry, MIN_BUDGET_SAMPLES, percentile90, readLedger, usageFromResult } from '../../scripts/sdd/ledger';

/**
 * R171's implementation session, `logs/sdd/R171-2026-11-03T18-34-35-089Z.log`
 * line 668, with `result`, `permission_denials`, `modelUsage`, the usage's
 * `iterations` and the subagent statistics trimmed; every other field verbatim.
 */
const RESULT_EVENT = JSON.parse(
  '{"type":"result","subtype":"success","is_error":false,"duration_ms":1396733,"duration_api_ms":627642,"num_turns":144,"result":"…","stop_reason":"end_turn","session_id":"14f6a971-a1e5-424c-83f3-bc239aaed2ae","total_cost_usd":6.244980000000002,"usage":{"input_tokens":207,"cache_creation_input_tokens":212942,"cache_read_input_tokens":17034680,"output_tokens":56684,"output_tokens_details":{"thinking_tokens":14102},"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":212942,"ephemeral_5m_input_tokens":0},"inference_geo":"global","speed":"standard","fallback_credit":null},"terminal_reason":"completed","api_error_status":null,"uuid":"e1ce4ec6-eeda-42d6-ae0c-09a457f207ce"}',
) as Parameters<typeof usageFromResult>[0];

const FR_SDD_1_FIELDS = ['task', 'kind', 'agent', 'tier', 'model', 'inputTokens', 'cachedInputTokens', 'outputTokens', 'turns', 'wallMs', 'outcome'];

const scratch = (): string => join(mkdtempSync(join(tmpdir(), 'sdd-ledger-')), 'sdd-run', 'usage.jsonl');

describe('usageFromResult', () => {
  it('reads the tokens and the turns from the result event', () => {
    expect(usageFromResult(RESULT_EVENT)).toEqual({ inputTokens: 207, cachedInputTokens: 17034680, cacheCreationTokens: 212942, outputTokens: 56684, turns: 144 });
  });

  it('ignores every other event, and reads a result with no usage as zeros', () => {
    expect(usageFromResult({ type: 'assistant' })).toBeNull();
    expect(usageFromResult({ type: 'rate_limit_event' })).toBeNull();
    expect(usageFromResult({ type: 'result' })).toEqual({ inputTokens: 0, cachedInputTokens: 0, cacheCreationTokens: 0, outputTokens: 0, turns: 0 });
  });
});

describe('the ledger', () => {
  it('turns the recorded result event into one line with every FR-SDD-1 field', () => {
    const path = scratch();
    const entry = ledgerEntry({ task: 'R171', kind: 'implement', agent: 'claude', tier: null, model: 'opus', usage: usageFromResult(RESULT_EVENT), wallMs: 1_401_220.4, outcome: 'ok' }, new Date('2026-11-03T18:58:00Z'));
    appendLedger(entry, path);

    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
    for (const field of FR_SDD_1_FIELDS) expect(line).toHaveProperty(field);
    expect(line).toEqual({
      at: '2026-11-03T18:58:00.000Z',
      task: 'R171',
      kind: 'implement',
      agent: 'claude',
      tier: null,
      model: 'opus',
      inputTokens: 207,
      cachedInputTokens: 17034680,
      cacheCreationTokens: 212942,
      outputTokens: 56684,
      turns: 144,
      wallMs: 1_401_220,
      outcome: 'ok',
    });
  });

  it('records a session that left no result event with null tokens', () => {
    const entry = ledgerEntry({ task: 'R9', kind: 'review', agent: 'claude', tier: null, model: 'sonnet', usage: null, wallMs: 60_000, outcome: 'timeout' });
    expect(entry).toMatchObject({ inputTokens: null, cachedInputTokens: null, outputTokens: null, turns: null, wallMs: 60_000, outcome: 'timeout' });
  });

  it('reads the file back in order, filters by task, and skips a torn line', () => {
    const path = scratch();
    const record = { agent: 'claude', tier: null, model: 'opus', usage: usageFromResult(RESULT_EVENT), wallMs: 1000, outcome: 'ok' };
    appendLedger(ledgerEntry({ ...record, task: 'R1', kind: 'implement' }), path);
    appendLedger(ledgerEntry({ ...record, task: 'R2', kind: 'implement' }), path);
    appendLedger(ledgerEntry({ ...record, task: 'R1', kind: 'review' }), path);
    writeFileSync(path, `${readFileSync(path, 'utf8')}{"task":"R1","ki\n`);

    expect(readLedger(path).map((entry) => `${entry.task} ${entry.kind}`)).toEqual(['R1 implement', 'R2 implement', 'R1 review']);
    expect(readLedger(path, 'R1').map((entry) => entry.kind)).toEqual(['implement', 'review']);
    expect(readLedger(join(path, '..', 'missing.jsonl'))).toEqual([]);
  });

  it('keeps only the sessions that ended at or after `since`, one driver run', () => {
    const path = scratch();
    const record = { task: 'R1', kind: 'implement' as const, agent: 'claude', tier: null, model: 'opus', usage: null, wallMs: 1, outcome: 'ok' };
    appendLedger(ledgerEntry(record, new Date('2026-11-01T10:00:00Z')), path);
    appendLedger(ledgerEntry({ ...record, kind: 'review' }, new Date('2026-11-03T10:00:00Z')), path);
    expect(readLedger(path, 'R1', new Date('2026-11-03T09:00:00Z')).map((entry) => entry.kind)).toEqual(['review']);
  });
});

describe('FR-SDD-2: the budget, report-only while no ceiling is set', () => {
  const line = (tokens: number | null): ReturnType<typeof ledgerEntry> =>
    ledgerEntry({ task: 'R1', kind: 'implement', agent: 'a', tier: 'standard', model: 'm', usage: tokens === null ? null : { inputTokens: tokens, cachedInputTokens: 0, cacheCreationTokens: 0, outputTokens: 0, turns: 1 }, wallMs: 1, outcome: 'ok' });

  it('counts every token field, and nothing for a session that left no usage', () => {
    expect(entryTokens(ledgerEntry({ task: 'R1', kind: 'review', agent: 'a', tier: 'light', model: 'm', usage: usageFromResult(RESULT_EVENT), wallMs: 1, outcome: 'ok' }))).toBe(207 + 17034680 + 212942 + 56684);
    expect(entryTokens(line(null))).toBeNull();
  });

  it('takes the nearest-rank 90th percentile', () => {
    expect(percentile90([])).toBeNull();
    expect(percentile90([5])).toBe(5);
    expect(percentile90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(9);
    expect(percentile90([10, 1, 9, 2, 8, 3, 7, 4, 6, 5, 11])).toBe(10);
  });

  it('records an overrun past the running 90th percentile, and none below it or on thin history', () => {
    const history = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(line);
    expect(budgetOverrun(950, history)).toEqual({ tokens: 950, p90: 900, samples: 10 });
    expect(budgetOverrun(900, history)).toBeNull();
    expect(budgetOverrun(null, history)).toBeNull();
    expect(budgetOverrun(10_000, history.slice(0, MIN_BUDGET_SAMPLES - 1))).toBeNull();
    expect(budgetOverrun(10_000, [...history.slice(0, MIN_BUDGET_SAMPLES - 1), line(null)])).toBeNull();
  });
});
