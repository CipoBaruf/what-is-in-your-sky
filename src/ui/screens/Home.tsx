import { Suspense, useId, useRef, useState, type LazyExoticComponent, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import { searchPlaces, SEARCH_WINDOW_HOURS, useAppStore } from '../../state';
import styles from '../App.module.css';
import { Banner } from '../components/common/Banner';
import { InstallHint } from '../components/common/InstallHint';
import { LocationSummary } from '../components/common/LocationSummary';
import { ReadinessLine } from '../components/common/ReadinessLine';
import { SectionHeading } from '../components/common/SectionHeading';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { ElementsBanners } from '../components/elements/ElementsBanners';
import { Favourites } from '../components/location/Favourites';
import { LocationInput } from '../components/location/LocationInput';
import type { GeolocationEnv } from '../components/location/UseMyLocation';
import { Mark } from '../components/mark/Mark';
import { MARK_HERO_COMPACT_PX, MARK_HERO_WIDE_PX } from '../components/mark/tiers';
import type { MoonLore as MoonLoreComponent } from '../components/moon/MoonLore';
import { DarkWindow } from '../components/now/DarkWindow';
import { NowPanel } from '../components/now/NowPanel';
import { NextEventBlock } from '../components/passes/NextEventBlock';
import { PassList } from '../components/passes/PassList';
import { useLayoutMode } from '../hooks/useLayoutMode';

/**
 * R76 (FR-FIRST-1..FR-FIRST-6, D-443, D-444): the home page as three readings —
 * **where**, **when**, **what** — composed from the components the page already
 * had. Nothing here changes how any of them writes the store; this is where they
 * sit, and the stylesheet (`App.module.css`) decides whether the three stack
 * (compact), take FR-DESK-2's two columns with Where above When (wide), or are
 * three equal panes (from `HOME_THREE_PANE_MIN_PX`).
 *
 * With no observer there is nothing to read yet, and the page is the cold open
 * alone (FR-FIRST-1): the mark, the tagline on compact, the step line, the
 * question and its sentence, and the input group with its two foot notes. No
 * Now panel, no readiness line, no list, and no banner about elements — those
 * are about a place, and there is none.
 *
 * The two columns' wrappers (`col-left`, `col-right`) are kept, because between
 * the wide breakpoint and the three-pane width the page *is* those two columns
 * and D-253's guide rules are written against the right one. At three-pane
 * widths the stylesheet dissolves them (`display: contents`), so the three
 * regions and the guide panel are the page grid's own items, and an open pass
 * (`data-guide="pane"`) is the panel placed across the Where and When columns
 * with the list left in What (D-444).
 */
export type Step = 'where' | 'when' | 'what';
export const STEPS: readonly Step[] = ['where', 'when', 'what'];

/** "[01] where" for the current step, "02 when" for the others (FR-FIRST-1's step line, FR-FIRST-5's pane headings). */
export function stepLabel(step: Step, current: boolean, word: string): string {
  const number = String(STEPS.indexOf(step) + 1).padStart(2, '0');
  return current ? `[${number}] ${word}` : `${number} ${word}`;
}

/** FR-FIRST-1: `[01] where — 02 when — 03 what`, the current step bracketed and in `--fg`, the others dim. */
export function StepLine({ current }: { current: Step }) {
  const t = useT();
  return (
    <ol className={styles.steps} aria-label={t.home.stepsLabel} data-testid="step-line">
      {STEPS.map((step) => (
        <li key={step} className={styles.stepItem} {...(step === current ? { 'aria-current': 'step' as const } : {})}>
          {stepLabel(step, step === current, t.home.steps[step])}
        </li>
      ))}
    </ol>
  );
}

/**
 * FR-FIRST-5: a reading's character-rule heading, numbered like the step line —
 * `[01] Where`, `02 When`, `03 What`, the first bracketed as the spec writes
 * them.
 */
function Region({ step, className, testId, children }: { step: Step; className: string; testId: string; children: ReactNode }) {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className} data-testid={testId} data-reading={step}>
      <SectionHeading id={headingId}>{stepLabel(step, step === 'where', t.home.panes[step])}</SectionHeading>
      {children}
    </section>
  );
}

