/**
 * PLAN §16.4: the driver's command line, including §16.6's `--tier` and
 * `--model` override, which is for one `--task` run and never for a wave, and
 * FR-SDD-10's `--agent`.
 */
import { describe, expect, it } from 'vitest';
import { helpText, parseArgs } from '../../scripts/sdd/cli';

describe('parseArgs', () => {
  it('reads the four modes', () => {
    expect(parseArgs([]).mode).toBe('help');
    expect(parseArgs(['--status']).mode).toBe('status');
    expect(parseArgs(['--dry-run']).mode).toBe('dry-run');
    expect(parseArgs(['--wave']).mode).toBe('wave');
    expect(parseArgs(['--task', 'R22'])).toMatchObject({ mode: 'task', taskId: 'R22', tier: null, model: null, agent: null, fix: false });
  });

  it('takes --model for one --task run, in either order', () => {
    expect(parseArgs(['--task', 'R22', '--model', 'opus'])).toMatchObject({ mode: 'task', taskId: 'R22', model: 'opus' });
    expect(parseArgs(['--model', 'fable', '--task', 'R22']).model).toBe('fable');
    expect(parseArgs(['--task', 'R22', '--dry-run', '--model', 'opus'])).toMatchObject({ mode: 'dry-run', taskId: 'R22', model: 'opus' });
  });

  it('FR-SDD-11: takes --tier for one --task run, and refuses a tier that does not exist', () => {
    expect(parseArgs(['--task', 'R22', '--tier', 'hard'])).toMatchObject({ tier: 'hard', model: null });
    expect(() => parseArgs(['--task', 'R22', '--tier', 'huge'])).toThrow(/one of hard, standard, light/);
    expect(() => parseArgs(['--task', 'R22', '--tier'])).toThrow(/one of hard, standard, light/);
    expect(() => parseArgs(['--task', 'R22', '--tier', 'hard', '--model', 'opus'])).toThrow(/give one/);
  });

  it('refuses --tier or --model on a wave, and --model with no value', () => {
    expect(() => parseArgs(['--wave', '--model', 'opus'])).toThrow(/are for --task only/);
    expect(() => parseArgs(['--wave', '--tier', 'light'])).toThrow(/are for --task only/);
    expect(() => parseArgs(['--task', 'R22', '--model'])).toThrow(/--model needs a value/);
    expect(() => parseArgs(['--task', 'R22', '--model', '--no-wait'])).toThrow(/--model needs a value/);
  });

  it('keeps the old refusals', () => {
    expect(() => parseArgs(['--task'])).toThrow(/--task needs a task id/);
    expect(() => parseArgs(['--wave', '--tasks-file', 'x.md'])).toThrow(/--tasks-file is for --status and --dry-run only/);
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown argument/);
  });

  it('documents the override in the help text', () => {
    expect(helpText('origin/main')).toContain('--task R22 --tier hard');
  });
});

describe('--fallback (§16.4 step 10, D-197)', () => {
  it('is on unless --no-fallback, on a wave and on one task', () => {
    expect(parseArgs(['--wave']).fallback).toBe(true);
    expect(parseArgs(['--task', 'R22']).fallback).toBe(true);
    expect(parseArgs(['--wave', '--no-fallback']).fallback).toBe(false);
    expect(parseArgs(['--no-fallback', '--task', 'R22', '--fallback']).fallback).toBe(true);
    expect(helpText('origin/main')).toContain('--no-fallback');
  });
});

describe('--wait (§16.4 step 10, D-835)', () => {
  it('waits out the limit unless --no-wait, on a wave and on one task', () => {
    expect(parseArgs(['--wave']).waitForReset).toBe(true);
    expect(parseArgs(['--task', 'R22']).waitForReset).toBe(true);
    expect(parseArgs(['--wave', '--no-wait']).waitForReset).toBe(false);
    expect(parseArgs(['--no-wait', '--task', 'R22', '--wait']).waitForReset).toBe(true);
    expect(helpText('origin/main')).toContain('--no-wait');
  });
});

describe('--agent (FR-SDD-10) and --fix (FR-SDD-16)', () => {
  it('picks an agent for a wave or a task, and needs a name', () => {
    expect(parseArgs(['--wave', '--agent', 'other']).agent).toBe('other');
    expect(parseArgs(['--agent', 'other', '--task', 'R22'])).toMatchObject({ mode: 'task', agent: 'other' });
    expect(() => parseArgs(['--wave', '--agent'])).toThrow(/--agent needs a value/);
    expect(helpText('origin/main')).toContain('--agent <name>');
  });

  it('runs no fix session unless --fix', () => {
    expect(parseArgs(['--wave']).fix).toBe(false);
    expect(parseArgs(['--wave', '--fix']).fix).toBe(true);
    expect(parseArgs(['--fix', '--wave', '--no-fix']).fix).toBe(false);
    expect(parseArgs(['--wave']).prune).toBe(true);
    expect(parseArgs(['--wave', '--no-prune']).prune).toBe(false);
  });
});
