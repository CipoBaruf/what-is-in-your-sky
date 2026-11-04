/**
 * FR-SDD-18 (D-1065): the review's tier for each case, the findings file,
 * and FR-SDD-9 / FR-SDD-16: the review and fix prompts carry their workflow
 * files, the findings and the failure digest.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findingsPath, fixHandoffPath, FIX_WORKFLOW, fixPrompt, parseFindings, REVIEW_WORKFLOW, reviewPrompt, reviewTier, reviewTierFor } from '../../scripts/sdd/review';

const auto = { tier: 'standard', gate: 'auto', review: null } as const;

describe('FR-SDD-18: reviewTier (D-1065)', () => {
  it('runs no review on a docs-only diff: docs/ and root *.md', () => {
    expect(reviewTier(auto, ['docs/sdd/workflows/review.md', 'TASKS.md', 'AGENTS.md'])).toBeNull();
    expect(reviewTier({ ...auto, tier: 'hard', gate: 'owner' }, ['docs/x.md'])).toBeNull();
  });

  it('keeps a review for a tests-only diff, on light', () => {
    expect(reviewTier(auto, ['tests/sdd/agents.test.ts'])).toBe('light');
  });

  it('reviews a markdown file below the root as code', () => {
    expect(reviewTier(auto, ['docs/a.md', 'src/data/README.md'])).toBe('light');
  });

  it('reviews on standard for a hard task and for an owner gate', () => {
    expect(reviewTier({ ...auto, tier: 'hard' }, ['src/ui/App.tsx'])).toBe('standard');
    expect(reviewTier({ ...auto, gate: 'owner' }, ['src/ui/App.tsx'])).toBe('standard');
  });

  it('reviews on standard for any path under src/physics/, src/worker/ or scripts/sdd/', () => {
    for (const path of ['src/physics/sgp4.ts', 'src/worker/handlers.ts', 'scripts/sdd/session.ts']) expect(reviewTier(auto, ['docs/a.md', path])).toBe('standard');
    expect(reviewTier(auto, ['scripts/sdd-run.ts'])).toBe('light');
  });

  it('reviews everything else on light, whatever the task tier below hard', () => {
    expect(reviewTier(auto, ['src/ui/App.tsx', 'docs/a.md'])).toBe('light');
    expect(reviewTier({ ...auto, tier: 'light' }, ['src/data/store.ts'])).toBe('light');
    expect(reviewTier({ ...auto, tier: null }, ['vite.config.ts'])).toBe('light');
  });

  it("lets a task's Review: pick the tier, but not bring back a docs-only review", () => {
    expect(reviewTierFor({ ...auto, review: 'standard' }, ['src/ui/App.tsx'])).toBe('standard');
    expect(reviewTierFor({ ...auto, review: 'standard' }, ['docs/a.md'])).toBeNull();
    expect(reviewTierFor(auto, ['src/ui/App.tsx'])).toBe('light');
  });
});

describe('FR-SDD-18: parseFindings', () => {
  it('reads one finding a line and keeps what it cannot read', () => {
    const text = [
      '{"file":"scripts/sdd/review.ts","line":12,"claim":"A docs path is reviewed.","scenario":"docs/a.md alone → light"}',
      '',
      '{"file":"x.ts","line":"3","claim":"c","scenario":"s"}',
      'not json',
    ].join('\n');
    expect(parseFindings(text)).toEqual({
      findings: [{ file: 'scripts/sdd/review.ts', line: 12, claim: 'A docs path is reviewed.', scenario: 'docs/a.md alone → light' }],
      unreadable: ['{"file":"x.ts","line":"3","claim":"c","scenario":"s"}', 'not json'],
    });
    expect(parseFindings('\n')).toEqual({ findings: [], unreadable: [] });
  });
});

describe('FR-SDD-9, FR-SDD-16: the prompts come from the workflows', () => {
  const review = readFileSync(REVIEW_WORKFLOW, 'utf8');
  const fix = readFileSync(FIX_WORKFLOW, 'utf8');

  it("the review prompt contains review.md's text, the base and the handoff file", () => {
    const prompt = reviewPrompt({ id: 'R9', brief: 'sdd-run/R9.brief.md', base: 'origin/main', workflow: review });
    expect(prompt).toContain(review.trim());
    expect(prompt).toContain('git diff origin/main...HEAD');
    expect(prompt).toContain(findingsPath('R9'));
    expect(prompt).toContain('sdd-run/R9.brief.md');
  });

  it("the fix prompt contains fix-ci.md's text, the findings as written and the digest", () => {
    const finding = '{"file":"a.ts","line":1,"claim":"c","scenario":"s"}';
    const prompt = fixPrompt({ id: 'R9', brief: 'sdd-run/R9.brief.md', workflow: fix, findings: [finding], digest: '## ci\n\n- test "x" failed' });
    expect(prompt).toContain(fix.trim());
    expect(prompt).toContain(`## The findings\n\n${finding}`);
    expect(prompt).toContain('## The failure digest\n\n## ci\n\n- test "x" failed');
    const findingsOnly = fixPrompt({ id: 'R9', brief: 'b', workflow: fix, findings: [finding], digest: null });
    expect(findingsOnly).not.toContain('## The failure digest');
    expect(fixHandoffPath('R9')).toBe('sdd-run/R9.fix.md');
    expect(findingsOnly).toContain('write the summary to sdd-run/R9.fix.md');
    expect(findingsOnly).not.toContain('R9.summary.md');
  });
});
