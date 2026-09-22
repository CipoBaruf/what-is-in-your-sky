import { Suspense, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type LazyExoticComponent, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import type { Observer, Pass } from '../../model';
import { searchPlaces, SEARCH_WINDOW_HOURS, useAppStore } from '../../state';
import styles from '../App.module.css';
import { Banner } from '../components/common/Banner';
import { InstallHint } from '../components/common/InstallHint';
import { ReadinessLine } from '../components/common/ReadinessLine';
import { SectionHeading } from '../components/common/SectionHeading';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { ElementsLine } from '../components/elements/ElementsLine';
import { Favourites } from '../components/location/Favourites';
import { LocationInput } from '../components/location/LocationInput';
import type { GeolocationEnv } from '../components/location/UseMyLocation';
import { WhereDome } from '../components/location/WhereDome';
import { WherePlace } from '../components/location/WherePlace';
import type { MoonLore as MoonLoreComponent } from '../components/moon/MoonLore';
import { ConditionsTable } from '../components/now/ConditionsTable';
import { TonightStripe } from '../components/now/TonightStripe';
import { useTonight } from '../components/now/useTonight';
import { NextEventBlock } from '../components/passes/NextEventBlock';
import { PassList } from '../components/passes/PassList';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { StepLine, stepLabel, STEPS, type Step } from './home/StepLine';
import { usePassContext, useShownPasses } from './home/shownPasses';
import { WhatStep } from './home/WhatStep';
import { WhenStep } from './home/WhenStep';
import stepStyles from './home/Steps.module.css';

/**
 * R76 (FR-FIRST-1..FR-FIRST-6, D-443, D-444): the home page as three readings —
 * **where**, **when**, **what**. Nothing here changes how any component
 * writes the store; this is where they sit, and the stylesheet
 * (`App.module.css`) decides whether the three stack (compact), take
 * FR-DESK-2's two columns with Where above When (wide), or are three equal
 * panes (from `HOME_THREE_PANE_MIN_PX`).
 *
 * With no observer there is nothing to read yet, and the page is the cold open
 * (FR-FIRST-1 as amended v2.0.2, board 1B): on a phone the step line, the
 * question and its sentence, and the input group with its foot at the bottom
 * of the screen; on a desk the three panes, Where holding the question and
 * the group and When and What drawn dimmed as what they will hold. No
 * conditions, no readiness line, no list, and no line about elements — those
 * are about a place, and there is none.
 *
 * R81 (FR-FIRST-3..11 as amended v2.0.2, D-505..D-512): populated, the panes
 * hold what board 1B draws, under plain headings (`── Where ──`) with 0.75 rem
 * between blocks — Where the place and its sentence, the dome on wide, the
 * readiness and elements lines and the saved places; When tonight's stripe,
 * the conditions table, the Moon's tradition line and the next event; What the
 * count and sort line and the one-line cards. The phone's stacked page is the
 * same components in the same order, without the dome.
 *
 * The two columns' wrappers (`col-left`, `col-right`) are kept, because between
 * the wide breakpoint and the three-pane width the page *is* those two columns
 * and D-253's guide rules are written against the right one. At three-pane
 * widths the stylesheet dissolves them (`display: contents`), so the three
 * regions and the guide panel are the page grid's own items, and an open pass
 * (`data-guide="pane"`) is the panel placed across the Where and When columns
 * with the list left in What (D-444).
 */
export { STEPS, StepLine, stepLabel, type Step } from './home/StepLine';

/**
 * FR-FIRST-5 as amended v2.0.2: a populated reading's character-rule heading is
 * the plain word — `── When ──`, the title in `--fg` and the rules in
 * `--fg-dim` — the numbers being the cold open's and the steps'.
 */
function Region({ step, className, testId, children }: { step: Step; className: string; testId: string; children: ReactNode }) {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className} data-testid={testId} data-reading={step}>
      <SectionHeading id={headingId}>{t.home.panes[step]}</SectionHeading>
      {children}
    </section>
  );
}

/** R82 (FR-FIRST-4 as amended v2.0.2, D-513): the phone's where step, as the Where reading draws it on a first visit. */
interface WhereStep {
  /** The furthest step this visit has reached, for the step line's finished items. */
  reached: Step;
  onGo: (step: Step) => void;
  /** Take the focus on arrival: the reader came back here with `[ edit ]` or the step line. */
  focus: boolean;
  /** A typed coordinate pair is waiting to be left (blur or `Enter`) before the page moves on (D-467). */
  onSettle?: () => void;
}

