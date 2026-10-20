import type { BracketLinkOwnProps } from './BracketLink';
import type { OptionToggleOwnProps } from './OptionToggle';
import type { TextButtonOwnProps } from './TextButton';
import type { ToggleGroupProps } from './ToggleGroup';

/**
 * R104 (FR-DS-4, FR-DS-6; D-703): the manifest — one row per primitive, the
 * join between the directory, the guide `scripts/design-guide.ts` prints
 * (R108) and the dev page (R109). `manifest.test.ts` holds it to the files:
 * every component here has a row and every row a file. The props are typed
 * against each component's own `Props` by name — `Docs<P>` wants every key of
 * `P` and nothing else — so a prop added to a primitive without a sentence
 * here is a type error, and a sentence for a prop that is gone is one too.
 */
export interface PrimitivePropDoc {
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

function entry<P>(name: string, when: string, docs: Docs<P>): PrimitiveEntry {
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
    className: PLACEMENT,
  }),
];
