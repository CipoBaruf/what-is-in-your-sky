/**
 * D-1064: a result parser turns what a finished session left — its stdout,
 * its exit code, its handoff file — into an outcome. `stream-json` is the
 * driver's original reading of the event stream; `exit-code` reads success
 * from exit 0 and the handoff, and knows nothing of tokens or turns.
 */
import { existsSync } from 'node:fs';
import { limitFromText, type LimitConfig, type LimitInfo } from './agents';
import { usageFromResult, type ResultUsage } from './ledger';

/** `limit` (D-197): the session ended on a usage limit; `budget` (FR-SDD-2): it passed its tier's token ceiling. */
export type SessionOutcome = 'ok' | 'error' | 'timeout' | 'max-turns' | 'limit' | 'budget';

interface ParsedResult {
  ok: boolean;
  outcome: SessionOutcome;
  /** The session's final message, where the agent leaves one. */
  text: string | null;
  usage: ResultUsage | null;
  limit: LimitInfo | null;
}

interface ParseContext {
  limit: LimitConfig;
  stderr: string;
}

export type ResultParser = (stdout: string, exitCode: number | null, handoffPath: string | null, context: ParseContext) => ParsedResult;

interface RateLimitEvent {
  type?: string;
  rate_limit_info?: { status?: string; resetsAt?: number; rateLimitType?: string; errorCode?: string };
}

/** D-1310: the `errorCode` of a model that needs usage credits the account lacks (the hard tier's model, 2026-11-21); another model runs. */
const MODEL_ONLY_CODES = ['credits_required'];

/**
 * §16.4 step 10: the limit a stream event announces, or `null` for any other
 * event. A window the entry lists as shared (`five_hour`, `seven_day`) stops
 * every model; any other, such as one model's own weekly window, does not.
 * An event with no window stops every model too, unless its `errorCode`
 * names one model's own refusal (`credits_required`, D-1310).
 */
export function limitFromEvent(event: RateLimitEvent, limit: Pick<LimitConfig, 'accountWindows'>): LimitInfo | null {
  if (event.type !== 'rate_limit_event' || event.rate_limit_info?.status !== 'rejected') return null;
  const info = event.rate_limit_info;
  const window = info.rateLimitType ?? null;
  const modelOnly = info.errorCode !== undefined && MODEL_ONLY_CODES.includes(info.errorCode);
  return { window, resetsAt: typeof info.resetsAt === 'number' ? info.resetsAt * 1000 : null, accountWide: !modelOnly && (window === null || limit.accountWindows.includes(window)) };
}

const done = (outcome: SessionOutcome, text: string | null, usage: ResultUsage | null, limit: LimitInfo | null): ParsedResult => ({ ok: outcome === 'ok', outcome, text, usage, limit: outcome === 'limit' ? limit : null });

const streamJson: ResultParser = (stdout, exitCode, _handoff, { limit: config, stderr }) => {
  let outcome: SessionOutcome = 'ok';
  let text: string | null = null;
  let usage: ResultUsage | null = null;
  let limit: LimitInfo | null = null;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    let event: { type?: string; subtype?: string; result?: string; is_error?: boolean } & RateLimitEvent & Parameters<typeof usageFromResult>[0];
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue; // not a JSON event line
    }
    const announced = limitFromEvent(event, config);
    if (announced) {
      limit = announced;
      outcome = 'limit';
      continue;
    }
    if (event.type !== 'result') continue;
    text = event.result ?? null;
    usage = usageFromResult(event);
    if (outcome === 'limit') {
      // The event already said so; the result is the synthetic sentence. A windowless event whose sentence says
      // "switch to another model" is that model's own limit (D-1310), so the fallback may run.
      if (limit?.window === null && limit.accountWide && limitFromText(config, text)?.accountWide === false) limit = { ...limit, accountWide: false };
      continue;
    }
    const said = limitFromText(config, text);
    if (event.subtype === 'error_max_turns') outcome = 'max-turns';
    else if (said) {
      outcome = 'limit';
      limit ??= said;
    } else if (event.is_error === true || (event.subtype && event.subtype !== 'success')) outcome = 'error';
  }
  const fromStderr = outcome === 'max-turns' || outcome === 'limit' ? null : limitFromText(config, stderr);
  if (fromStderr) return done('limit', text, usage, limit ?? fromStderr);
  if (exitCode !== 0 && outcome === 'ok') outcome = 'error';
  return done(outcome, text, usage, limit);
};

/** The last part of stdout an exit-code agent printed, as its final message. */
const TAIL_CHARS = 2000;

const exitCode: ResultParser = (stdout, code, handoffPath, { limit: config, stderr }) => {
  const text = stdout.trim().slice(-TAIL_CHARS) || null;
  // A clean exit with the handoff written is success, whatever the output says about limits.
  if (code === 0 && (handoffPath === null || existsSync(handoffPath))) return done('ok', text, null, null);
  const limit = limitFromText(config, text) ?? limitFromText(config, stderr);
  return limit ? done('limit', text, null, limit) : done('error', text, null, null);
};

export const PARSERS: Record<'stream-json' | 'exit-code', ResultParser> = { 'stream-json': streamJson, 'exit-code': exitCode };

/** Every token a session's usage counts: input, cached, cache writes and output. */
export const totalTokens = (usage: ResultUsage): number => usage.inputTokens + usage.cachedInputTokens + usage.cacheCreationTokens + usage.outputTokens;

/**
 * FR-SDD-2: the tokens a `stream-json` session has spent so far, from each
 * assistant message's usage (one message arrives as several events with the
 * same id, so the last per id counts). An `exit-code` agent reports none, so
 * a ceiling cannot stop it mid-run.
 */
export class StreamTokens {
  readonly #byMessage = new Map<string, ResultUsage>();
  #total = 0;

  add(line: string): number {
    if (!line.includes('"assistant"')) return this.#total;
    try {
      const event = JSON.parse(line) as { type?: string; message?: { id?: string; usage?: Parameters<typeof usageFromResult>[0]['usage'] } };
      if (event.type !== 'assistant' || !event.message?.usage) return this.#total;
      const spent = usageFromResult({ type: 'result', usage: event.message.usage });
      if (!spent) return this.#total;
      const id = event.message.id ?? `#${String(this.#byMessage.size)}`;
      const before = this.#byMessage.get(id);
      this.#total += totalTokens(spent) - (before ? totalTokens(before) : 0);
      this.#byMessage.set(id, spent);
    } catch {
      // not a JSON event line
    }
    return this.#total;
  }

  get total(): number {
    return this.#total;
  }

  /** D-1317: the running usage, summed per field, for a session killed before its result event (turns = assistant messages seen). */
  usage(): ResultUsage {
    const sum: ResultUsage = { inputTokens: 0, cachedInputTokens: 0, cacheCreationTokens: 0, outputTokens: 0, turns: this.#byMessage.size };
    for (const spent of this.#byMessage.values()) {
      sum.inputTokens += spent.inputTokens;
      sum.cachedInputTokens += spent.cachedInputTokens;
      sum.cacheCreationTokens += spent.cacheCreationTokens;
      sum.outputTokens += spent.outputTokens;
    }
    return sum;
  }
}
