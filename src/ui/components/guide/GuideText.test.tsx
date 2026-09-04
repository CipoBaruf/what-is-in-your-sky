import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../../tests/support/fixtures';
import { I18nProvider } from '../../../i18n/useT';
import { GuideText } from './GuideText';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { en: { asComputed: string }; es: { asComputed: string } };

describe('<GuideText> (FR-GUIDE-1)', () => {
  it('renders the golden sentence for the first golden pass in UTC', () => {
    render(<GuideText pass={goldenPassFixture()} timeZone={null} />);
    expect(screen.getByTestId('guide-sentence')).toHaveTextContent(golden.en.asComputed);
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
  });

  it('renders the Spanish golden sentence under a Spanish provider (FR-I18N-2, FR-I18N-3)', () => {
    render(
      <I18nProvider locale="es">
        <GuideText pass={goldenPassFixture()} timeZone={null} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.es.asComputed);
  });
});