/**
 * FR-FIRST-1 (board 1B): the cold open's head. On a phone the step line, the
 * question and its sentence; in the wide Where pane the pane's own heading —
 * the step line's first item, in the accent — and the question alone, the
 * precision note at the group's foot saying what the sentence says.
 */
function ColdHead({ headingId, step }: { headingId: string; step: WhereStep | undefined }) {
  const t = useT();
  const mode = useLayoutMode();
  const paneHeadingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focus = step?.focus === true && mode !== 'wide';
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  if (mode === 'wide') {
    return (
      <>
        <SectionHeading id={paneHeadingId} tone="active">
          {stepLabel('where', true, t.home.panes.where)}
        </SectionHeading>
        <h2 id={headingId} className={styles.coldHeading}>
          {t.home.coldHeading}
        </h2>
      </>
    );
  }
  return (
    <>
      <StepLine current="where" {...(step ? { reached: step.reached, onGo: step.onGo } : {})} />
      <h2 id={headingId} ref={heading} className={styles.coldHeading} {...(step ? { tabIndex: -1 } : {})}>
        {t.home.coldHeading}
      </h2>
      <p className={styles.coldSentence}>{t.home.coldSentence}</p>
    </>
  );
}

/**
 * FR-FIRST-1 (board 1B): the wide cold open's two dimmed panes — what When and
 * What will hold, drawn so the layout is on the screen before the place is.
 * They are pictures: `aria-hidden`, and nothing in them is a control.
 */
function GhostWhen() {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-hidden="true" className={`${styles.ghost} ${styles.when}`} data-testid="ghost-when">
      <SectionHeading id={headingId} tone="muted">
        {stepLabel('when', false, t.home.panes.when)}
      </SectionHeading>
      <p className={styles.ghostHeading}>{t.home.ghost.whenHeading}</p>
      <pre className={styles.ghostStripe}>{'18   20   22   00   02   04   06\n▓▓▓▒████████████████████▒▓▓▓▓▓'}</pre>
      <p className={styles.ghostNote}>{t.home.ghost.whenSentence}</p>
    </section>
  );
}

function GhostWhat() {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-hidden="true" className={`${styles.ghost} ${styles.listColumn}`} data-testid="ghost-what">
      <SectionHeading id={headingId} tone="muted">
        {stepLabel('what', false, t.home.panes.what)}
      </SectionHeading>
      <p className={styles.ghostHeading}>{t.home.ghost.whatHeading}</p>
      <p className={styles.ghostCard}>{t.home.ghost.whatCard}</p>
    </section>
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
  /** R82 (D-513): the phone's first visit — the cold open's look whether or not a place is set yet. */
  step?: WhereStep;
}

/**
 * FR-FIRST-1, FR-FIRST-2, FR-FIRST-11: the Where reading — the cold open with
 * no observer, and with one the place and its sentence (`WherePlace`), the
 * dome on wide, the readiness line, the elements line and the saved places,
 * each one line (R81, D-511).
 *
 * The input group is one mounted instance across the two states, in the same
 * place in the tree, and only shown or hidden (D-467). A coordinate pair
 * becomes an observer at its first valid keystroke and an invalid one drops it,
 * so a group that belonged to either state alone would be torn down under the
 * reader's fingers the moment their typing parsed — the field gone, and the
 * focus with it. For the same reason, when the place arrives while the reader
 * is typing in the group, it stays open under the place; when it arrives any
 * other way — the device button, a saved place — the group folds away.
 *
 * R82 (D-513): on the phone's first visit this is the **where** step, and it
 * keeps the cold open's look until the page moves on — also while a typed pair
 * is already the observer, and when `[ edit ]` brings the reader back with a
 * place set. A pair that is waiting moves the page on when the focus leaves
 * the step or on `Enter` (`step.onSettle`), never on the keystroke.
 *
 * R84 (FR-FIRST-2 as amended v2.1, D-548, F-86): while a pair waits, which is
 * exactly while `step.onSettle` is given, `[ continue ]` stands under the
 * coordinate fields and does the same, so the way forward is on the screen.
 */
