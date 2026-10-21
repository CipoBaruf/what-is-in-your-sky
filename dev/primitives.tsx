/**
 * R108 (FR-DS-6, FR-DS-9; D-706, D-728): the dev page — every primitive in
 * every state and tone, in both themes side by side, at compact and wide.
 *
 * A second Vite entry (`dev/primitives.html`) that `npm run dev` serves at
 * `/dev/primitives.html` and `vite build` never sees: `index.html` is the only
 * build input, so no chunk, no budget row and nothing deployed carries this.
 * It is also outside every Vitest project (they include `src/**` and
 * `tests/**` only) and outside the literals test (`src/**`), which is why its
 * own stylesheet may lay the two columns out as it likes.
 *
 * The page is driven by the manifest: it walks `PRIMITIVES` in order and draws
 * each row's specimens under the row's name, so a primitive added to the
 * manifest without a specimen here shows up on the page as the words
 * "no specimen", and `tests/e2e/design-captures.spec.ts` fails on the same
 * thing. The two columns are two `data-theme` subtrees — `tokens.css` restates
 * every colour under `[data-theme="night"]` and nothing else, so one page shows
 * both palettes with no second stylesheet — and the root carries
 * `data-compact` from the wide breakpoint, so a capture states the mode it was
 * shot in.
 *
 * Nothing here is copy of the app's: the primitives carry none (D-703), so the
 * words are placeholders in English and the capture set has no `-es` twin.
 */
import { createContext, StrictMode, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { WIDE_QUERY } from '../src/lib/layout';
import { BracketLink } from '../src/ui/components/primitives/BracketLink';
import { Card } from '../src/ui/components/primitives/Card';
import { Cluster } from '../src/ui/components/primitives/Cluster';
import { Field } from '../src/ui/components/primitives/Field';
import { Line } from '../src/ui/components/primitives/Line';
import { PRIMITIVES } from '../src/ui/components/primitives/manifest';
import { OptionToggle } from '../src/ui/components/primitives/OptionToggle';
import { Rule } from '../src/ui/components/primitives/Rule';
import { SectionHeading } from '../src/ui/components/primitives/SectionHeading';
import { Stack } from '../src/ui/components/primitives/Stack';
import { TextButton } from '../src/ui/components/primitives/TextButton';
import { ToggleGroup } from '../src/ui/components/primitives/ToggleGroup';
import { VisuallyHidden } from '../src/ui/components/primitives/VisuallyHidden';
import '../src/ui/styles/tokens.css';
import '../src/ui/styles/global.css';
import './primitives.css';

const THEMES = ['dark', 'night'] as const;
type Theme = (typeof THEMES)[number];

/** One variant of a primitive: the props it was given, as a caption, over the thing itself. */
function Case({ props, children }: { props: string; children: ReactNode }) {
  return (
    <div className="case" data-case={props}>
      <p className="caption">{props || 'defaults'}</p>
      <div className="specimen">{children}</div>
    </div>
  );
}

const noop = () => undefined;

function TextButtonCases() {
  return (
    <>
      <Case props="">
        <TextButton label="action" onClick={noop} />
      </Case>
      <Case props="tone">
        <Cluster>
          <TextButton label="accent" tone="accent" onClick={noop} />
          <TextButton label="dim" tone="dim" onClick={noop} />
          <TextButton label="danger" tone="danger" onClick={noop} />
        </Cluster>
      </Case>
      <Case props="disabled">
        <TextButton label="disabled" disabled onClick={noop} />
      </Case>
      <Case props="pressed">
        <Cluster>
          <TextButton label="pressed" pressed onClick={noop} />
          <TextButton label="not pressed" pressed={false} onClick={noop} />
        </Cluster>
      </Case>
      <Case props="pressed tight">
        <Cluster gap={1}>
          <TextButton label="1×" pressed={false} tight onClick={noop} />
          <TextButton label="60×" pressed tight onClick={noop} />
          <TextButton label="600×" pressed={false} tight onClick={noop} />
        </Cluster>
      </Case>
      <Case props="inline">
        <p className="prose">
          A line of prose with a control <TextButton label="hung off it" inline onClick={noop} /> and the line no taller.
        </p>
      </Case>
      <Case props="bare">
        <TextButton label="bare" bare onClick={noop} />
      </Case>
      <Case props="padded">
        <TextButton label="×" padded onClick={noop} aria-label="close" />
      </Case>
      <Case props='box="edge"'>
        <TextButton label="boxed" box="edge" onClick={noop} />
      </Case>
      <Case props='box="accent"'>
        <TextButton label="primary" box="accent" onClick={noop} />
      </Case>
      <Case props='box="accent" fill'>
        <TextButton label="the width of the column" box="accent" fill onClick={noop} />
      </Case>
      <Case props='box="accent" fill tall'>
        <TextButton label="tall" box="accent" fill tall onClick={noop} />
      </Case>
      <Case props='box="accent" note look="boxed"'>
        <TextButton label="use my location" box="accent" note="a line under the label, its description" look="boxed" onClick={noop} />
      </Case>
      <Case props='box="accent" note look="plain"'>
        <TextButton label="use my location" box="accent" note="the same control in the wide pane" look="plain" onClick={noop} />
      </Case>
      <Case props="wrap">
        <div className="narrow">
          <TextButton label="a saved place whose name is long enough to break" wrap onClick={noop} />
        </div>
      </Case>
      <Case props='as="summary"'>
        <details>
          <TextButton label="details" as="summary" />
          <p className="prose">What the summary opens.</p>
        </details>
      </Case>
    </>
  );
}

function BracketLinkCases() {
  return (
    <>
      <Case props="">
        <BracketLink href="#dev" label="a route" />
      </Case>
      <Case props="current">
        <BracketLink href="#dev" label="this page" current />
      </Case>
    </>
  );
}

function OptionToggleCases() {
  const [on, setOn] = useState(true);
  return (
    <>
      <Case props="pressed">
        <Cluster gap={1}>
          <OptionToggle label="on" pressed onPress={noop} />
          <OptionToggle label="off" pressed={false} onPress={noop} />
        </Cluster>
      </Case>
      <Case props="alone">
        <OptionToggle label="show hidden objects" pressed={on} onPress={() => setOn((v) => !v)} alone />
      </Case>
    </>
  );
}

const VIEWS = [
  { value: 'dome', label: 'dome' },
  { value: 'polar', label: 'polar' },
  { value: 'window', label: 'window' },
] as const;
const SORTS = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'best', label: 'Best' },
] as const;
const SPEEDS = [
  { value: '1', label: '1×' },
  { value: '60', label: '60×' },
  { value: '600', label: '600×' },
] as const;

