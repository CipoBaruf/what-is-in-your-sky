/**
 * R50 (F-43): the guide sheet and the shortcuts overlay both move focus to
 * their heading and both give it back when they close, and both used to give
 * it back to the body.
 *
 * The cause is a matter of one commit's worth of timing, so the test is too.
 * Opening either of them also puts `inert` on the header, the main and the
 * footer, React writes that attribute in the mutation phase, and the browser
 * blurs whatever the `inert` subtree contains — the pass card the reader was
 * on — before any effect runs. jsdom implements no part of that, so the blur
 * is played by a sibling's layout effect, which runs in the same place: after
 * the DOM is updated, before the passive effect the opener used to be read
 * in, and after the render it is read in now.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useOpenerFocus } from './useOpenerFocus';

/** What `inert` does to the focused element when the overlay above it commits. */
function Blur() {
  useLayoutEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  return null;
}

function Dialog() {
  const heading = useRef<HTMLHeadingElement>(null);
  useOpenerFocus(heading);
  return (
    <h2 ref={heading} tabIndex={-1}>
      Guide
    </h2>
  );
}

function Harness({ keepOpener = true }: { keepOpener?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {(!open || keepOpener) && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Open guide
        </button>
      )}
      {open && (
        <>
          <Blur />
          <Dialog />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </button>
        </>
      )}
    </>
  );
}

describe('useOpenerFocus (F-43)', () => {
  it('gives focus back to the opener even though the commit that opened blurred it', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open guide' });
    opener.focus();
    fireEvent.click(opener);
    // The blur landed, and the heading took focus anyway.
    expect(screen.getByRole('heading', { name: 'Guide' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(opener).toHaveFocus();
  });

  it('leaves focus alone when the opener has gone from the page', () => {
    render(<Harness keepOpener={false} />);
    const opener = screen.getByRole('button', { name: 'Open guide' });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.click(close);
    expect(document.body).toHaveFocus();
  });
});