/** FR-FIRST-1: the cold open's head — the mark, the tagline on compact, the step line, the question and its sentence. */
function ColdHead({ headingId }: { headingId: string }) {
  const t = useT();
  const mode = useLayoutMode();
  return (
    <>
      <div className={styles.heroMark}>
        <Mark tier="hero" sizePx={mode === 'wide' ? MARK_HERO_WIDE_PX : MARK_HERO_COMPACT_PX} />
      </div>
      {/* The wide header already carries the tagline (FR-DESK-2) and it is not said twice. */}
      {mode === 'compact' && (
        <p className={styles.tagline} data-testid="cold-tagline">
          {t.app.tagline}
        </p>
      )}
      <StepLine current="where" />
      <h2 id={headingId} className={styles.coldHeading}>
        {t.home.coldHeading}
      </h2>
      <p className={styles.coldSentence}>{t.home.coldSentence}</p>
    </>
  );
}

/** Whether the reader is typing in `container` right now: a field of it has the focus. */
function typingIn(container: HTMLElement | null): boolean {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  return container !== null && active instanceof HTMLInputElement && container.contains(active);
}

export interface WhereReadingProps {
  /** R28, R49 (D-154, F-30): whether the update offer and the install hint are out of reach. */
  offersInert: boolean;
  /** The browser's geolocation, for tests; the app reads the real one. */
  geolocation?: GeolocationEnv;
}

/**
 * FR-FIRST-1, FR-FIRST-2, FR-FIRST-4: the Where reading — the cold open with no
 * observer, and with one the location line, the saved places on wide, the
 * readiness line and the elements banners.
 *
 * The input group is one mounted instance across the two states, in the same
 * place in the tree, and only shown or hidden. A coordinate pair becomes an
 * observer at its first valid keystroke and an invalid one drops it, so a group
 * that belonged to either state alone would be torn down under the reader's
 * fingers the moment their typing parsed — the field gone, and the focus with
 * it. For the same reason, when the place arrives while the reader is typing in
 * the group, it stays open under the line; when it arrives any other way — the
 * device button, a saved place — the group folds away and the countdown is
 * what follows the line (FR-FIRST-3).
 */
export function WhereReading({ offersInert, geolocation }: WhereReadingProps) {
  const t = useT();
  const mode = useLayoutMode();
  const observer = useAppStore((s) => s.observer);
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const cold = observer === null;
  const [open, setOpen] = useState(false);
  const [wasCold, setWasCold] = useState(cold);
  const group = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const coldHeadingId = useId();
  const groupId = useId();
  if (wasCold !== cold) {
    setWasCold(cold);
    // Read during the render that changes the state, before the group is hidden: after it the focus is gone.
    // eslint-disable-next-line react-hooks/refs -- the one DOM read that has to precede the commit
    if (!cold) setOpen(typingIn(group.current));
  }
  return (
    <section {...(cold ? {} : { 'aria-labelledby': headingId })} className={cold ? styles.cold : `${styles.reading} ${styles.where}`} data-testid={cold ? 'cold-open' : 'reading-where'} data-reading="where">
      {cold ? <ColdHead headingId={coldHeadingId} /> : <SectionHeading id={headingId}>{stepLabel('where', true, t.home.panes.where)}</SectionHeading>}
      {/* R28 (D-154): both offers sit at the head of the page, inside the region the open sheet makes inert
          and outside the live route. R49 (F-30): on wide nothing around them is made inert, so they are told
          directly. Not in the cold open, which is FR-FIRST-1's inventory and nothing else. */}
      {!cold && <UpdateBanner inert={offersInert} />}
      {!cold && <InstallHint inert={offersInert} />}
      {/* FR-FIRST-4: one line, whose `[ change ]` opens the group in place (FR-SET-3). */}
      {!cold && (
        <LocationSummary
          open={open}
          controls={groupId}
          onToggle={() => {
            setOpen((o) => !o);
          }}
        />
      )}
      <div id={groupId} ref={group} hidden={!cold && !open} className={styles.locationGroup}>
        {/* On wide the saved places are the Where pane's own (FR-FIRST-5); on compact they are inside the group. */}
        <LocationInput
          variant="group"
          {...(cold ? { labelledBy: coldHeadingId } : {})}
          observer={observer}
          onObserver={setObserver}
          onClear={clearSavedObserver}
          search={searchPlaces}
          showFavourites={cold || mode === 'compact'}
          {...(geolocation ? { geolocation } : {})}
        />
      </div>
      {!cold && mode === 'wide' && <Favourites />}
      {!cold && <ReadinessLine />}
      {!cold && <ElementsBanners />}
    </section>
  );
}

