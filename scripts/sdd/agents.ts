/**
 * FR-SDD-10, FR-SDD-11 (D-1064): an agent is an entry in `sdd.agents.json`.
 * This file holds the schema, the loader and the pieces of an entry the driver
 * uses: the argv per tier, the tool flags, the model → tier map, the fallback
 * chain and the limit pattern. It names no agent and no model in its code.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** The config file, relative to the driver's working directory. */
const AGENTS_PATH = 'sdd.agents.json';

/** FR-SDD-11: what a task's `Tier:` may say, cheapest last. */
export const TIERS = ['hard', 'standard', 'light'] as const;
export type Tier = (typeof TIERS)[number];

const PLACEHOLDER = /\{(?:prompt|model|maxTurns)\}/g;

const regex = z.string().refine((source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}, 'not a valid regular expression');

const tierEntry = z
  .object({
    model: z.string().min(1),
    /** Optional: the driver's own caps apply when unset. */
    maxTurns: z.number().int().positive().optional(),
    /** FR-SDD-2: total tokens a session of this tier may spend; unset records overruns only. */
    tokenCeiling: z.number().int().positive().optional(),
  })
  .strict();

/** A tool policy whose name ends `-allowlist` passes the lists through the entry's two flags; `none` passes nothing. */
const allowlist = z
  .object({
    policy: z.string().regex(/^[a-z0-9]+-allowlist$/),
    allowFlag: z.string().min(1),
    denyFlag: z.string().min(1),
    separator: z.string().min(1),
    implement: z.array(z.string().min(1)),
    review: z.array(z.string().min(1)),
    denied: z.array(z.string().min(1)),
  })
  .strict();

const agentEntry = z
  .object({
    /** argv; `{prompt}`, `{model}` and `{maxTurns}` are substituted whole-word inside each element. */
    command: z
      .array(z.string().min(1))
      .min(1)
      .refine((argv) => argv.some((arg) => arg.includes('{prompt}')), 'the command has no `{prompt}`'),
    tiers: z.object({ hard: tierEntry, standard: tierEntry, light: tierEntry }).strict(),
    /** Other model names a closed phase's `Model:` may carry, and the tier each reads as. */
    aliases: z.record(z.string(), z.enum(TIERS)).default({}),
    /** D-197: where a limit-stopped session goes next, in order. */
    fallback: z.array(z.enum(TIERS)),
    limit: z
      .object({
        /** Matches a limit sentence; capture group 1, when present, is the reset time as written. */
        pattern: regex,
        /** A limit sentence that also matches this is one model's own, so another model may escape it. */
        modelPattern: regex.optional(),
        /** The windows an event may name that every model shares. */
        accountWindows: z.array(z.string()).default([]),
      })
      .strict(),
    parser: z.enum(['stream-json', 'exit-code']),
    tools: z.union([z.object({ policy: z.literal('none') }).strict(), allowlist]),
  })
  .strict();

const configSchema = z
  .object({
    default: z.string().min(1),
    agents: z.record(z.string().regex(/^[a-z0-9-]+$/), agentEntry),
  })
  .strict()
  .refine((config) => config.default in config.agents, 'the default agent has no entry');

export type AgentEntry = z.infer<typeof agentEntry>;
export type AgentsConfig = z.infer<typeof configSchema>;
export type LimitConfig = AgentEntry['limit'];
export interface Agent extends AgentEntry {
  name: string;
}

/** Validates a parsed config; throws with every problem, one per line. */
export function parseAgents(value: unknown): AgentsConfig {
  const result = configSchema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(`${AGENTS_PATH} is invalid:\n${result.error.issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n')}`);
}

export const loadAgents = (path = AGENTS_PATH): AgentsConfig => parseAgents(JSON.parse(readFileSync(path, 'utf8')) as unknown);

/** The first name given (the caller passes the task's `Agent:` before `--agent`), else the config's default; throws on a name the config lacks. */
export function pickAgent(config: AgentsConfig, ...names: (string | null | undefined)[]): Agent {
  const name = names.find((candidate): candidate is string => typeof candidate === 'string' && candidate !== '') ?? config.default;
  const entry = config.agents[name];
  if (!entry) throw new Error(`no agent \`${name}\` in ${AGENTS_PATH}; it has ${Object.keys(config.agents).join(', ')}`);
  return { name, ...entry };
}

