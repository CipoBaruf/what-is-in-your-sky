import type { BracketLinkOwnProps } from './BracketLink';
import type { CardOwnProps } from './Card';
import type { CloseOwnProps } from './Close';
import type { ClusterOwnProps } from './Cluster';
import type { DisclosureOwnProps } from './Disclosure';
import type { FieldOwnProps } from './Field';
import type { LineOwnProps } from './Line';
import type { OptionToggleOwnProps } from './OptionToggle';
import type { PickRowOwnProps } from './PickRow';
import type { RuleProps } from './Rule';
import type { SectionHeadingProps } from './SectionHeading';
import type { SettingRowOwnProps } from './SettingRow';
import type { StackOwnProps } from './Stack';
import type { StatusLineOwnProps } from './StatusLine';
import type { TagOwnProps } from './Tag';
import type { TextButtonOwnProps } from './TextButton';
import type { ToggleGroupProps } from './ToggleGroup';
import type { VisuallyHiddenOwnProps } from './VisuallyHidden';
import type { ZoomKeysOwnProps } from './ZoomKeys';

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

/** FR-DS-13, D-1227: the states the gallery draws, in its order. */
export type PrimitiveState = 'rest' | 'hover' | 'focus' | 'on' | 'picked' | 'busy' | 'disabled' | 'error';

export interface PrimitiveEntry {
  name: string;
  /** The component's file in this directory. */
  file: string;
  /** One sentence on when this is the right primitive. */
  when: string;
  /** The states this primitive has (FR-DS-13): the gallery lays it once per state and the guide lists them. */
  states: readonly PrimitiveState[];
  props: readonly PrimitivePropDoc[];
}

type Docs<P> = { readonly [K in keyof P]-?: Omit<PrimitivePropDoc, 'name'> };

function entry<P extends object>(name: string, when: string, states: readonly PrimitiveState[], docs: Docs<P>): PrimitiveEntry {
  return { name, file: `${name}.tsx`, when, states, props: Object.entries(docs as Record<string, Omit<PrimitivePropDoc, 'name'>>).map(([key, doc]) => ({ name: key, ...doc })) };
}

const PLACEMENT = { type: 'string', text: 'Placement only: a grid area or a margin from the space scale (D-704).' };

