import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../../tests/support/fixtures';
import { GuideText } from './GuideText';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { asComputed: string };

describe('<GuideText> (FR-GUIDE-1)', () => {
  it('renders the golden sentence for the first golden pass in UTC', () => {
    render(<GuideText pass={goldenPassFixture()} timeZone={null} />);
    expect(screen.getByTestId('guide-sentence')).toHaveTextContent(golden.asComputed);
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.asComputed);
  });
});