export function WhereReading({ offersInert, geolocation, step }: WhereReadingProps) {
  const t = useT();
  const mode = useLayoutMode();
  const observer = useAppStore((s) => s.observer);
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const passes = useShownPasses();
  const cold = observer === null || step !== undefined;
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
  const settle = step?.onSettle;
  const settling = settle
    ? {
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) settle();
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) settle();
        },
      }
    : {};
  return (
    <section
      {...(cold ? {} : { 'aria-labelledby': headingId })}
      className={cold ? `${styles.cold} ${styles.where}` : `${styles.reading} ${styles.where}`}
      data-testid={cold ? 'cold-open' : 'reading-where'}
      data-reading="where"
      {...(step ? { 'data-step': 'where' } : {})}
      {...settling}
    >
      {/* R28 (D-154): both offers sit at the head of the page, inside the region the open sheet makes inert
          and outside the live route. R49 (F-30): on wide nothing around them is made inert, so they are told
          directly. They head the cold open too: they are the page's statements about the app itself, shown
          only while a new version waits or the browser offers the install (FR-OFF-1, FR-OFF-6), and FR-FIRST-6
          removes nothing the page had. */}
      <UpdateBanner inert={offersInert} />
      <InstallHint inert={offersInert} />
      {cold ? <ColdHead headingId={coldHeadingId} step={step} /> : <SectionHeading id={headingId}>{t.home.panes.where}</SectionHeading>}
      {/* FR-FIRST-11: the place, its sentence, and `[ change ]` opening the group in place (FR-SET-3). */}
      {!cold && (
        <WherePlace
          open={open}
          controls={groupId}
          onToggle={() => {
            setOpen((o) => !o);
          }}
        />
      )}
      <div id={groupId} ref={group} hidden={!cold && !open} className={styles.locationGroup}>
        {/* The saved places are the cold open's inside the group; with a place they are the reading's own line (FR-FIRST-11). */}
        <LocationInput
          variant="group"
          look={mode === 'compact' ? 'boxed' : 'plain'}
          {...(cold ? { labelledBy: coldHeadingId } : {})}
          observer={observer}
          onObserver={setObserver}
          onClear={clearSavedObserver}
          search={searchPlaces}
          showFavourites={cold}
          {...(geolocation ? { geolocation } : {})}
          {...(settle
            ? {
                afterCoords: (
                  <button type="button" className={stepStyles.continue} data-testid="step-continue" onClick={settle}>
                    {t.location.continue}
                  </button>
                ),
              }
            : {})}
        />
      </div>
      {observer && !cold && <WhereDome observer={observer} passes={passes} />}
      {!cold && <ReadinessLine form="line" />}
      {!cold && <ElementsLine />}
      {!cold && <Favourites form="line" />}
    </section>
  );
}

/** FR-FIRST-3's host on the home page: the stored run's passes, and why there may be none. */
function NextEventHost({ observer, passes }: { observer: Observer; passes: readonly Pass[] }) {
  const { elementCount, hasDarkness, pending } = usePassContext();
  return <NextEventBlock passes={passes} timeZone={observer.timeZone} context={{ hasDarkness, elementCount }} pending={pending} hours={SEARCH_WINDOW_HOURS} />;
}

/**
 * FR-FIRST-8, FR-FIRST-9, FR-FIRST-3 (R81): the When reading — tonight's
 * stripe, the conditions table with the Moon's tradition line under it
 * (FR-MOON-4), and the next event. The stripe and the table read one set of
 * bands (`useTonight`), so they cannot disagree.
 */
