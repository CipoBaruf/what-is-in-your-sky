/**
 * R202 (FR-OPEN-8, D-1181, D-1209): the example first run's words — the band, the Where pane's line and the
 * action. `pageLine` is the control of the other pages' line (FR-OPEN-7), drawn after `label` there.
 */
export const example = {
  example: {
    label: (city: string) => `Example: ${city}, from your time zone`,
    setPlace: 'Not there? Set your place',
    finding: (city: string) => `Finding tonight's passes over ${city}…`,
    back: 'back',
    pageLine: 'set your place',
    /** FR-OPEN-12: `minutes` is whole and at least 1, the caller's (D-1209). */
    looks: (minutes: number) => `A steady moving dot, no blinking, crosses in about ${String(minutes)} min.`,
    afterDusk: 'Satellites are only visible after dusk.',
  },
};
