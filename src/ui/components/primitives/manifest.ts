import type { BracketLinkOwnProps } from './BracketLink';
import type { CardOwnProps } from './Card';
import type { ClusterOwnProps } from './Cluster';
import type { FieldOwnProps } from './Field';
import type { LineOwnProps } from './Line';
import type { OptionToggleOwnProps } from './OptionToggle';
import type { RuleProps } from './Rule';
import type { SectionHeadingProps } from './SectionHeading';
import type { StackOwnProps } from './Stack';
import type { TextButtonOwnProps } from './TextButton';
import type { ToggleGroupProps } from './ToggleGroup';
import type { VisuallyHiddenOwnProps } from './VisuallyHidden';

/**
 * R104 (FR-DS-4, FR-DS-6; D-703): the manifest — one row per primitive, the
 * join between the directory, the guide `scripts/design-guide.ts` prints
 * (R108) and the dev page (R109). `manifest.test.ts` holds it to the files:
 * every component here has a row and every row a file. The props are typed
 * against each component's own `Props` by name — `Docs<P>` wants every key of
 * `P` and nothing else — so a prop added to a primitive without a sentence
 * here is a type error, and a sentence for a prop that is gone is one too.
 */
interface PrimitivePropDoc {
  name: string;
  /** The type as the guide prints it. */
  type: string;
  /** One sentence on what the prop does. */
  text: string;
}

export interface PrimitiveEntry {
  name: string;
  /** The component's file in this directory. */
  file: string;
  /** One sentence on when this is the right primitive. */
  when: string;
  props: readonly PrimitivePropDoc[];
}

type Docs<P> = { readonly [K in keyof P]-?: Omit<PrimitivePropDoc, 'name'> };

function entry<P extends object>(name: string, when: string, docs: Docs<P>): PrimitiveEntry {
  return { name, file: `${name}.tsx`, when, props: Object.entries(docs as Record<string, Omit<PrimitivePropDoc, 'name'>>).map(([key, doc]) => ({ name: key, ...doc })) };
}

const PLACEMENT = { type: 'string', text: 'Placement only: a grid area or a margin from the space scale (D-704).' };