function WhenReading({ observer, MoonLore }: { observer: Observer; MoonLore: HomeProps['MoonLore'] }) {
  const now = useAppStore((s) => s.now);
  const passes = useShownPasses();
  const tonight = useTonight(observer);
  // R30: the tradition line needs a Moon, which arrives with the Now state for this observer.
  const moon = now.observer === observer ? (now.state?.moon ?? null) : null;
  return (
    <Region step="when" className={`${styles.reading} ${styles.when}`} testId="reading-when">
      <TonightStripe bands={tonight.bands} passes={passes} observer={observer} now={tonight.now} />
      <ConditionsTable observer={observer} bands={tonight.bands} sampledFrom={tonight.sampledFrom} now={tonight.now} />
      {MoonLore && moon && (
        <Suspense fallback={null}>
          <MoonLore moon={moon} timeZone={observer.timeZone} />
        </Suspense>
      )}
      <NextEventHost observer={observer} passes={passes} />
    </Region>
  );
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

/** What moves the where step on: a different place, not a new object for the same one (the forecast's zone replaces it). */
const placeKey = (observer: Observer | null): string | null => (observer === null ? null : `${String(observer.lat)},${String(observer.lon)},${String(observer.altM)},${observer.label}`);

/** Whether a text field has the focus: a coordinate pair that parsed under the reader's fingers (D-467). */
function typingInAField(): boolean {
  return typeof document !== 'undefined' && document.activeElement instanceof HTMLInputElement;
}

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513): the phone's first visit as three
 * steps. `step` is set once, at mount — `'where'` with no observer, `null`
 * (the stacked page) with one — and is the page's own state: not stored, not
 * in the hash, so every later visit, and a reload, opens on the stacked page.
 *
 * A place from the device button, a picked name or a saved place moves
 * `where` to `when`. A typed pair is the observer at its first valid
 * keystroke, and moving the page then would take the field from under the
 * reader (D-467), so it is held until the field is left or `Enter` is pressed.
 * On a desk there are no steps: the wide page is the cold open's three panes
 * and then the populated ones, whatever the step says.
 */
function useSteps(observer: Observer | null) {
  const [step, setStep] = useState<Step | null>(() => (observer === null ? 'where' : null));
  const [reached, setReached] = useState<Step>('where');
  const [moved, setMoved] = useState(false);
  const [held, setHeld] = useState(false);
  const key = placeKey(observer);
  const [seen, setSeen] = useState(key);
  const go = (next: Step): void => {
    setStep(next);
    setMoved(true);
    setHeld(false);
    setReached((current) => (STEPS.indexOf(next) > STEPS.indexOf(current) ? next : current));
  };
  if (key !== seen) {
    setSeen(key);
    if (observer === null) setHeld(false);
    else if (step === 'where') {
      if (observer.source === 'coords' && typingInAField()) setHeld(true);
      else go('when');
    }
  }
  return { step, reached, moved, held, go };
}

/**
 * FR-FIRST-1, FR-FIRST-4, FR-FIRST-5: the home page's main. The Where reading
 * always; When and What once there is a place — or, on a phone's first visit,
 * one step at a time (R82).
 */
export function Home({ offersInert, guide, shareNotice, selectedPassId, onOpenPass, passDetail, MoonLore, geolocation }: HomeProps) {
  const observer = useAppStore((s) => s.observer);
  const mode = useLayoutMode();
  const steps = useSteps(observer);
  const current: Step | null = mode === 'compact' && steps.step !== null ? (observer === null ? 'where' : steps.step) : null;
  if (current !== null) {
    const { reached, moved, go } = steps;
    const head = (step: Step) => (
      <>
        <UpdateBanner inert={offersInert} />
        <InstallHint inert={offersInert} />
        <StepLine current={step} reached={reached} onGo={go} />
      </>
    );
    return (
      <>
        <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
          {current === 'where' && (
            <WhereReading
              offersInert={offersInert}
              {...(geolocation ? { geolocation } : {})}
              step={{
                reached,
                onGo: go,
                focus: moved,
                ...(steps.held
                  ? {
                      onSettle: () => {
                        go('when');
                      },
                    }
                  : {}),
              }}
            />
          )}
          {current === 'when' && observer && (
            <WhenStep
              observer={observer}
              head={head('when')}
              focus={moved}
              onNext={() => {
                go('what');
              }}
            />
          )}
          {current === 'what' && observer && (
            <WhatStep
              observer={observer}
              head={head('what')}
              focus={moved}
              onEdit={() => {
                go('where');
              }}
              onOpenPass={onOpenPass}
              selectedPassId={selectedPassId}
            />
          )}
        </div>
        {/* The guide is a sheet over the page on a phone: a pass opened from a link stands over whichever step is showing. */}
        {passDetail && (
          <div className={styles.column} data-testid="col-right" data-guide={guide}>
            {passDetail}
          </div>
        )}
      </>
    );
  }
  const ghosts = observer === null && mode === 'wide';
  return (
    <>
      <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
        <WhereReading offersInert={offersInert} {...(geolocation ? { geolocation } : {})} />
        {ghosts && <GhostWhen />}
        {observer && <WhenReading observer={observer} MoonLore={MoonLore} />}
      </div>
      {ghosts && (
        <div className={styles.column} data-testid="col-right">
          <GhostWhat />
        </div>
      )}
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
