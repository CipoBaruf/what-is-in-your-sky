// @vitest-environment jsdom
/** R189 (FR-WIDE-10, D-1103): the Fullscreen API's three calls, against a stubbed document. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enterFullscreen, exitFullscreen, fullscreenElement, fullscreenSupported } from './fullscreen';

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeDoc(over: Partial<Record<'fullscreenEnabled' | 'fullscreenElement' | 'exitFullscreen', unknown>>, request: unknown = () => Promise.resolve()): Document {
  return { fullscreenEnabled: true, fullscreenElement: null, exitFullscreen: () => Promise.resolve(), documentElement: { requestFullscreen: request }, ...over } as unknown as Document;
}

describe('fullscreenSupported', () => {
  it('is true where the document allows it and elements have the call', () => {
    expect(fullscreenSupported(fakeDoc({}))).toBe(true);
  });

  it('FR-WIDE-10: is false where the API is missing or disabled, so the control is absent', () => {
    expect(fullscreenSupported(fakeDoc({ fullscreenEnabled: false }))).toBe(false);
    expect(fullscreenSupported(fakeDoc({}, null))).toBe(false);
  });
});

describe('enterFullscreen', () => {
  it('resolves to whether the browser granted it', async () => {
    const granted = { requestFullscreen: vi.fn(() => Promise.resolve()) } as unknown as Element;
    const refused = { requestFullscreen: vi.fn(() => Promise.reject(new TypeError('denied'))) } as unknown as Element;
    expect(await enterFullscreen(granted)).toBe(true);
    expect(await enterFullscreen(refused)).toBe(false);
  });
});

describe('exitFullscreen', () => {
  it('leaves only where the page is in full screen', async () => {
    const exit = vi.fn(() => Promise.resolve());
    await exitFullscreen(fakeDoc({ exitFullscreen: exit }));
    expect(exit).not.toHaveBeenCalled();
    const element = {} as Element;
    const doc = fakeDoc({ exitFullscreen: exit, fullscreenElement: element });
    expect(fullscreenElement(doc)).toBe(element);
    await exitFullscreen(doc);
    expect(exit).toHaveBeenCalledOnce();
  });
});
