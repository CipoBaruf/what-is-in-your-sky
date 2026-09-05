/**
 * PLAN §16.4: the driver's command line, including §16.6's `--model`
 * override, which is for one `--task` run and never for a wave.
 */
import { describe, expect, it } from 'vitest';
import { helpText, parseArgs } from '../../scripts/sdd/cli';

describe('parseArgs', () => {
  it('reads the four modes', () => {
    expect(parseArgs([]).mode).toBe('help');
    expect(parseArgs(['--status']).mode).toBe('status');
    expect(parseArgs(['--dry-run']).mode).toBe('dry-run');
    expect(parseArgs(['--wave']).mode).toBe('wave');
    expect(parseArgs(['--task', 'R22'])).toMatchObject({ mode: 'task', taskId: 'R22', model: null });
  });

  it('takes --model for one --task run, in either order', () => {
    expect(parseArgs(['--task', 'R22', '--model', 'opus'])).toMatchObject({ mode: 'task', taskId: 'R22', model: 'opus' });
    expect(parseArgs(['--model', 'fable', '--task', 'R22']).model).toBe('fable');
    expect(parseArgs(['--task', 'R22', '--dry-run', '--model', 'opus'])).toMatchObject({ mode: 'dry-run', taskId: 'R22', model: 'opus' });
  });

  it('refuses --model on a wave, and a model the policy does not know', () => {
    expect(() => parseArgs(['--wave', '--model', 'opus'])).toThrow(/--model is for --task only/);
    expect(() => parseArgs(['--task', 'R22', '--model', 'interactive'])).toThrow(/one of opus, fable, sonnet, haiku/);
    expect(() => parseArgs(['--task', 'R22', '--model', 'gemini'])).toThrow(/one of opus, fable, sonnet, haiku/);
    expect(() => parseArgs(['--task', 'R22', '--model'])).toThrow(/one of opus, fable, sonnet, haiku/);
    expect(parseArgs(['--task', 'R22', '--model', 'sonnet'])).toMatchObject({ model: 'sonnet' });
  });

  it('keeps the old refusals', () => {
    expect(() => parseArgs(['--task'])).toThrow(/--task needs a task id/);
    expect(() => parseArgs(['--wave', '--tasks-file', 'x.md'])).toThrow(/--tasks-file is for --status and --dry-run only/);
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown argument/);
  });

  it('documents the override in the help text', () => {
    expect(helpText('origin/main')).toContain('--task R22 --model opus');
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
