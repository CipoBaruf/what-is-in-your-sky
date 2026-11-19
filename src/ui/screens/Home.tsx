import { Suspense, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type LazyExoticComponent, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import type { ExampleOutcome } from '../../lib/exampleOutcome';
import type { Observer } from '../../model';
import { SEARCH_WINDOW_HOURS, searchPlaces, useActiveObserver, useAppStore } from '../../state';
import { count } from '../../state/measure';
import styles from '../App.module.css';
import { Banner } from '../components/common/Banner';
import { InstallHint } from '../components/common/InstallHint';
import { ReadinessLine } from '../components/common/ReadinessLine';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { ElementsLine } from '../components/elements/ElementsLine';
import { Favourites } from '../components/location/Favourites';
import { LocationInput } from '../components/location/LocationInput';
import type { GeolocationEnv } from '../components/location/UseMyLocation';
import { WhereOpenedStatus, WherePlace } from '../components/location/WherePlace';
import type { MoonLore as MoonLoreComponent } from '../components/moon/MoonLore';
import { ConditionsTable } from '../components/now/ConditionsTable';
import { TonightStripe } from '../components/now/TonightStripe';
import { useTonight } from '../components/now/useTonight';
import { NextEventBlock } from '../components/passes/NextEventBlock';
import { PassList } from '../components/passes/PassList';
import { TextButton } from '../components/primitives/TextButton';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useOwnObserver } from '../hooks/useOwnObserver';
import { clearPlaceRequest, placeRequested } from './home/placeRequest';
import { WHAT_ID } from './home/doorLines';
import { ExampleBand, isDay } from './home/ExampleBand';
import { HomeDoors } from './home/HomeDoors';
import { usePassContext, useShownPasses } from './home/shownPasses';

/**
 * R76 (FR-FIRST-1..FR-FIRST-6, D-443, D-444): the home page as three readings —
 * **where**, **when**, **what**. Nothing here changes how any component
 * writes the store; this is where they sit, and the stylesheet
 * (`App.module.css`) decides whether the three stack (compact), take
 * FR-DESK-2's two columns with Where above When (wide), or are three equal
 * panes (from `HOME_THREE_PANE_MIN_PX`).
 *
 * R202 (FR-OPEN-3..6, FR-FIRST-1 and FR-FIRST-4 as amended v2.16; D-1178):
 * a first visit — no saved and no visited place — draws the example: on a
 * phone the tagline, the example band and the stacked page for the zone's
 * city; on a desk the populated panes, the Where pane holding the label and
 * the action. Where there is no example (FR-OPEN-6) the page is the place
 * question, the cold open of FR-FIRST-1 without its step line: on a phone the
 * question, its sentence and the input group; on a desk the three panes, When
 * and What drawn dimmed as what they will hold. The same question is what
 * `[ Not there? Set your place ]` opens, with `[ back ]`. Setting a place by
 * any way in lands on the stacked page or the panes, with no step between.
 *
 * R81 (FR-FIRST-3..11 as amended v2.0.2, D-505..D-512): populated, the panes
 * hold what board 1B draws, under plain headings (`── Where ──`) with 0.75 rem
 * between blocks — Where the place and its sentence, the dome on wide, the
 * readiness and elements lines and the saved places; When tonight's stripe,
 * the conditions table, the Moon's tradition line and the next event; What the
 * count and sort line and the one-line cards. The phone's stacked page is the
 * same components in the same order, without the dome.
 *
 * R130 (FR-FLOW-1, FR-FLOW-2; D-843, D-844): the three doors (`HomeDoors`)
 * stand over the Where reading on compact (R156, FR-PHONE-12, D-972) and in one
 * row over the panes on wide; the next event and the When pane's stars line are theirs now, and the
 * Where pane's dome is gone, whose job the Both door does. On compact the Where
 * reading is the place with `[ change ]`, the rest at the top of the group it opens (`WherePlace`'s `folded`,
 * D-1024).
 *
 * The two columns' wrappers (`col-left`, `col-right`) are kept, because between
 * the wide breakpoint and the three-pane width the page *is* those two columns
 * and D-253's guide rules are written against the right one. At three-pane
 * widths the stylesheet dissolves them (`display: contents`), so the three
 * regions and the guide panel are the page grid's own items, and an open pass
 * (`data-guide="pane"`) is the panel placed across the Where and When columns
 * with the list left in What (D-444).
 */
type Reading = 'where' | 'when' | 'what';

