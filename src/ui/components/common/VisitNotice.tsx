import { useLocale, useT } from '../../../i18n/useT';
import { coordsLabel } from '../../../lib/place';
import { formatDate, formatShortClock } from '../../../lib/timeFormat';
import { useActiveObserver, useAppStore, type OpenLinkResult } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { Line } from '../primitives/Line';
import { TextButton } from '../primitives/TextButton';
import styles from './VisitNotice.module.css';

/**
 * R87 (FR-VISIT-2, US-32 AC1, D-539): while this tab looks from a link's place
 * over a saved one (R83's `visiting`), one line under the header says so and
 * offers the two ways out: `[ back to my place ]` (`endVisit`: the saved
 * observer, its label and zone, the hash cleared) and `[ keep this place ]`
 * (`keepVisit`: the visited place stored, FR-LOC-5). It is `role="status"`,
 * at `--small`. Wide, the sentence and the controls are one line with a dot
 * between; on a phone the sentence's short form is one row and the controls
 * the second, so the notice is at most two rows of 36 cells in both languages
 * (`tests/styles/controlRows.test.ts`). The live page mounts the same
 * component (R89).
 *
 * R105 (FR-DS-4 item 6, D-718): a `Line` at `--small` — on a desk the
 * sentence, the dot and the two controls on one line (`dot`), on a phone the
 * controls on the text row under the sentence (`rows="text"`).
 */
export function VisitNotice({ inert = false }: { inert?: boolean }) {
  const t = useT();
  const visiting = useAppStore((s) => s.visiting);
  const endVisit = useAppStore((s) => s.endVisit);
  const keepVisit = useAppStore((s) => s.keepVisit);
  const wide = useLayoutMode() === 'wide';
  if (visiting === null) return null;
  const place = coordsLabel(visiting.lat, visiting.lon);
  return (
    <Line
      as="div"
      role="status"
      inert={inert}
      size="small"
      dot={wide}
      {...(wide ? {} : { rows: 'text' as const })}
      actions={
        <>
          <TextButton inline label={t.visit.back} data-testid="visit-back" onClick={endVisit} />
          <TextButton inline label={t.visit.keep} data-testid="visit-keep" onClick={keepVisit} />
        </>
      }
      data-form={wide ? 'line' : 'rows'}
      data-testid="visit-notice"
    >
      <span data-testid="visit-sentence">{wide ? t.visit.showing({ place }) : t.visit.showingShort({ place })}</span>
    </Line>
  );
}

/** The notes a page draws: the live page the moment's two (FR-VISIT-3), home the unreadable link's (FR-VISIT-4). */
export type LinkNoteKind = 'past' | 'far' | 'unreadable';

function noteOf(result: OpenLinkResult | null): LinkNoteKind | null {
  if (result === null) return null;
  if (result.kind === 'unreadable') return 'unreadable';
  if ('note' in result && result.note !== undefined) return result.note;
  return null;
}

/**
 * R87 (FR-VISIT-3, FR-VISIT-4, US-32 AC3, D-539): the one line a link that
 * could not be honoured leaves — a moment that has passed, one beyond the
 * stripe's span, or a hash that did not parse. It reads `openLink()`'s last
 * result from the ui slice, which is session state and never stored, and
 * dismissing it takes the note off that result: the visit, if there is one,
 * stays. `kinds` is what the page it sits on can be showing; a note about a
 * live link's moment says nothing on home.
 */
export function LinkNote({ kinds, inert = false }: { kinds: readonly LinkNoteKind[]; inert?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const result = useAppStore((s) => s.linkResult);
  const setLinkResult = useAppStore((s) => s.setLinkResult);
  const timeZone = useActiveObserver()?.timeZone ?? null;
  const kind = noteOf(result);
  if (result === null || kind === null || !kinds.includes(kind)) return null;
  const dismiss = (): void => {
    if ('link' in result) setLinkResult({ kind: result.kind, link: result.link });
    else setLinkResult(null);
  };
  let text: string = t.visit.unreadable;
  if (kind !== 'unreadable' && 'link' in result && result.link.kind === 'live' && result.link.t !== null) {
    const at = result.link.t;
    const time = `${formatDate(at, timeZone, locale)} ${formatShortClock(at, timeZone, locale, true)}`;
    text = kind === 'past' ? t.visit.past({ time }) : t.visit.far({ time });
  }
  // R105 (D-718): the same `Line` as the notice above, in the strip's dim ink, its one control after the sentence.
  return (
    <Line role="status" inert={inert} size="small" ink="dim" actions={<TextButton inline label="×" aria-label={t.visit.dismiss} data-testid="link-note-dismiss" onClick={dismiss} />} data-note={kind} data-testid="link-note">
      {text}
    </Line>
  );
}

/**
 * The strip under the header that holds both: rendered empty when there is
 * nothing to say, which the stylesheet takes out of the page — and out of the
 * wide shell's grid, which gives it a row only while it holds something.
 */
export function PageNotices({ kinds, inert = false }: { kinds: readonly LinkNoteKind[]; inert?: boolean }) {
  return (
    <div className={styles.notices} data-page-notices="">
      <VisitNotice inert={inert} />
      <LinkNote kinds={kinds} inert={inert} />
    </div>
  );
}