function ToggleGroupCases() {
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('dome');
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('soonest');
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['value']>('60');
  return (
    <>
      <Case props='role="group" mark="check" prefix'>
        <ToggleGroup name="View" prefix="View:" options={VIEWS} value={view} onChange={setView} />
      </Case>
      <Case props='role="radiogroup" mark="check"'>
        <ToggleGroup name="View" options={VIEWS} value={view} onChange={setView} role="radiogroup" />
      </Case>
      <Case props='mark="bracket" prefix'>
        <ToggleGroup name="Sort" prefix="Sort:" options={SORTS} value={sort} onChange={setSort} mark="bracket" />
      </Case>
      <Case props='mark="tight"'>
        <ToggleGroup name="Speed" options={SPEEDS} value={speed} onChange={setSpeed} mark="tight" />
      </Case>
      <Case props='mark="tight" gap="none"'>
        <ToggleGroup name="Speed" options={SPEEDS} value={speed} onChange={setSpeed} mark="tight" gap="none" />
      </Case>
    </>
  );
}

function CardBody({ title }: { title: string }) {
  return (
    <>
      <p className="prose">{title}</p>
      <p className="note">a line of detail under it</p>
    </>
  );
}

function CardCases() {
  return (
    <>
      <Case props='as="article"'>
        <Card>
          <CardBody title="A pass" />
        </Card>
      </Case>
      <Case props='as="section"'>
        <Card as="section" aria-label="the next event">
          <CardBody title="The next event" />
        </Card>
      </Case>
      <Case props='as="button"'>
        <Card as="button" onClick={noop}>
          <CardBody title="A card that is one control" />
        </Card>
      </Case>
      <Case props='as="a"'>
        <Card as="a" href="#dev">
          <CardBody title="A card that is one link" />
        </Card>
      </Case>
      <Case props="selected">
        <Card selected>
          <CardBody title="The pass the guide is open on" />
        </Card>
      </Case>
      <Case props='frame="accent"'>
        <Card frame="accent">
          <CardBody title="The phone's first card" />
        </Card>
      </Case>
    </>
  );
}

function RuleCases() {
  return (
    <Case props="">
      <p className="prose">Above the rule.</p>
      <Rule />
      <p className="prose">Below it.</p>
    </Case>
  );
}