/**
 * FR-FIRST-5 as amended v2.0.2: a populated reading's character-rule heading is
 * the plain word — `── When ──`, the title in `--fg` and the rules in
 * `--fg-dim` — the numbers being the cold open's.
 */
function Region({ step, className, testId, id, children }: { step: Reading; className: string; testId: string; id?: string; children: ReactNode }) {
  const t = useT();
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={className} data-testid={testId} data-reading={step} data-rhythm="section">
      <SectionHeading id={headingId}>{t.home.panes[step]}</SectionHeading>
      {children}
    </section>
  );
}

/** R202 (FR-OPEN-5, FR-OPEN-6; D-1178): the place question as its own screen — the fallback, or what the action opens. */
interface Ask {
  /** FR-OPEN-5: `[ back ]` to the example, above the heading; absent on the fallback. */
  onBack?: (() => void) | undefined;
  /** FR-OPEN-6: the fallback carries the tagline above its heading on compact. */
  tagline: boolean;
  /** A typed coordinate pair is waiting to be left (blur or `Enter`) before the page moves on (D-467). */
  onSettle?: (() => void) | undefined;
}

/** D-1179: the Where reading under the example — the label and the action where a place has its line and `[ change ]`. */
interface WhereExample {
  /** The example; null for the moment before the zone's city is known. */
  observer: Observer | null;
  /** FR-OPEN-4: the run is not ready, so the line under the label is `example.finding`. */
  pending: boolean;
  /** FR-OPEN-5: on wide the group is open in place, with `[ back ]` under it. */
  open: boolean;
  onSetPlace: () => void;
  onBack: () => void;
}

/** `[01] Where`, `02 When`: the wide cold open's pane headings (FR-FIRST-1), the active one bracketed. */
const paneLabel = (index: number, current: boolean, word: string): string => (current ? `[0${String(index)}] ${word}` : `0${String(index)} ${word}`);

/**
 * FR-FIRST-1 as amended v2.16 (board 1B): the question's head. On a phone `[ back ]` or the tagline, the question
 * and its sentence; in the wide Where pane the pane's own heading, in the accent, and the question alone, the
 * precision note at the group's foot saying what the sentence says.
 */
