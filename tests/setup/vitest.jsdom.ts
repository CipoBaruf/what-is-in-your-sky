import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './msw';

// FR-X-5: component tests assert `expect(await axe(container)).toHaveNoViolations()` (PLAN §9.1).
expect.extend(toHaveNoViolations);

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must match vitest's own declaration
  interface Matchers<T = any> {
    toHaveNoViolations(): T;
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