function SectionHeadingCases() {
  const sid = useScopedId();
  return (
    <>
      <Case props="">
        <SectionHeading id={sid('dev-heading-plain')}>Tonight</SectionHeading>
      </Case>
      <Case props='tone="active"'>
        <SectionHeading id={sid('dev-heading-active')} tone="active">
          Where
        </SectionHeading>
      </Case>
      <Case props='tone="muted"'>
        <SectionHeading id={sid('dev-heading-muted')} tone="muted">
          When
        </SectionHeading>
      </Case>
      <Case props="level={3}">
        <SectionHeading id={sid('dev-heading-3')} level={3}>
          A subsection
        </SectionHeading>
      </Case>
      <Case props="visuallyHidden">
        <SectionHeading id={sid('dev-heading-hidden')} visuallyHidden>
          Read, not drawn
        </SectionHeading>
        <p className="note">(a heading in the outline and nothing on the screen)</p>
      </Case>
    </>
  );
}

function LineCases() {
  return (
    <>
      <Case props='tone="status"'>
        <Line marker="·">A status line, the default tone.</Line>
      </Case>
      <Case props='tone="ok"'>
        <Line tone="ok" marker="✓">
          Everything is ready.
        </Line>
      </Case>
      <Case props='tone="notice"'>
        <Line tone="notice" marker="!">
          A notice the reader should see.
        </Line>
      </Case>
      <Case props='tone="failure"'>
        <Line tone="failure" marker="×">
          Something failed.
        </Line>
      </Case>
      <Case props="actions">
        <Line tone="failure" marker="×" actions={<TextButton label="retry" inline onClick={noop} />}>
          Something failed.
        </Line>
      </Case>
      <Case props="actions dot">
        <Line marker="·" dot actions={<TextButton label="change" inline onClick={noop} />}>
          A status with a dot before its action.
        </Line>
      </Case>
      <Case props='ink="dim"'>
        <Line marker="·" ink="dim">
          A secondary line in the dim ink.
        </Line>
      </Case>
      <Case props='ink="tone"'>
        <Line tone="notice" marker="!" ink="tone">
          The sentence in the tone's own ink.
        </Line>
      </Case>
      <Case props='size="small"'>
        <Line marker="·" size="small">
          The small type on its row.
        </Line>
      </Case>
      <Case props="box">
        <Line tone="notice" marker="[Warning]" box actions={<TextButton label="dismiss" inline onClick={noop} />}>
          A banner in its frame.
        </Line>
      </Case>
      <Case props='rows="text"'>
        <Line
          tone="failure"
          marker="×"
          rows="text"
          actions={
            <>
              <TextButton label="retry" inline onClick={noop} />
              <TextButton label="details" inline tone="dim" onClick={noop} />
            </>
          }
        >
          A failure with its text controls on the row under.
        </Line>
      </Case>
      <Case props='rows="controls"'>
        <Line
          tone="failure"
          marker="×"
          rows="controls"
          actions={
            <>
              <TextButton label="retry" onClick={noop} />
              <TextButton label="details" tone="dim" onClick={noop} />
            </>
          }
        >
          A failure with a row of tap-height controls under.
        </Line>
      </Case>
      <Case props='as="div"'>
        <Line as="div" marker="·">
          A line that is a div.
        </Line>
      </Case>
    </>
  );
}

function FieldCases() {
  const sid = useScopedId();
  return (
    <>
      <Case props="">
        <Field id={sid('dev-field-plain')} label="Place" placeholder="a city or an address" />
      </Case>
      <Case props="labelHidden unit cells">
        <Field id={sid('dev-field-alt')} label="Altitude" labelHidden unit="m" cells={8} defaultValue="839" />
      </Case>
      <Case props='size="small" cells'>
        <Field id={sid('dev-field-small')} label="Latitude" size="small" cells={12} defaultValue="-41.15" />
      </Case>
      <Case props="box">
        <Field id={sid('dev-field-box')} label="Place" box placeholder="in its box" />
      </Case>
      <Case props="trailing (a control)">
        <Field id={sid('dev-field-trailing')} label="Place" placeholder="with a control beside it" trailing={<TextButton label="search" onClick={noop} />} />
      </Case>
      <Case props="trailing (a Field)">
        <Field id={sid('dev-field-pair')} label="Latitude" cells={12} defaultValue="-41.15" trailing={<Field id={sid('dev-field-pair-2')} label="Longitude" cells={12} defaultValue="-71.31" />} />
      </Case>
      <Case props="children">
        <Field id={sid('dev-field-rows')} label="Place" defaultValue="Bariloch">
          <Line tone="failure" marker="×" size="small">
            A validation message under the input.
          </Line>
        </Field>
      </Case>
    </>
  );
}