function ColdHead({ headingId, ask }: { headingId: string; ask: Ask | undefined }) {
  const t = useT();
  const mode = useLayoutMode();
  const paneHeadingId = useId();
  if (mode === 'wide') {
    return (
      <>
        <SectionHeading id={paneHeadingId} tone="active">
          {paneLabel(1, true, t.home.panes.where)}
        </SectionHeading>
        <h2 id={headingId} className={styles.coldHeading}>
          {t.home.coldHeading}
        </h2>
      </>
    );
  }
  return (
    <>
      {ask?.onBack && (
        <p className={styles.back}>
          <TextButton inline label={t.example.back} data-testid="place-back" onClick={ask.onBack} />
        </p>
      )}
      {ask?.tagline === true && (
        <p className={styles.tagline} data-testid="home-tagline">
          {t.app.tagline}
        </p>
      )}
      <h2 id={headingId} className={styles.coldHeading}>
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
        {paneLabel(2, false, t.home.panes.when)}
      </SectionHeading>
      <p className={styles.ghostHeading}>{t.home.ghost.whenHeading}</p>
      <pre className={styles.ghostStripe}>
        {'18   20   22   00   02   04   06\n'}
        <span className={styles.ghostBar}>{'▓▓▓▒████████████████████▒▓▓▓▓▓'}</span>
      </pre>
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
        {paneLabel(3, false, t.home.panes.what)}
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
  /** R202 (D-1178): the place question as a screen — the cold open's look whether or not a place is set yet. */
  ask?: Ask | undefined;
  /** R202 (D-1179): the example is the observer. */
  example?: WhereExample | undefined;
  /** R87, R202 (FR-OPEN-5): the reader asked to set a place, so the focus goes into the group. */
  focusGroup?: boolean;
}

/**
 * FR-FIRST-1, FR-FIRST-2, FR-FIRST-11: the Where reading — the place question
 * with no place, and with one the place and its sentence (`WherePlace`), the
 * readiness line, the elements line and the saved places, each one line (R81,
 * D-511) — on compact folded behind `[ change ]`, at the top of the group it opens (R130, D-844; D-1024).
 *
 * The input group is one mounted instance across the states, in the same
 * place in the tree, and only shown or hidden (D-467). A coordinate pair
 * becomes an observer at its first valid keystroke and an invalid one drops it,
 * so a group that belonged to either state alone would be torn down under the
 * reader's fingers the moment their typing parsed — the field gone, and the
 * focus with it. For the same reason, when the place arrives while the reader
 * is typing in the group, it stays open under the place; when it arrives any
 * other way — the device button, a saved place — the group folds away.
 *
 * R202 (FR-OPEN-5, D-1178): on a phone the question is a screen of its own
 * (`ask`), and keeps the cold open's look until the page moves on — also while
 * a typed pair is already the observer. A pair that is waiting moves the page
 * on when the focus leaves the screen or on `Enter` (`ask.onSettle`), never on
 * the keystroke; while it waits `[ continue ]` stands under the coordinate
 * fields and does the same (R84, F-86). The group is never handed the example:
 * its fields are the reader's own place or empty (FR-OPEN-2).
 *
 * D-1179: under the example the reading is the label and the action, and on
 * wide the action opens the group in place with `[ back ]` under it.
 */
export function WhereReading({ offersInert, geolocation, ask, example, focusGroup = false }: WhereReadingProps) {
  const t = useT();
  const mode = useLayoutMode();
  const observer = useOwnObserver();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const cold = observer === null || ask !== undefined;
  // The question's look: the fallback and the compact screen. Under the example the reading keeps a pane's look.
  const question = cold && (example === undefined || ask !== undefined);
  // R130 (FR-FLOW-2, D-844; D-1024): on compact the populated Where is the place with `[ change ]`, which opens the group with
  // the rest at its top.
  const folded = mode === 'compact';
  const rest = (
    <>
      <ReadinessLine form="line" />
      <ElementsLine />
      <Favourites form="line" />
    </>
  );
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
  // R87: the request is spent here, by the group that takes it, so a later mount of the group is an ordinary one.
  useEffect(() => {
    if (!focusGroup) return;
    clearPlaceRequest();
    group.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [focusGroup]);
  const settle = ask?.onSettle;
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
  const inPlace = !question && example !== undefined;
  const groupHidden = question ? false : inPlace ? !example.open : !open;
  return (
    <section
      {...(question ? {} : { 'aria-labelledby': headingId })}
      className={question ? `${styles.cold} ${styles.where}` : `${styles.reading} ${styles.where}`}
      data-testid={question ? 'cold-open' : 'reading-where'}
      data-reading="where"
      data-rhythm="section"
      {...(ask ? { 'data-step': 'where' } : {})}
      {...settling}
    >
      {/* R28 (D-154): both offers sit at the head of the page, inside the region the open sheet makes inert
          and outside the live route. R49 (F-30): on wide nothing around them is made inert, so they are told
          directly. They head the cold open too: they are the page's statements about the app itself, shown
          only while a new version waits or the browser offers the install (FR-OFF-1, FR-OFF-6), and FR-FIRST-6
          removes nothing the page had. */}
      <UpdateBanner inert={offersInert} />
      <InstallHint inert={offersInert} />
      {question ? <ColdHead headingId={coldHeadingId} ask={ask} /> : <SectionHeading id={headingId}>{t.home.panes.where}</SectionHeading>}
      {/* FR-FIRST-11: the place, its sentence, and `[ change ]` opening the group in place (FR-SET-3). */}
      {!cold && (
        <WherePlace
          folded={folded}
          open={open}
          controls={groupId}
          onToggle={() => {
            setOpen((o) => !o);
          }}
        />
      )}
      {inPlace && <ExampleWhere example={example} controls={groupId} pane={!folded} />}
      <div id={groupId} ref={group} hidden={groupHidden} className={styles.locationGroup}>
        {/* D-1024: on compact the status heads the group `[ change ]` opens, mounted only while it is open. */}
        {!cold && folded && open ? <WhereOpenedStatus>{rest}</WhereOpenedStatus> : null}
        {/* The saved places are the cold open's inside the group; with a place they are the reading's own line (FR-FIRST-11). */}
        <LocationInput
          variant="group"
          look={mode === 'compact' ? 'boxed' : 'plain'}
          {...(question ? { labelledBy: coldHeadingId } : {})}
          observer={observer}
          onObserver={setObserver}
          onClear={clearSavedObserver}
          search={searchPlaces}
          showFavourites={cold}
          {...(geolocation ? { geolocation } : {})}
          {...(settle
            ? {
                // R84 (F-86): `[ continue ]` under the coordinate fields — the accent's box, 48 px tall, the width of the fields (R104: `TextButton`'s `box="accent"` with `fill`).
                afterCoords: <TextButton box="accent" fill label={t.location.continue} data-testid="step-continue" onClick={settle} />,
              }
            : {})}
        />
      </div>
      {/* FR-OPEN-5: on wide `[ back ]` stands under the group the action opened in place. */}
      {inPlace && example.open && (
        <p className={styles.back}>
          <TextButton inline label={t.example.back} data-testid="place-back" onClick={example.onBack} />
        </p>
      )}
      {!cold && !folded && rest}
      {/* FR-OPEN-4: the example's pane keeps the elements line; nothing of it is saved, so no readiness line and no place to save. */}
      {inPlace && !folded && !example.open && <ElementsLine />}
    </section>
  );
}

/** FR-OPEN-14 (D-1211): "Satellites are only visible after dusk." while the stripe's band at now is the day's. */
function DayLine({ observer }: { observer: Observer }) {
  const t = useT();
  const tonight = useTonight(observer);
  if (!isDay(tonight.bands, tonight.now)) return null;
  return (
    <p className={styles.exampleLine} data-testid="where-example-after-dusk">
      {t.example.afterDusk}
    </p>
  );
}

/**
 * D-1179 (FR-OPEN-4, FR-OPEN-14): the example's lines in the Where reading — the label, and in the wide pane
 * `example.finding` until the run is ready and the day line, then the action: the accent's box in the pane, a
 * bracketed control on the phone, whose band over the doors carries the boxed one and those two lines.
 */
function ExampleWhere({ example, controls, pane }: { example: WhereExample; controls: string; pane: boolean }) {
  const t = useT();
  const { observer } = example;
  const name = observer?.label ?? null;
  return (
    <div className={styles.exampleWhere} data-testid="where-example">
      <p className={styles.exampleLine} data-testid="where-example-label">
        {name === null ? ' ' : t.example.label(name)}
      </p>
      {pane && example.pending && name !== null && (
        <p className={styles.exampleLine} role="status" data-testid="where-example-finding">
          {t.example.finding(name)}
        </p>
      )}
      {pane && observer && !example.pending && <DayLine observer={observer} />}
      {!example.open && (
        <TextButton {...(pane ? { box: 'accent' as const, fill: true } : { inline: true })} label={t.example.setPlace} aria-expanded={false} aria-controls={controls} data-testid="where-set-place" onClick={example.onSetPlace} />
      )}
    </div>
  );
}

/**
 * FR-FIRST-8, FR-FIRST-9, FR-FIRST-3 (R81): the When reading — tonight's
 * stripe, the conditions table with the Moon's tradition line under it
 * (FR-MOON-4). The stripe and the table read one set of bands (`useTonight`),
 * so they cannot disagree. R130 (D-843): the next event is the Satellites
 * door's now, at both widths, so R93's rule placing it under the stripe on the
 * two columns went with it.
 */
function WhenReading({ observer, MoonLore, selectedPassId, example }: { observer: Observer; MoonLore: HomeProps['MoonLore']; selectedPassId: string | null; example?: 'pending' | 'pass' | undefined }) {
  const now = useAppStore((s) => s.now);
  // R97: the open pass is kept here as the list keeps it, so the stripe's ticks and the list's count agree.
  const passes = useShownPasses(selectedPassId);
  const tonight = useTonight(observer);
  // R30: the tradition line needs a Moon, which arrives with the Now state for this observer.
  const moon = now.observer === observer ? (now.state?.moon ?? null) : null;
  const { elementCount, hasDarkness } = usePassContext();
  return (
    <Region step="when" className={`${styles.reading} ${styles.when}`} testId="reading-when">
      <TonightStripe bands={tonight.bands} passes={passes} observer={observer} now={tonight.now} />
      <ConditionsTable observer={observer} bands={tonight.bands} sampledFrom={tonight.sampledFrom} now={tonight.now} />
      {MoonLore && moon && (
        <Suspense fallback={null}>
          <MoonLore moon={moon} timeZone={observer.timeZone} />
        </Suspense>
      )}
      {/* R202 (FR-OPEN-4, FR-OPEN-12; D-1179): under the example the wide When pane ends with the next event, in words; until the run is ready it holds its height and shows nothing. */}
      {example === 'pass' && <NextEventBlock plain liveLink={false} passes={passes} timeZone={observer.timeZone} context={{ elementCount, hasDarkness }} hours={SEARCH_WINDOW_HOURS} />}
      {example === 'pending' && <div className={styles.nextHold} data-testid="next-event-hold" />}
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
  /** R202 (D-1178): the first visit's state, held by `App` so the footer can take its `line` form while the question is a screen. */
  place: PlaceOpen;
}

/** What moves the question on: a different place, not a new object for the same one (the forecast's zone replaces it, and D-1025's town name a device fix's label). */
const placeKey = (observer: Observer | null): string | null => (observer === null ? null : `${String(observer.lat)},${String(observer.lon)},${String(observer.altM)},${observer.source === 'device' ? 'device' : observer.label}`);

/** Whether a text field has the focus: a coordinate pair that parsed under the reader's fingers (D-467). */
function typingInAField(): boolean {
  return typeof document !== 'undefined' && document.activeElement instanceof HTMLInputElement;
}

/** D-1178: the outcomes that draw the example; every other one draws the place question (FR-OPEN-6). */
const SHOWN: readonly ExampleOutcome[] = ['pending', 'pass'];

/**
 * R202 (FR-OPEN-3..6; D-1178, in place of R82's `useSteps`): the first visit as the page's own state — not stored,
 * not in the hash. A first visit is a load with no saved and no visited place (`useOwnObserver`); in it the example
 * is drawn while its outcome is `pending` or `pass`, and the place question for every other outcome (`fallback`).
 * `open` is the question opened from the example's action; setting a place closes it, so the next render is the
 * stacked page or the panes.
 *
 * A typed pair is the observer at its first valid keystroke, and moving the page then would take the field from
 * under the reader (D-467), so on a phone the question's screen is `held` until the field is left, `Enter` is
 * pressed or `[ continue ]` is (`settle`).
 *
 * `asking` is the question as a screen of its own: the fallback, the compact form of `open`, a `[ set a place ]`
 * request and a held pair. The state is `App`'s, which never unmounts, so `offHome` stands in for the unmounting
 * the other routes used to do (R87): crossing it closes the question.
 *
 * Before the zone's city is known nothing is latched and there is no example yet: the page holds the example's
 * shape (`showing` with no observer) unless this load has had a place, which is a reader who dropped it.
 */
export function usePlaceOpen(offHome = false) {
  const compact = useLayoutMode() === 'compact';
  const active = useActiveObserver();
  const own = useOwnObserver();
  const outcome = useAppStore((s) => s.exampleOutcome);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const [hadPlace, setHadPlace] = useState(own !== null);
  const key = placeKey(own);
  const [seen, setSeen] = useState(key);
  const [away, setAway] = useState(offHome);
  if (own !== null && !hadPlace) setHadPlace(true);
  if (offHome !== away) {
    setAway(offHome);
    setOpen(false);
    setHeld(false);
    setSeen(key);
  } else if (key !== seen) {
    setSeen(key);
    if (own === null) setHeld(false);
    else if (own.source === 'coords' && typingInAField() && (seen === null || held)) setHeld(true);
    else {
      setHeld(false);
      setOpen(false);
    }
  }
  const first = own === null;
  const showing = first && SHOWN.includes(outcome) && (active !== null || (outcome === 'pending' && !hadPlace));
  const fallback = first && !showing;
  const requested = first && placeRequested();
  return {
    /** The example is on the page, or its shape for the moment before the city is known. */
    showing,
    /** FR-OPEN-6: a first visit with no example. */
    fallback,
    /** The question is the page's one screen (compact) or its cold open (wide fallback). */
    asking: fallback || (compact && (requested || (showing && open) || held)),
    /** FR-OPEN-5: the question is open over the example. */
    open: showing && (open || requested),
    held: compact && held,
    /** FR-OPEN-4: the example's run is not ready. */
    pending: outcome === 'pending',
    openPlace: (): void => {
      setOpen(true);
    },
    back: (): void => {
      setOpen(false);
    },
    settle: (): void => {
      setHeld(false);
      setOpen(false);
    },
  };
}

type PlaceOpen = ReturnType<typeof usePlaceOpen>;

/**
 * FR-FIRST-1, FR-FIRST-4, FR-FIRST-5 as amended v2.16: the home page's main. With a place the three readings; on a
 * first visit the example over them, or the place question (R202, D-1178).
 */
export function Home({ offersInert, guide, shareNotice, selectedPassId, onOpenPass, passDetail, MoonLore, geolocation, place }: HomeProps) {
  const observer = useActiveObserver();
  const mode = useLayoutMode();
  const t = useT();
  /*
   * R87 (FR-FIRST-1 as amended v2.1): `[ set a place ]` on the live page lands here with the focus in the group.
   * The request is read on every render and spent by the group that takes the focus, not held for the page's
   * life: held, it would take the focus again on every later mount of the group. Over the example it opens the
   * question as the action does (FR-OPEN-5), which outlives the request.
   */
  const placeRequest = placeRequested();
  const { showing, fallback, asking, open, openPlace, back } = place;
  useEffect(() => {
    if (placeRequest && showing) openPlace();
  });
  // FR-MEAS-2 as amended v2.16 (D-1182): the place group shown on a first visit — from the action, or as the fallback.
  const shown = fallback || open;
  useEffect(() => {
    if (shown) count('where_shown', fallback ? 'fallback' : 'example');
  }, [shown, fallback]);
  // FR-OPEN-5: `[ back ]` hands the focus to the action it came from, which is on the page again.
  const returnTo = useRef(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) setWasOpen(open);
  useEffect(() => {
    if (wasOpen) {
      returnTo.current = true;
      return;
    }
    if (!returnTo.current) return;
    returnTo.current = false;
    document.querySelector<HTMLElement>('[data-testid="example-set-place"], [data-testid="where-set-place"]')?.focus();
  }, [wasOpen]);
  const focusGroup = placeRequest || open;

  if (asking && mode === 'compact') {
    return (
      <>
        <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
          <WhereReading
            offersInert={offersInert}
            {...(geolocation ? { geolocation } : {})}
            focusGroup={focusGroup}
            ask={{ tagline: fallback, onBack: open ? back : undefined, onSettle: place.held ? place.settle : undefined }}
          />
        </div>
        {/* The guide is a sheet over the page on a phone: a pass opened from a link stands over the question. */}
        {passDetail && (
          <div className={styles.column} data-testid="col-right" data-guide={guide}>
            {passDetail}
          </div>
        )}
      </>
    );
  }
  // FR-OPEN-6: the wide fallback is the cold open — no reading is drawn, whatever the example's run came to.
  const lit = fallback ? null : observer;
  const ghosts = fallback && mode === 'wide';
  const pending = showing && (place.pending || lit === null);
  const example: WhereExample | undefined = showing ? { observer: lit, pending, open, onSetPlace: openPlace, onBack: back } : undefined;
  // R130 (FR-FLOW-1, D-843): the three doors — one row over the panes on wide. R156 (FR-PHONE-12, D-972): on compact
  // they come first too, before the Where reading, so the phone opens on the three ways in.
  const doors = lit && <HomeDoors observer={lit} selectedPassId={selectedPassId} plain={showing} {...(mode === 'wide' ? { className: styles.doors } : {})} />;
  return (
    <>
      {mode === 'wide' && doors}
      <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
        {/* FR-OPEN-3: the compact first visit opens on the tagline and the example band, over the stacked page. */}
        {showing && mode !== 'wide' && (
          <div className={styles.first} data-testid="first-visit">
            <p className={styles.tagline} data-testid="home-tagline">
              {t.app.tagline}
            </p>
            <ExampleBand observer={lit} pending={pending} onSetPlace={openPlace} onOpenPass={onOpenPass} selectedPassId={selectedPassId} />
          </div>
        )}
        {mode !== 'wide' && doors}
        <WhereReading offersInert={offersInert} {...(geolocation ? { geolocation } : {})} focusGroup={focusGroup} example={example} />
        {ghosts && <GhostWhen />}
        {lit && <WhenReading observer={lit} MoonLore={MoonLore} selectedPassId={selectedPassId} example={showing && mode === 'wide' ? (pending ? 'pending' : 'pass') : undefined} />}
      </div>
      {ghosts && (
        <div className={styles.column} data-testid="col-right">
          <GhostWhat />
        </div>
      )}
      {lit && (
        <div className={styles.column} data-testid="col-right" data-guide={guide}>
          <Region step="what" id={WHAT_ID} className={`${styles.reading} ${styles.listColumn}`} testId="list-column">
            {shareNotice && (
              <Banner variant="info" testId="share-fallback">
                {shareNotice}
              </Banner>
            )}
            <PassList onOpenPass={onOpenPass} selectedPassId={selectedPassId} plain={showing} />
          </Region>
          {passDetail}
        </div>
      )}
    </>
  );
}