export const PRIMITIVES: readonly PrimitiveEntry[] = [
  entry<TextButtonOwnProps>('TextButton', 'A `[ label ]` button: any action the reader taps that is words and not a field or a card.', {
    label: { type: 'ReactNode', text: 'The words between the brackets.' },
    onClick: { type: '(event) => void', text: 'What the tap does.' },
    disabled: { type: 'boolean', text: 'A disabled control reads in the dim ink and takes no tap.' },
    tone: { type: "'accent' | 'dim' | 'danger'", text: 'The words’ ink: an action, a secondary action, or the danger ink.' },
    pressed: { type: 'boolean', text: 'A pressed text control: bracketed in the accent when pressed, bare and dim when not (the sort row, the compact speeds).' },
    tight: { type: 'boolean', text: 'With `pressed`: brackets without their spaces, `[60×]` (the compact speeds).' },
    inline: { type: 'boolean', text: 'Hung off a line of prose: the tap box is padding and a matching negative margin, so the line does not grow.' },
    bare: { type: 'boolean', text: 'The words without their brackets, for the one row whose budget buys them off (the compact live actions row’s share).' },
    padded: { type: 'boolean', text: 'A cell of padding inside at each side and a `--tap` floor on the width, for a control standing clear of a heading beside it.' },
    box: { type: "'edge' | 'accent'", text: 'A bordered control: the sheet’s own box, or the home’s primary action in the accent’s border.' },
    fill: { type: 'boolean', text: 'With `box`: the width of the column it stands in.' },
    tall: { type: 'boolean', text: 'With `box="accent"`: the when step’s 56 px foot action.' },
    note: { type: 'ReactNode', text: 'With `box="accent"`: a line under the label, the control’s description and never its name.' },
    look: { type: "'boxed' | 'plain'", text: 'With `note`: the input group’s two looks, boxed on a phone and plain in the wide pane.' },
    wrap: { type: 'boolean', text: 'A label that may break anywhere (a saved place’s name) rather than widening its row.' },
    as: { type: "'button' | 'summary'", text: 'A `<button>`, or the `<summary>` of a `<details>` drawn as the same control.' },
    className: PLACEMENT,
  }),
  entry<BracketLinkOwnProps>('BracketLink', 'A `[ label ]` that goes somewhere: a link to a route, never an action.', {
    href: { type: 'string', text: 'Where it goes.' },
    label: { type: 'ReactNode', text: 'The words between the brackets.' },
    current: { type: 'boolean', text: 'The page this control stands on: a dim `aria-current` span with the same box, not a link.' },
    className: PLACEMENT,
  }),
  entry<OptionToggleOwnProps>('OptionToggle', 'One `[x] option` whose state the reader can see in the characters; alone for a single on/off, or inside a ToggleGroup.', {
    label: { type: 'ReactNode', text: 'The option’s words, after the `[x] ` mark.' },
    pressed: { type: 'boolean', text: 'Whether the option is on; the parent owns it.' },
    onPress: { type: '() => void', text: 'What a tap means; a group passes nothing for the option already pressed.' },
    value: { type: 'string', text: 'The option’s value as `data-option`, so a caller can find it in its group again.' },
    alone: { type: 'boolean', text: 'An option standing alone has no trailing cell; in a group that cell separates it from the next.' },
    inline: { type: 'boolean', text: 'The 48 px box as padding and a matching negative margin, so the option’s line is one text row (the compact chart’s view control).' },
    className: PLACEMENT,
  }),
  entry<ToggleGroupProps<string>>('ToggleGroup', 'A row of options under one name where exactly one is chosen: a view, a sort, a speed, a language, a theme.', {
    name: { type: 'string', text: 'The group’s accessible name.' },
    prefix: { type: 'string', text: 'An optional visible prefix such as `View:`, hidden from assistive technology.' },
    options: { type: '{ value, label }[]', text: 'The options in order.' },
    value: { type: 'string', text: 'The chosen option; the parent owns it.' },
    onChange: { type: '(value) => void', text: 'Called with the new value when another option is chosen, never for the chosen one.' },
    role: { type: "'group' | 'radiogroup'", text: 'Pressed buttons (the default), or radios with one tab stop where the arrow keys choose.' },
    mark: { type: "'check' | 'bracket' | 'tight'", text: 'How the chosen option is told from the others: `[x]`, bracketed, or bracketed without spaces.' },
    gap: { type: "'cell' | 'none'", text: 'A cell between options, or none where each option’s trailing cell is the whole gap (the wide speeds).' },
    inline: { type: 'boolean', text: 'Each option’s line is one text row with its 48 px box as padding and a matching negative margin, so a group that wraps to two lines stands inside one tap row.' },
    dense: { type: 'boolean', text: 'A row too dense for a 44 px target per option (the facing picker): the options at least 44 px tall with their hit areas meeting, the cell between them split into their padding.' },
    className: PLACEMENT,
  }),
  // R105 (FR-DS-4 items 4–6; D-718..D-720): the surfaces.
  entry<CardOwnProps>('Card', 'A box ruled in the rule colour that holds one thing — a pass, the next event — and, as a button or a link, is one control.', {
    as: { type: "'article' | 'section' | 'button' | 'a'", text: 'The element: a pass’s article, the next event’s named section, or the card as one button or link with the sheet’s control chrome taken off.' },
    selected: { type: 'boolean', text: 'The card the guide is open on: ruled in the accent on the raised ground and `aria-current`.' },
    frame: { type: "'rule' | 'accent'", text: 'The frame’s ink: the rule (a card among cards), or the accent (the phone’s first card).' },
    children: { type: 'ReactNode', text: 'What the card holds.' },
    className: PLACEMENT,
  }),
  entry<RuleProps>('Rule', 'The plain divider between two blocks, where a module used to draw a bare border-top; the space beside it is the host’s margin.', {
    className: { type: 'string', text: 'Placement only: a grid area, a flex basis or a margin from the space scale (D-704).' },
  }),
  entry<SectionHeadingProps>('SectionHeading', 'A section’s title drawn as a character rule, `── Title ─────`, named by the title alone.', {
    id: { type: 'string', text: 'The heading’s id, for the section’s `aria-labelledby`.' },
    children: { type: 'ReactNode', text: 'The title.' },
    tone: { type: "'active' | 'muted'", text: 'The home’s pane headings: the reading the reader is on in the accent, a pane not there yet in the dim ink.' },
    level: { type: '2 | 3', text: 'The heading’s rank in the outline (FR-A11Y-2); the drawing is the same at either.' },
    visuallyHidden: { type: 'boolean', text: 'The heading read and not drawn (a `VisuallyHidden` at the same rank), for a region whose name is on the screen already.' },
  }),
  entry<LineOwnProps>('Line', 'One line that tells the reader something — a status, a note, a failure — as a leading marker, a sentence and trailing actions.', {
    tone: { type: "'status' | 'ok' | 'notice' | 'failure'", text: 'The ink for the marker and the frame’s edge: dim, `--ok`, `--warn` or `--danger`.' },
    marker: { type: 'ReactNode', text: 'The leading marker in the tone’s ink, the banner’s spelled-out `[Warning]`: the second channel beside the colour (FR-X-5).' },
    children: { type: 'ReactNode', text: 'The sentence.' },
    actions: { type: 'ReactNode', text: 'The trailing controls, after the sentence or on the row under it.' },
    ink: { type: "'fg' | 'dim' | 'tone'", text: 'The sentence’s ink: the page’s, the dim ink, or the tone’s (the elements line past five days).' },
    size: { type: "'body' | 'small'", text: 'The body, or `--small` on its row.' },
    box: { type: 'boolean', text: 'The banner’s frame: the rule all round and the tone’s edge half a cell wide at the left.' },
    rows: { type: "'text' | 'controls'", text: 'The actions on the row under the sentence: a text row of inline controls a cell apart, or a row of `--tap` controls centred, two cells apart, a quarter row under.' },
    dot: { type: 'boolean', text: 'A middle dot between the sentence and the actions.' },
    as: { type: "'p' | 'div'", text: 'A paragraph, or a div where the host’s line was one.' },
    className: PLACEMENT,
  }),
  // R106 (FR-DS-4 item 7; D-722): the field.
  entry<FieldOwnProps>('Field', 'A label over a text input with the rows under it — a message, a status, a pick list — and, on the input’s row, a trailing control or field; every attribute of the input passes through.', {
    id: { type: 'string', text: 'The input’s id, which is the label’s `htmlFor`.' },
    label: { type: 'ReactNode', text: 'The label’s words.' },
    labelHidden: { type: 'boolean', text: 'The label read by assistive technology and not drawn (the home’s altitude, whose unit is in its box).' },
    size: { type: "'body' | 'small'", text: 'The label’s type and the space under it: the body half a row over the input, or `--small` in the dim ink a third of a row over it (the home group).' },
    cells: { type: 'number', text: 'The input’s width in cells; left out, the width of the column it stands in.' },
    unit: { type: 'string', text: 'A unit drawn inside the input’s box a cell after the value or the placeholder, `0 m`.' },
    box: { type: 'boolean', text: 'A box ruled in `--rule` round the field, half a row by a cell inside and a third of a row on a short screen (the phone’s input group).' },
    trailing: { type: 'ReactNode', text: 'A control or a field on the input’s row: a `Field` here joins this one’s grid, its control in the second column and its rows across both.' },
    children: { type: 'ReactNode', text: 'The rows under the input: a validation message (a `Line`), a status, a pick list.' },
    className: PLACEMENT,
  }),
  // R107 (FR-DS-4 item 8; D-725): the layout helpers and the hidden-text block.
  entry<StackOwnProps>('Stack', 'A column of blocks a step of the space scale apart — a line and the panel it opens, a sentence and the detail under it.', {
    gap: { type: '1 | 2 | 3 | 4 | 5', text: 'The space between the blocks as a step of the space scale: `1` a quarter row (`--space-1`) up to `5` two rows (`--space-5`).' },
    children: { type: 'ReactNode', text: 'The blocks, in order.' },
    className: { type: 'string', text: 'Placement only: a grid area, a margin from the space scale, a `min-width` (D-704).' },
  }),
  entry<ClusterOwnProps>('Cluster', 'A row of controls that wraps when the width runs out, a cell count apart and on one baseline — a share row, a pair of fields, a row of links.', {
    gap: { type: '1 | 2 | 3', text: 'The space between the controls, in cells; two left out.' },
    align: { type: "'baseline' | 'center'", text: 'The controls on their baseline (a row of text controls) or centred (a row that mixes boxes and text).' },
    as: { type: "'div' | 'p'", text: 'A `div`, or a `p` where the row is a sentence with its control.' },
    children: { type: 'ReactNode', text: 'The controls, in order.' },
    className: PLACEMENT,
  }),
  entry<VisuallyHiddenOwnProps>('VisuallyHidden', 'Words for assistive technology that the eye does not get — a spoken label, a live region, a heading the outline needs where the page draws none — in the one copy of the clip rule.', {
    as: { type: "'span' | 'p' | 'h1' | 'h2' | 'h3' | 'dt' | 'label'", text: 'The element: a span in a line (the default), a paragraph, a heading in the outline, a `dt`, or a `label`; every other attribute passes through.' },
    children: { type: 'ReactNode', text: 'The words.' },
    className: { type: 'string', text: 'Placement only: a grid area the host’s rules name (D-704).' },
  }),
];