function Block({ children }: { children: ReactNode }) {
  return <div className="block">{children}</div>;
}

function StackCases() {
  return (
    <>
      {([1, 2, 3, 4, 5] as const).map((gap) => (
        <Case key={gap} props={`gap={${String(gap)}}`}>
          <Stack gap={gap}>
            <Block>one</Block>
            <Block>two</Block>
          </Stack>
        </Case>
      ))}
    </>
  );
}

function ClusterCases() {
  return (
    <>
      {([1, 2, 3] as const).map((gap) => (
        <Case key={gap} props={`gap={${String(gap)}}`}>
          <Cluster gap={gap}>
            <TextButton label="one" onClick={noop} />
            <TextButton label="two" onClick={noop} />
            <TextButton label="three" onClick={noop} />
          </Cluster>
        </Case>
      ))}
      <Case props='align="center"'>
        <Cluster align="center">
          <TextButton label="boxed" box="edge" onClick={noop} />
          <TextButton label="text" onClick={noop} />
        </Cluster>
      </Case>
      <Case props='as="p"'>
        <Cluster as="p">
          <span>A sentence with its control</span>
          <TextButton label="here" inline onClick={noop} />
        </Cluster>
      </Case>
      <Case props="(wrapping)">
        <div className="narrow">
          <Cluster>
            <TextButton label="one" onClick={noop} />
            <TextButton label="two" onClick={noop} />
            <TextButton label="three" onClick={noop} />
            <TextButton label="four" onClick={noop} />
          </Cluster>
        </div>
      </Case>
    </>
  );
}

function VisuallyHiddenCases() {
  return (
    <>
      <Case props='as="span"'>
        <p className="prose">
          Before <VisuallyHidden>(words only assistive technology gets)</VisuallyHidden> after.
        </p>
      </Case>
      <Case props='as="h2"'>
        <VisuallyHidden as="h2">A heading the outline has and the page does not draw</VisuallyHidden>
        <p className="note">(nothing to see: the clip rule is the whole point)</p>
      </Case>
    </>
  );
}

/** One specimen set per manifest row, by the row's name; the page draws "no specimen" for a row missing here. */
const SPECIMENS: Readonly<Record<string, () => ReactNode>> = {
  TextButton: TextButtonCases,
  BracketLink: BracketLinkCases,
  OptionToggle: OptionToggleCases,
  ToggleGroup: ToggleGroupCases,
  Card: CardCases,
  Rule: RuleCases,
  SectionHeading: SectionHeadingCases,
  Line: LineCases,
  Field: FieldCases,
  Stack: StackCases,
  Cluster: ClusterCases,
  VisuallyHidden: VisuallyHiddenCases,
};

/**
 * Every specimen is drawn once per column, so an id a specimen sets is scoped by
 * the column's theme: a label, `htmlFor` or `aria-labelledby` in one column
 * then points into that column and never at its twin in the other.
 */
const ThemeScope = createContext<Theme | null>(null);

function useScopedId(): (id: string) => string {
  const theme = useContext(ThemeScope);
  return (id) => (theme === null ? id : `${id}-${theme}`);
}

function Column({ theme }: { theme: Theme }) {
  return (
    <ThemeScope.Provider value={theme}>
    <section className="theme" data-theme={theme} aria-labelledby={`dev-theme-${theme}`}>
      <h1 id={`dev-theme-${theme}`} className="themeTitle">
        {theme}
      </h1>
      {PRIMITIVES.map((primitive) => {
        const Cases = SPECIMENS[primitive.name];
        return (
          <section key={primitive.name} className="primitive" data-primitive={primitive.name} aria-labelledby={`dev-${theme}-${primitive.name}`}>
            <h2 id={`dev-${theme}-${primitive.name}`} className="primitiveTitle">
              {primitive.name}
            </h2>
            <p className="note">{primitive.when}</p>
            {Cases ? <Cases /> : <p className="missing">no specimen</p>}
          </section>
        );
      })}
    </section>
    </ThemeScope.Provider>
  );
}

/** `data-compact` on the page, from the wide breakpoint, so a capture states the mode it was shot in. */
function useCompact(): boolean {
  const [compact, setCompact] = useState(() => !window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setCompact(!query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}

function Page() {
  const compact = useCompact();
  return (
    <div className="page" data-compact={compact ? 'true' : 'false'}>
      {THEMES.map((theme) => (
        <Column key={theme} theme={theme} />
      ))}
    </div>
  );
}

const host = document.getElementById('dev');
if (!host) throw new Error('dev/primitives.html has no #dev');
createRoot(host).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
