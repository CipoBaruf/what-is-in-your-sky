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
  rate_limit_info?: { status?: string; resetsAt?: number; rateLimitType?: string };
}

/**
 * §16.4 step 10: the limit a stream event announces, or `null` for any other
 * event. A window the entry lists as shared (`five_hour`, `seven_day`) stops
 * every model; any other, such as one model's own weekly window, does not.
 */
export function limitFromEvent(event: RateLimitEvent, limit: Pick<LimitConfig, 'accountWindows'>): LimitInfo | null {
  if (event.type !== 'rate_limit_event' || event.rate_limit_info?.status !== 'rejected') return null;
  const info = event.rate_limit_info;
  const window = info.rateLimitType ?? null;
  return { window, resetsAt: typeof info.resetsAt === 'number' ? info.resetsAt * 1000 : null, accountWide: window === null || limit.accountWindows.includes(window) };
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
    if (outcome === 'limit') continue; // the event already said so; the result is the synthetic sentence
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
  const limit = limitFromText(config, text) ?? limitFromText(config, stderr);
  if (limit) return done('limit', text, null, limit);
  const handedOff = handoffPath === null || existsSync(handoffPath);
  return done(code === 0 && handedOff ? 'ok' : 'error', text, null, null);
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
  readonly #byMessage = new Map<string, number>();
  #total = 0;

  add(line: string): number {
    if (!line.includes('"assistant"')) return this.#total;
    try {
      const event = JSON.parse(line) as { type?: string; message?: { id?: string; usage?: Parameters<typeof usageFromResult>[0]['usage'] } };
      if (event.type !== 'assistant' || !event.message?.usage) return this.#total;
      const spent = usageFromResult({ type: 'result', usage: event.message.usage });
      const tokens = spent ? totalTokens(spent) : 0;
      const id = event.message.id ?? `#${String(this.#byMessage.size)}`;
      this.#total += tokens - (this.#byMessage.get(id) ?? 0);
      this.#byMessage.set(id, tokens);
    } catch {
      // not a JSON event line
    }
    return this.#total;
  }
}
