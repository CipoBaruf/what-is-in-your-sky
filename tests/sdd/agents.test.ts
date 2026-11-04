/**
 * FR-SDD-10, FR-SDD-11 (D-1064): `sdd.agents.json` against its schema, the
 * `claude` entry's command line against the one the driver built before
 * R177, both result parsers, and the limit pattern on the recorded messages.
 */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArgv, limitFromText, loadAgents, modelTiers, nextTier, parseAgents, pickAgent, resetFromText, toolLists, TIERS } from '../../scripts/sdd/agents';
import { PARSERS, StreamTokens } from '../../scripts/sdd/parsers';

const raw = JSON.parse(readFileSync('sdd.agents.json', 'utf8')) as { default: string; agents: Record<string, Record<string, unknown>> };
const config = loadAgents();
const agent = pickAgent(config);

/** The allowlist `session.ts` held before R177, verbatim. */
const IMPLEMENT_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Skill', 'Bash(npm run:*)', 'Bash(npm test:*)', 'Bash(npm ci:*)', 'Bash(npx vitest:*)', 'Bash(npx playwright:*)', 'Bash(npx tsc:*)', 'Bash(npx eslint:*)', 'Bash(npx tsx:*)', 'Bash(node:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(wc:*)', 'Bash(sed:*)', 'Bash(awk:*)', 'Bash(find:*)', 'Bash(echo:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', 'Bash(mv:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'];
const REVIEW_TOOLS = ['Read', 'Write', 'Glob', 'Grep', 'Skill', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git status:*)'];
const DENIED_TOOLS = ['Bash(git push:*)', 'Bash(git add -A:*)', 'Bash(git add .:*)', 'Bash(gh:*)', 'Bash(rm:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(prettier:*)', 'Bash(npx prettier:*)', 'WebFetch', 'WebSearch', 'Task'];

/** The argv `runSession` built before R177. */
const today = (prompt: string, model: string, maxTurns: number, allowed: readonly string[]): string[] => [
  '-p',
  prompt,
  '--model',
  model,
  '--permission-mode',
  'acceptEdits',
  '--max-turns',
  String(maxTurns),
  '--output-format',
  'stream-json',
  '--verbose',
  '--allowedTools',
  allowed.join(','),
  '--disallowedTools',
  DENIED_TOOLS.join(','),
];

describe('FR-SDD-10: the schema', () => {
  it('accepts the checked-in file, whose default is the claude entry', () => {
    expect(config.default).toBe('claude');
    expect(agent.name).toBe('claude');
    expect(agent.parser).toBe('stream-json');
    expect(agent.tools.policy).toBe('claude-allowlist');
    // FR-SDD-2 (R181, D-1093): light and standard carry 2 × the phase's p90; hard had one session and stays unset.
    expect(TIERS.map((tier) => agent.tiers[tier].tokenCeiling)).toEqual([undefined, 32_716_582, undefined]);
  });

  const broken = (change: (entry: Record<string, unknown>) => void, top: Record<string, unknown> = {}): unknown => {
    const copy = structuredClone(raw);
    const entry = copy.agents['claude'];
    if (!entry) throw new Error('no claude entry');
    change(entry);
    return { ...copy, ...top };
  };

  it('rejects a broken one, naming the field', () => {
    expect(() => parseAgents(broken(() => undefined, { default: 'other' }))).toThrow(/default agent has no entry/);
    expect(() => parseAgents(broken((entry) => (entry['command'] = ['claude', '-p'])))).toThrow(/agents\.claude\.command.*\{prompt\}/);
    expect(() => parseAgents(broken((entry) => (entry['fallback'] = ['hard', 'huge'])))).toThrow(/agents\.claude\.fallback\.1/);
    expect(() => parseAgents(broken((entry) => (entry['parser'] = 'xml')))).toThrow(/agents\.claude\.parser/);
    expect(() => parseAgents(broken((entry) => (entry['limit'] = { pattern: '(unclosed' })))).toThrow(/not a valid regular expression/);
    expect(() => parseAgents(broken((entry) => (entry['tools'] = { policy: 'everything' })))).toThrow(/agents\.claude\.tools/);
    expect(() => parseAgents(broken((entry) => (entry['tiers'] = { hard: { model: 'x' }, standard: { model: 'y' } })))).toThrow(/agents\.claude\.tiers\.light/);
    expect(() => parseAgents(broken((entry) => (entry['colour'] = 'blue')))).toThrow(/colour/);
  });

  it('accepts a second agent with the exit-code parser and no tool policy, and picks it by name', () => {
    const second = { command: ['other', '--run', '{prompt}'], tiers: { hard: { model: 'a' }, standard: { model: 'b' }, light: { model: 'c', tokenCeiling: 5000 } }, fallback: ['hard', 'light'], limit: { pattern: 'quota' }, parser: 'exit-code', tools: { policy: 'none' } };
    const both = parseAgents({ ...raw, agents: { ...raw.agents, other: second } });
    expect(pickAgent(both, null, 'other').name).toBe('other');
    expect(pickAgent(both, 'claude', 'other').name).toBe('claude');
    expect(() => pickAgent(both, 'missing')).toThrow(/no agent `missing`/);
    const other = pickAgent(both, 'other');
    expect(buildArgv(other, { prompt: 'go', model: 'c', maxTurns: 9, kind: 'implement' })).toEqual({ file: 'other', args: ['--run', 'go'] });
    expect(nextTier(other, 'hard')).toBe('light');
    expect(nextTier(other, 'standard')).toBeNull();
  });
});

describe("FR-SDD-10: the claude entry's command line equals today's", () => {
  it('for each tier, the implementation and the review', () => {
    const models = { hard: 'fable', standard: 'opus', light: 'sonnet' } as const;
    for (const tier of TIERS) {
      const model = agent.tiers[tier].model;
      expect(model).toBe(models[tier]);
      expect(buildArgv(agent, { prompt: 'Use the skill.', model, maxTurns: 250, kind: 'implement' })).toEqual({ file: 'claude', args: today('Use the skill.', model, 250, IMPLEMENT_TOOLS) });
      expect(buildArgv(agent, { prompt: 'Review.', model, maxTurns: 40, kind: 'review' })).toEqual({ file: 'claude', args: today('Review.', model, 40, REVIEW_TOOLS) });
      expect(buildArgv(agent, { prompt: 'Fix.', model, maxTurns: 250, kind: 'fix' }).args).toEqual(today('Fix.', model, 250, IMPLEMENT_TOOLS));
    }
    expect(toolLists(agent, 'implement')).toEqual({ allowed: IMPLEMENT_TOOLS, denied: DENIED_TOOLS });
  });

  it('substitutes once, so a prompt that quotes a placeholder keeps it', () => {
    expect(buildArgv(agent, { prompt: 'write {model} and {maxTurns}', model: 'opus', maxTurns: 1, kind: 'review' }).args[1]).toBe('write {model} and {maxTurns}');
  });
});

describe('FR-SDD-11: tiers', () => {
  it('maps each model the entry knows to its tier, haiku through the aliases', () => {
    expect(modelTiers(agent)).toEqual({ fable: 'hard', opus: 'standard', sonnet: 'light', haiku: 'light' });
  });

  it('falls back hard → standard → light and stops there, as fable → opus → sonnet did', () => {
    expect(nextTier(agent, 'hard')).toBe('standard');
    expect(nextTier(agent, 'standard')).toBe('light');
    expect(nextTier(agent, 'light')).toBeNull();
  });
});

describe("FR-SDD-11, D-835: the claude entry's limit pattern", () => {
  const now = new Date(2026, 10, 4, 15, 0).getTime();

  it('matches the recorded limit message and reads its reset time', () => {
    const limit = limitFromText(agent.limit, "You've hit your session limit · resets 7:10pm (America/Argentina/Salta)", now);
    expect(limit).toEqual({ window: null, resetsAt: new Date(2026, 10, 4, 19, 10).getTime(), accountWide: true });
    expect(new RegExp(agent.limit.pattern, 'i').exec("You've hit your session limit · resets 7:10pm (America/Argentina/Salta)")?.[1]).toBe('7:10pm (America/Argentina/Salta)');
  });

  it('recognises every recorded wording, and the API rate-limit error', () => {
    for (const text of [
      "You've hit your weekly limit · resets Tue 9am",
      "You've hit your limit · resets 3pm (Europe/Madrid)",
      'Claude AI usage limit reached|1757100000',
      'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"..."}}',
      "You're out of extra usage",
    ])
      expect(limitFromText(agent.limit, text, now)).toMatchObject({ accountWide: true });
  });

  it("reads one model's own limit as not account-wide (R175, 2026-11-04)", () => {
    expect(limitFromText(agent.limit, "You've reached your Fable limit. Switch to another model, or manage usage credits at https://claude.ai/settings/usage?from=cc_cli_limit_message, to continue.", now)).toEqual({ window: null, resetsAt: null, accountWide: false });
  });

  it('leaves an ordinary result alone', () => {
    for (const text of ['Done: R41 checked off, summary written.', 'The limit of the fit rule is 80 % of the width.', 'The rate limit on the geocoder is one request a second.', null, undefined, '']) expect(limitFromText(agent.limit, text, now)).toBeNull();
  });

  it('reads a reset time as the next such time, a weekday as the next such day', () => {
    expect(resetFromText('3pm', now)).toBe(new Date(2026, 10, 5, 15, 0).getTime());
    expect(resetFromText('12am', now)).toBe(new Date(2026, 10, 5, 0, 0).getTime());
    expect(resetFromText('Tue 9am', now)).toBe(new Date(2026, 10, 10, 9, 0).getTime());
    expect(resetFromText('soon', now)).toBeNull();
    expect(resetFromText('25:00', now)).toBeNull();
  });

  it('does not read a weekday out of a time-zone name', () => {
    const next = new Date(2026, 10, 4, 19, 10).getTime();
    for (const zone of ['America/Montevideo', 'Europe/Monaco', 'America/Thunder_Bay', 'Africa/Sunday_Island', 'Asia/Saturn'])
      expect(resetFromText(`7:10pm (${zone})`, now), zone).toBe(next);
    expect(resetFromText('Tue 9am (America/Montevideo)', now)).toBe(new Date(2026, 10, 10, 9, 0).getTime());
    expect(resetFromText('Tuesday 9am', now)).toBe(new Date(2026, 10, 10, 9, 0).getTime());
    expect(resetFromText('Mon 9am', now)).toBe(new Date(2026, 10, 9, 9, 0).getTime());
    expect(resetFromText('9am monitor', now)).toBe(new Date(2026, 10, 5, 9, 0).getTime());
  });
});

describe('D-1064: the result parsers', () => {
  const context = { limit: agent.limit, stderr: '' };
  const result = (fields: Record<string, unknown>): string => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, num_turns: 3, result: 'done', usage: { input_tokens: 1, output_tokens: 2 }, ...fields });
  const stream = PARSERS['stream-json'];

  it('stream-json: success, its usage, max turns, an error and a non-zero exit', () => {
    expect(stream(`not json\n${result({})}\n`, 0, null, context)).toEqual({ ok: true, outcome: 'ok', text: 'done', usage: { inputTokens: 1, cachedInputTokens: 0, cacheCreationTokens: 0, outputTokens: 2, turns: 3 }, limit: null });
    expect(stream(result({ subtype: 'error_max_turns' }), 0, null, context).outcome).toBe('max-turns');
    expect(stream(result({ is_error: true, result: 'boom' }), 0, null, context)).toMatchObject({ ok: false, outcome: 'error', text: 'boom' });
    expect(stream(result({}), 1, null, context).outcome).toBe('error');
    expect(stream('', 0, null, context).outcome).toBe('ok');
  });

  it('stream-json: a limit by its event, by its sentence and on stderr', () => {
    const event = JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1788646200, rateLimitType: 'five_hour' } });
    expect(stream(`${event}\n${result({ result: "You've hit your limit" })}`, 1, null, context)).toMatchObject({ outcome: 'limit', limit: { window: 'five_hour', resetsAt: 1788646200_000, accountWide: true } });
    expect(stream(result({ result: "You've reached your Fable limit. Switch to another model." }), 0, null, context)).toMatchObject({ outcome: 'limit', limit: { accountWide: false } });
    expect(stream('', 1, null, { ...context, stderr: 'Error: usage limit reached' }).outcome).toBe('limit');
  });

  it('exit-code: exit 0 and the handoff file, else an error; a limit from the output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-parser-'));
    const handoff = join(dir, 'R9.summary.md');
    const parse = PARSERS['exit-code'];
    expect(parse('working…', 0, handoff, context)).toMatchObject({ ok: false, outcome: 'error' });
    writeFileSync(handoff, 'done');
    expect(parse('working…\nall done\n', 0, handoff, context)).toEqual({ ok: true, outcome: 'ok', text: 'working…\nall done', usage: null, limit: null });
    expect(parse('', 2, handoff, context).outcome).toBe('error');
    expect(parse("You've hit your session limit · resets 7:10pm", 1, handoff, context)).toMatchObject({ outcome: 'limit', limit: { accountWide: true } });
  });

  it('exit-code: a 0 exit with its handoff is success whatever the output says about limits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-parser-'));
    const handoff = join(dir, 'R9.summary.md');
    writeFileSync(handoff, 'done');
    const parse = PARSERS['exit-code'];
    expect(parse('limit reached? no: D-835 wait and rerun on a usage limit', 0, handoff, context)).toMatchObject({ ok: true, outcome: 'ok', limit: null });
    expect(parse('usage limit', 0, null, context).outcome).toBe('ok');
    expect(parse('usage limit', 0, join(dir, 'absent.md'), context).outcome).toBe('limit');
  });

  it("R175, 2026-11-04: Fable's own weekly limit, with every model at 76 %, is not account-wide, so the fallback chain applies", () => {
    // The event and the sentence as the CLI wrote them; `seven_day` was `allowed_warning`, only the model's window `rejected`.
    const event = '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":1794103200,"rateLimitType":"seven_day_overage_included","unifiedWindows":{"five_hour":{"utilization":0.36,"status":"allowed"},"seven_day":{"utilization":0.76,"status":"allowed_warning"},"seven_day_overage_included":{"utilization":1,"status":"rejected"}}}}';
    const sentence = result({ is_error: true, result: "You've reached your Fable limit. Switch to another model, or manage usage credits to continue." });
    for (const stdout of [`${event}\n${sentence}`, sentence]) {
      const parsed = stream(stdout, 1, null, context);
      expect(parsed).toMatchObject({ outcome: 'limit', limit: { accountWide: false } });
      // runStage retries on the next tier exactly when outcome is `limit` and accountWide is false.
      expect(nextTier(agent, 'hard')).toBe('standard');
    }
  });

  it('FR-SDD-2: counts an assistant message once however many events carry it', () => {
    const tokens = new StreamTokens();
    const line = (id: string, output: number): string => JSON.stringify({ type: 'assistant', message: { id, usage: { input_tokens: 10, output_tokens: output } } });
    expect(tokens.add(line('a', 5))).toBe(15);
    expect(tokens.add(line('a', 7))).toBe(17);
    expect(tokens.add(line('b', 0))).toBe(27);
    expect(tokens.add('{"type":"user"}')).toBe(27);
  });
});

describe('FR-SDD-10: scripts/sdd names no agent and no model', () => {
  it('outside the comments of agents.ts', () => {
    const files = [...readdirSync('scripts/sdd').filter((name) => name.endsWith('.ts')).map((name) => join('scripts/sdd', name)), 'scripts/sdd-run.ts'];
    const named = /claude|fable|opus|sonnet|haiku/i;
    const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hits = files.filter((file) => named.test(file.endsWith('/agents.ts') ? code(readFileSync(file, 'utf8')) : readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });
});
