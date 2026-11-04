/**
 * FR-SDD-20: the PR body's fixed shape within `PR_BODY_MAX_KB`, and
 * FR-SDD-1's usage line, one per session of the task.
 */
import { describe, expect, it } from 'vitest';
import { ledgerEntry, type LedgerEntry } from '../../scripts/sdd/ledger';
import { checksRun, closedIds, prBody, PR_BODY_MAX_KB, tokens, usageLine, whatChanged } from '../../scripts/sdd/report';

const session = (kind: LedgerEntry['kind'], outcome = 'ok'): LedgerEntry =>
  ledgerEntry({
    task: 'R172',
    kind,
    agent: 'claude',
    tier: null,
    model: 'opus',
    usage: { inputTokens: 207, cachedInputTokens: 17_034_680, cacheCreationTokens: 212_942, outputTokens: 56_684, turns: 144 },
    wallMs: 1_396_733,
    outcome,
  });

/** Five sessions: an implementation cut by the limit, its resume, a review, a fix and a second review. */
const FIVE = [session('implement', 'limit'), session('implement'), session('review'), session('fix'), session('review')];

/** A long summary of the kind sessions write, with more than three lines of change. */
const SUMMARY = `# R172 summary

## What changed

- \`scripts/sdd/ledger.ts\` reads stream-json's final result event and appends one line per session to \`sdd-run/usage.jsonl\` with every FR-SDD-1 field, so the phase report has something to read.
- \`scripts/sdd/session.ts\` appends after each session, implementation and review alike, and records null tokens for a session killed at the wall clock.
- \`scripts/sdd/report.ts\` writes the PR body in FR-SDD-20's shape: what changed, ids closed, checks, the capture diff summary and the usage lines.
- A fourth line that the body must drop.

## Requirements

FR-SDD-1, FR-SDD-20; closes F-102.

## Checks

\`npm test\` green, \`npm run typecheck\` green, \`npm run lint\` green, \`npx vitest run tests/sdd/\` while iterating, and \`npm test\` again.
`;

const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

describe('usageLine', () => {
  it('names the session and carries its tokens, turns, wall time and outcome', () => {
    expect(usageLine(session('implement'))).toBe('- R172 implement · claude opus · in 207 · cached 17.0M · out 56.7k · 144 turns · 23 min · ok');
  });

  it('shows the tier when there is one and a question mark for a count the session never reported', () => {
    const entry = { ...session('review', 'timeout'), tier: 'light', inputTokens: null, cachedInputTokens: null, outputTokens: null, turns: null };
    expect(usageLine(entry)).toBe('- R172 review · claude light opus · in ? · cached ? · out ? · ? turns · 23 min · timeout');
  });

  it('formats token counts compactly', () => {
    expect([tokens(0), tokens(999), tokens(1_500), tokens(2_340_000)]).toEqual(['0', '999', '1.5k', '2.3M']);
  });
});

describe('the summary readers', () => {
  it('takes at most three lines of what changed, under its heading, list markers dropped', () => {
    const lines = whatChanged(SUMMARY);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^`scripts\/sdd\/ledger\.ts` reads/);
    expect(whatChanged('Gate: auto\n\nOne line.\n- Two.\n')).toEqual(['One line.', 'Two.']);
    expect(whatChanged(null)).toEqual([]);
  });

  it('closes the task, its findings and the ids the summary names, once each', () => {
    expect(closedIds('R172', ['F-99'], SUMMARY)).toEqual(['R172', 'F-99', 'FR-SDD-1', 'FR-SDD-20', 'F-102']);
  });

  it('lists the checks the summary quotes, once each', () => {
    expect(checksRun(SUMMARY)).toEqual(['npm test', 'npm run typecheck', 'npm run lint', 'npx vitest run tests/sdd/']);
    expect(checksRun('ran `git status`')).toEqual([]);
  });
});

describe('prBody', () => {
  const body = prBody({ gate: 'auto', changed: whatChanged(SUMMARY), closes: closedIds('R172', [], SUMMARY), checks: checksRun(SUMMARY), captureDiff: null, usage: FIVE });

  it('has the fixed sections in order, the gate first and the usage last', () => {
    const lines = body.split('\n');
    expect(lines[0]).toBe('Gate: auto');
    const order = ['**What changed**', '**Closes:**', '**Checks:**', '**Captures:**', '**Usage**'].map((heading) => lines.findIndex((line) => line.startsWith(heading)));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(body).toContain('**Closes:** R172, FR-SDD-1, FR-SDD-20, F-102');
    expect(body).toContain('**Captures:** —');
  });

  it('carries at most three lines of what changed and one usage line per session', () => {
    const lines = body.split('\n');
    const changedAt = lines.indexOf('**What changed**');
    const changed = lines.slice(changedAt + 1, lines.indexOf('', changedAt));
    expect(changed.length).toBeLessThanOrEqual(3);
    expect(body).not.toContain('A fourth line');
    const usage = lines.slice(lines.indexOf('**Usage**') + 1).filter(Boolean);
    expect(usage).toEqual(FIVE.map(usageLine));
  });

  it('is at most PR_BODY_MAX_KB with five sessions', () => {
    expect(PR_BODY_MAX_KB).toBe(1.5);
    expect(bytes(body)).toBeLessThanOrEqual(1.5 * 1024);
  });

  it('stays within the ceiling when every input is far too long, keeping every usage line whole', () => {
    const huge = prBody({
      gate: 'owner',
      changed: ['é'.repeat(2000), 'b'.repeat(2000), 'c'.repeat(2000), 'd'.repeat(2000)],
      closes: Array.from({ length: 200 }, (_, index) => `FR-SDD-${String(index)}`),
      checks: Array.from({ length: 50 }, (_, index) => `npx vitest run tests/${String(index)}.test.ts`),
      captureDiff: '12 file(s) under `docs/screenshots/`',
      usage: FIVE,
    });
    expect(bytes(huge)).toBeLessThanOrEqual(1.5 * 1024);
    for (const entry of FIVE) expect(huge).toContain(usageLine(entry));
    expect(huge).toContain('**Captures:** 12 file(s)');
  });

  it('says so when the session left no summary and no session was recorded', () => {
    const empty = prBody({ gate: 'auto', changed: [], closes: ['R9'], checks: [], captureDiff: null, usage: [] });
    expect(empty).toContain('- _The session left no summary._');
    expect(empty).toContain('**Checks:** —');
    expect(empty).toContain('- no session recorded');
  });
});