/** FR-SDD-11: every model name the agent knows → its tier; the tiers' own models first, then the aliases. */
export function modelTiers(agent: AgentEntry): Record<string, Tier> {
  const map: Record<string, Tier> = {};
  for (const tier of TIERS) map[agent.tiers[tier].model] ??= tier;
  for (const [model, tier] of Object.entries(agent.aliases)) map[model] ??= tier;
  return map;
}

/** D-197: the tier after `tier` in the agent's fallback chain, or `null` at its end or off it. */
export function nextTier(agent: AgentEntry, tier: Tier): Tier | null {
  const index = agent.fallback.indexOf(tier);
  return index === -1 ? null : (agent.fallback[index + 1] ?? null);
}

export type SessionKind = 'implement' | 'review' | 'fix';

/** D-1064: the entry's command with the placeholders filled, and the tool policy's flags after it. */
export function buildArgv(agent: AgentEntry, values: { prompt: string; model: string; maxTurns: number; kind: SessionKind }): { file: string; args: string[] } {
  // One pass, so a prompt that quotes `{model}` keeps it as written.
  const filled = agent.command.map((arg) => arg.replace(PLACEHOLDER, (key) => (key === '{prompt}' ? values.prompt : key === '{model}' ? values.model : String(values.maxTurns))));
  const [file = '', ...args] = filled;
  return { file, args: [...args, ...toolArgs(agent, values.kind)] };
}

/** The tool lists for a session kind; a fix session edits as the implementation does. */
export function toolLists(agent: AgentEntry, kind: SessionKind): { allowed: readonly string[]; denied: readonly string[] } {
  if (agent.tools.policy === 'none' || !('denied' in agent.tools)) return { allowed: [], denied: [] };
  return { allowed: kind === 'review' ? agent.tools.review : agent.tools.implement, denied: agent.tools.denied };
}

function toolArgs(agent: AgentEntry, kind: SessionKind): string[] {
  const tools = agent.tools;
  if (tools.policy === 'none' || !('denied' in tools)) return [];
  const { allowed, denied } = toolLists(agent, kind);
  return [tools.allowFlag, allowed.join(tools.separator), tools.denyFlag, denied.join(tools.separator)];
}

/** What a limit said: the window, the reset in epoch ms, and whether every model shares it (§16.4 step 10). */
export interface LimitInfo {
  window: string | null;
  resetsAt: number | null;
  accountWide: boolean;
}

/**
 * The limit a sentence announces, or `null`. The reset comes from the
 * pattern's group 1 (`7:10pm`, `Tue 9am`) read as the next such time in the
 * machine's zone; the zone the sentence names is not read.
 */
export function limitFromText(limit: LimitConfig, text: string | null | undefined, now = Date.now()): LimitInfo | null {
  if (!text) return null;
  const match = new RegExp(limit.pattern, 'i').exec(text);
  if (!match) return null;
  const modelOnly = limit.modelPattern !== undefined && new RegExp(limit.modelPattern, 'i').test(text);
  return { window: null, resetsAt: match[1] ? resetFromText(match[1], now) : null, accountWide: !modelOnly };
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/** What follows the three letters in the full day name, plus the common `tues`/`thur(s)` forms. */
const FULL: Record<string, string> = { sun: 'day', mon: 'day', tue: 's|sday', wed: 'nesday', thu: 'r|rs|rsday', fri: 'day', sat: 'urday' };

/** `7:10pm (Europe/Madrid)` → the next 19:10 local after `now`; `Tue 9am` → the next Tuesday 09:00; `null` when no time is found. */
export function resetFromText(text: string, now: number): number | null {
  // A time-zone name (`(America/Montevideo)`, `Europe/Monaco`) is not a day.
  const words = text.replace(/\([^)]*\)/g, ' ').replace(/\S*\/\S*/g, ' ');
  const time = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(words);
  if (!time) return null;
  let hours = Number(time[1]);
  const minutes = Number(time[2] ?? 0);
  const half = time[3]?.toLowerCase();
  if (half === 'pm' && hours < 12) hours += 12;
  if (half === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  const day = DAYS.findIndex((name) => new RegExp(`\\b${name}(?:${FULL[name]})?\\b`, 'i').test(words));
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  if (day !== -1) at.setDate(at.getDate() + ((day - at.getDay() + 7) % 7));
  while (at.getTime() <= now) at.setDate(at.getDate() + (day !== -1 ? 7 : 1));
  return at.getTime();
}