export const PRIMITIVES: readonly PrimitiveEntry[] = [
  entry<TextButtonOwnProps>('TextButton', 'An outlined box with its words: any action the reader taps that is words and not a field or a card.', ['rest', 'hover', 'focus', 'on', 'busy', 'disabled'], {
    label: { type: 'ReactNode', text: 'The control’s words.' },
    onClick: { type: '(event) => void', text: 'What the tap does.' },
    disabled: { type: 'boolean', text: 'A disabled control reads in the dim ink and takes no tap.' },
    tone: { type: "'accent' | 'dim' | 'danger'", text: 'The words’ ink, `--fg` left out: the accent, a secondary action’s dim ink, or the danger ink.' },
    busy: { type: 'boolean', text: 'The action runs: `aria-busy`, the words pulse (held dim under reduced motion), the label and the box do not change; it keeps the focus and takes no press.' },
    pressed: { type: 'boolean', text: 'An option: the dim word when off, `--on-ink` on a block of `--on-ground` when on, as an OptionToggle.' },
    inline: { type: 'boolean', text: 'Hung off a line of prose: the tap box is padding and a matching negative margin, so the line does not grow.' },
    bare: { type: 'boolean', text: 'The words without a box, for a glyph that stands in a cell of its own (the compact taps row’s play).' },
    padded: { type: 'boolean', text: 'A cell outside the box at each side and a `--tap` floor on the width, for a control standing clear of a heading beside it.' },
    box: { type: "'plain' | 'accent'", text: 'The box’s edge: `--control-edge` (the default), or the accent of the primary form, one per screen at most.' },
    fill: { type: 'boolean', text: 'With `box`: the width of the column it stands in.' },
    tall: { type: 'boolean', text: 'With `box="accent"`: the when step’s 56 px foot action.' },
    note: { type: 'ReactNode', text: 'With `box="accent"`: a line under the label, the control’s description and never its name.' },
    look: { type: "'boxed' | 'plain'", text: 'With `note`: the input group’s two looks, boxed on a phone and plain in the wide pane.' },
    wrap: { type: 'boolean', text: 'A label that may break anywhere (a saved place’s name) rather than widening its row.' },
    as: { type: "'button' | 'summary'", text: 'A `<button>`, or the `<summary>` of a `<details>` drawn as the same control.' },
    className: PLACEMENT,
  }),
  entry<BracketLinkOwnProps>('BracketLink', 'An underlined link that goes somewhere: a route, never an action.', ['rest', 'hover', 'focus', 'on'], {
    href: { type: 'string', text: 'Where it goes.' },
    label: { type: 'ReactNode', text: 'The link’s words.' },
    current: { type: 'boolean', text: 'The page this control stands on: a dim `aria-current` span with the same box, not a link.' },
    tab: { type: 'boolean', text: 'A header tab: dim words, `--fg` on hover; with `current`, `--fg` over a 2 px accent rule.' },
    className: PLACEMENT,
  }),
  entry<OptionToggleOwnProps>('OptionToggle', 'One option, a filled block when on and the dim word when off; alone for a single on/off, or inside a ToggleGroup.', ['rest', 'hover', 'focus', 'on', 'disabled'], {
    label: { type: 'ReactNode', text: 'The option’s words.' },
    pressed: { type: 'boolean', text: 'Whether the option is on; the parent owns it.' },
    onPress: { type: '() => void', text: 'What a tap means; a group passes nothing for the option already pressed.' },
    value: { type: 'string', text: 'The option’s value as `data-option`, so a caller can find it in its group again.' },
    alone: { type: 'boolean', text: 'An option standing alone; drawn as any other, its padding the same at each side.' },
    inline: { type: 'boolean', text: 'The 48 px box as padding and a matching negative margin, so the option’s line is one text row (the compact chart’s view control).' },
    target: { type: 'boolean', text: 'A 44 px hit area at least (`.target`, the default); `false` in a dense row, where the row is the target.' },
    className: PLACEMENT,
  }),
  entry<ToggleGroupProps<string>>('ToggleGroup', 'A row of options under one name where exactly one is chosen: a view, a sort, a speed, a language, a theme.', ['rest', 'hover', 'focus', 'on'], {
    name: { type: 'string', text: 'The group’s accessible name.' },
    prefix: { type: 'string', text: 'An optional visible prefix such as `View:`, hidden from assistive technology.' },
    options: { type: '{ value, label }[]', text: 'The options in order.' },
    value: { type: 'string', text: 'The chosen option; the parent owns it.' },
    onChange: { type: '(value) => void', text: 'Called with the new value when another option is chosen, never for the chosen one.' },
    role: { type: "'group' | 'radiogroup'", text: 'Pressed buttons (the default), or radios with one tab stop where the arrow keys choose.' },
    mark: { type: "'check' | 'bracket' | 'tight'", text: 'The marks of before FR-CTRL-3, one look now: the chosen option is the filled block whatever is named.' },
    gap: { type: "'cell' | 'none'", text: 'The spacings of before FR-CTRL-3, one now: the options are a quarter cell apart whatever is named.' },
    inline: { type: 'boolean', text: 'Each option’s line is one text row with its 48 px box as padding and a matching negative margin, so a group that wraps to two lines stands inside one tap row.' },
    dense: { type: 'boolean', text: 'A row too dense for a 44 px target per option (the facing picker): the options at least 44 px tall with their hit areas meeting, the cell between them split into their padding.' },
    className: PLACEMENT,
  }),
  // R105 (FR-DS-4 items 4–6; D-718..D-720): the surfaces.
  entry<CardOwnProps>('Card', 'A box ruled in the rule colour that holds one thing — the next event — and, as a button or a link, is one control.', ['rest', 'hover', 'focus'], {
    as: { type: "'article' | 'section' | 'button' | 'a'", text: 'The element: a pass’s article, the next event’s named section, or the card as one button or link with the sheet’s control chrome taken off.' },
    frame: { type: "'rule' | 'accent'", text: 'The frame’s ink: the rule (a card among cards), or the accent (the phone’s first card).' },
    emphasis: { type: 'boolean', text: 'A link or button card that is a page’s main navigation (the home’s doors on a desk): a control’s frame, a row and two cells inside, the frame in the accent on hover and focus.' },
    children: { type: 'ReactNode', text: 'What the card holds.' },
    className: PLACEMENT,
  }),
  entry<RuleProps>('Rule', 'The plain divider between two blocks, where a module used to draw a bare border-top; the space beside it is the host’s margin.', ['rest'], {
    className: { type: 'string', text: 'Placement only: a grid area, a flex basis or a margin from the space scale (D-704).' },
  }),
  entry<SectionHeadingProps>('SectionHeading', 'A section’s title drawn as a character rule, `── Title ─────`, named by the title alone.', ['rest'], {
    id: { type: 'string', text: 'The heading’s id, for the section’s `aria-labelledby`.' },
    children: { type: 'ReactNode', text: 'The title.' },
    tone: { type: "'active' | 'muted'", text: 'The home’s pane headings: the reading the reader is on in the accent, a pane not there yet in the dim ink.' },
    level: { type: '2 | 3', text: 'The heading’s rank in the outline (FR-A11Y-2); the drawing is the same at either.' },
    visuallyHidden: { type: 'boolean', text: 'The heading read and not drawn (a `VisuallyHidden` at the same rank), for a region whose name is on the screen already.' },
  }),
  entry<LineOwnProps>('Line', 'One line that tells the reader something — a status, a note, a failure — as a leading marker, a sentence and trailing actions.', ['rest', 'error'], {
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
  entry<FieldOwnProps>('Field', 'A label over a text input with the rows under it — a message, a status, a pick list — and, on the input’s row, a trailing control or field; every attribute of the input passes through.', ['rest', 'hover', 'focus', 'disabled', 'error'], {
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
  // R209 (FR-DS-11; D-1228): the controls and labels every page is built from.
  entry<TagOwnProps>('Tag', 'A label that cannot be pressed, its word in brackets in its tone: the only brackets in the app.', ['rest'], {
    tone: { type: "'dim' | 'accent' | 'ok' | 'warn' | 'danger'", text: 'The ink of the word and its brackets.' },
    children: { type: 'ReactNode', text: 'The word.' },
    className: PLACEMENT,
  }),
  entry<CloseOwnProps>('Close', 'The one close or dismiss, a bare × the host places at the top-right corner of what it closes; a declined offer is a TextButton.', ['rest', 'hover', 'focus'], {
    onClose: { type: '() => void', text: 'What closes.' },
    label: { type: 'string', text: 'The name, where “Close” alone does not say what closes; left out, the active language’s “Close” or “Cerrar”.' },
    danger: { type: 'boolean', text: 'A removal (a saved place’s ×): the glyph in --danger on hover.' },
    className: PLACEMENT,
  }),
  entry<PickRowOwnProps>('PickRow', 'A row or card that opens or picks something from a set: no frame, the raised ground under the pointer, the accent line at the picked one’s left.', ['rest', 'hover', 'focus', 'picked', 'disabled'], {
    picked: { type: 'boolean', text: 'Whether this is the picked one; the parent owns it.' },
    onPick: { type: '() => void', text: 'What a press means.' },
    href: { type: 'string', text: 'Where the row goes: it is then a link, and the picked one is `aria-current`; `disabled` takes the target and the focus away.' },
    current: { type: 'boolean', text: 'A button whose picked row is the one shown of its set: `aria-current` in place of `aria-pressed`.' },
    children: { type: 'ReactNode', text: 'What the row holds, its items a cell apart in their own inks.' },
    className: PLACEMENT,
  }),
  entry<DisclosureOwnProps>('Disclosure', 'A line that opens and closes what is under it, `▸ Tonight · 3`, the whole line the control.', ['rest', 'hover', 'focus', 'on', 'disabled'], {
    open: { type: 'boolean', text: 'Whether what it opens is shown (`aria-expanded`); the parent owns it.' },
    onToggle: { type: '() => void', text: 'What a press means.' },
    label: { type: 'ReactNode', text: 'The line’s words.' },
    count: { type: 'number', text: 'How many it holds, after a middle dot.' },
    className: PLACEMENT,
  }),
  entry<ZoomKeysOwnProps>('ZoomKeys', 'The zoom of a view that zooms, `−`, `+` and `⟲` joined in one box under the view at its left.', ['rest', 'hover', 'focus', 'disabled'], {
    onIn: { type: '() => void', text: 'What `+` does: one step nearer.' },
    onOut: { type: '() => void', text: 'What `−` does: one step wider.' },
    onReset: { type: '() => void', text: 'What `⟲` does: back to the view’s opening camera.' },
    names: { type: '{ in, out, reset }', text: 'The three keys’ names, in the host’s language.' },
    end: { type: "'in' | 'out' | null", text: 'The end of the range the zoom stands at: that key is disabled.' },
    className: PLACEMENT,
  }),
  entry<SettingRowOwnProps>('SettingRow', 'A labelled row of a group: the dim label in its column and its control, the rows on one rhythm.', ['rest'], {
    label: { type: 'ReactNode', text: 'The row’s words, in the `--label-col` column; the control carries its own name.' },
    children: { type: 'ReactNode', text: 'The row’s control.' },
    className: PLACEMENT,
  }),
  entry<StatusLineOwnProps>('StatusLine', 'The one line of feedback under or after a control: progress, an error, success, or an empty list.', ['rest', 'error'], {
    tone: { type: "'progress' | 'failure' | 'ok' | 'empty'", text: 'What it reports: dim progress or emptiness, success in `--ok` (all three `role="status"`), or a failure in `--danger` (`role="alert"`).' },
    children: { type: 'ReactNode', text: 'The sentence.' },
    className: PLACEMENT,
  }),
  // R107 (FR-DS-4 item 8; D-725): the layout helpers and the hidden-text block.
  entry<StackOwnProps>('Stack', 'A column of blocks a step of the space scale apart — a line and the panel it opens, a sentence and the detail under it.', ['rest'], {
    gap: { type: "1 | 2 | 3 | 4 | 5 | 'row' | 'group'", text: 'The space between the blocks: a step of the space scale, `1` a quarter row (`--space-1`) up to `5` two rows (`--space-5`), or the rhythm, `row` (`--gap-row`) between a group’s rows and `group` (`--gap-group`) between groups.' },
    as: { type: "'div' | 'ul' | 'section'", text: 'A `div`, a `ul` whose items are the rows (no marker, no indent), or a `section`, a group with its name.' },
    children: { type: 'ReactNode', text: 'The blocks, in order.' },
    className: { type: 'string', text: 'Placement only: a grid area, a margin from the space scale, a `min-width` (D-704).' },
  }),
  entry<ClusterOwnProps>('Cluster', 'A row of controls that wraps when the width runs out, a cell count apart and on one baseline — a share row, a pair of fields, a row of links.', ['rest'], {
    gap: { type: '1 | 2 | 3', text: 'The space between the controls, in cells; two left out.' },
    align: { type: "'baseline' | 'center'", text: 'The controls on their baseline (a row of text controls) or centred (a row that mixes boxes and text).' },
    as: { type: "'div' | 'p'", text: 'A `div`, or a `p` where the row is a sentence with its control.' },
    children: { type: 'ReactNode', text: 'The controls, in order.' },
    className: PLACEMENT,
  }),
  entry<VisuallyHiddenOwnProps>('VisuallyHidden', 'Words for assistive technology that the eye does not get — a spoken label, a live region, a heading the outline needs where the page draws none — in the one copy of the clip rule.', ['rest'], {
    as: { type: "'span' | 'p' | 'h1' | 'h2' | 'h3' | 'dt' | 'label'", text: 'The element: a span in a line (the default), a paragraph, a heading in the outline, a `dt`, or a `label`; every other attribute passes through.' },
    children: { type: 'ReactNode', text: 'The words.' },
    className: { type: 'string', text: 'Placement only: a grid area the host’s rules name (D-704).' },
  }),
];