/** FR-FIRST-3's host on the home page: the stored run's passes, and why there may be none. */
function NextEventHost() {
  const observer = useAppStore((s) => s.observer);
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  // The same test the list uses for whether its passes are on the screen (a stored run shows whatever the elements are doing, D-108).
  const shown = passes.passes.length > 0 && (elements.status === 'ready' || passes.storedAt !== null) ? passes.passes : [];
  const elementCount = elements.status === 'ready' ? elements.records.length : elements.status === 'error' ? 0 : null;
  const pending = elements.status === 'idle' || elements.status === 'loading' || (elementCount !== 0 && passes.status !== 'done' && passes.status !== 'error');
  return <NextEventBlock passes={shown} context={{ hasDarkness: passes.hasDarkness, elementCount }} pending={pending} weather={snapshot} hours={SEARCH_WINDOW_HOURS} />;
}

export interface HomeProps {
  /** R28, R49 (D-154, F-30): whether the update offer and the install hint are out of reach. */
  offersInert: boolean;
  /** Which of the right column's tracks is on the page (D-253), or `pane` at three-pane widths (D-444). */
  guide: 'closed' | 'open' | 'list' | 'pane';
  shareNotice: string | null;
  selectedPassId: string | null;
  onOpenPass: (passId: string) => void;
  /** The guide, in its wide or compact shell (D-72). */
  passDetail: ReactNode;
  MoonLore: LazyExoticComponent<typeof MoonLoreComponent> | undefined;
  /** The browser's geolocation, for tests; the app reads the real one. */
  geolocation?: GeolocationEnv;
}

/**
 * FR-FIRST-1, FR-FIRST-4, FR-FIRST-5: the home page's main. The Where reading
 * always; When and What once there is a place.
 */
export function Home({ offersInert, guide, shareNotice, selectedPassId, onOpenPass, passDetail, MoonLore, geolocation }: HomeProps) {
  const observer = useAppStore((s) => s.observer);
  const now = useAppStore((s) => s.now);
  // R30: the tradition line needs a Moon, which arrives with the Now state for this observer.
  const moon = now.observer === observer ? (now.state?.moon ?? null) : null;
  return (
    <>
      <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
        <WhereReading offersInert={offersInert} {...(geolocation ? { geolocation } : {})} />
        {observer && (
          <Region step="when" className={`${styles.reading} ${styles.when}`} testId="reading-when">
            <NextEventHost />
            <DarkWindow observer={observer} />
            <NowPanel />
            {MoonLore && moon && (
              <Suspense fallback={null}>
                <MoonLore moon={moon} timeZone={observer.timeZone} />
              </Suspense>
            )}
          </Region>
        )}
      </div>
      {observer && (
        <div className={styles.column} data-testid="col-right" data-guide={guide}>
          <Region step="what" className={`${styles.reading} ${styles.listColumn}`} testId="list-column">
            {shareNotice && (
              <Banner variant="info" testId="share-fallback">
                {shareNotice}
              </Banner>
            )}
            <PassList onOpenPass={onOpenPass} selectedPassId={selectedPassId} />
          </Region>
          {passDetail}
        </div>
      )}
    </>
  );
}
