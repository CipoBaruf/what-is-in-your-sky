/**
 * R170 (FR-GLOBE-1, FR-GLOBE-5, FR-GLOBE-7..10, FR-GLOBE-12, FR-GLOBE-16; PLAN D-1035, D-1042): the words of the
 * stars page's globe rail — the view's name on wide, the `Time`, `Turn` and `Place` groups, `faint`, the count, the
 * planets' line, `Up from <place>` and the drawing's name. In `main` with the rest of the catalog (FR-I18N-2's one
 * catalog, within `GLOBE_MAIN_KB`). The drawing's own words (the poles, the zenith, "below") are `chart.globe`'s
 * (R169). The steps' and the speeds' visible labels are numbers and the same in both languages (FR-I18N-4); their
 * accessible names are words.
 */
export const globe = {
  globe: {
    /** FR-GLOBE-1: the view row's second value on wide, `[ Window ] Globe`. */
    view: 'Globe',
    /** FR-GLOBE-7: the four steps as drawn, `[ −1 d ] [ −1 h ] [ +1 h ] [ +1 d ]`. */
    steps: { dayBack: '−1 d', hourBack: '−1 h', hourAhead: '+1 h', dayAhead: '+1 d' },
    /** The steps' accessible names. */
    stepNames: { dayBack: 'A day earlier', hourBack: 'An hour earlier', hourAhead: 'An hour later', dayAhead: 'A day later' },
    stepGroup: 'Steps',
    /** FR-GLOBE-8 (restored v2.14.1, D-1138): the clock line's accessible prefix. */
    clock: 'Globe time',
    /** FR-GLOBE-7 (restored v2.14.1, D-1138): the time-lapse's group, its options `×60`, `×600`, `×3600`. */
    speedGroup: 'Time-lapse',
    speed: (rate: number) => `×${String(rate)}`,
    speedName: (rate: number) => `Time-lapse at ${String(rate)} times real time`,
    /** FR-GLOBE-5: the turn's row. */
    turnHeading: 'Turn',
    turn: { you: 'with you', stars: 'with the stars' },
    /** FR-GLOBE-9: the place group. */
    placeHeading: 'Place',
    /** FR-GLOBE-10: the faint stars' toggle, `[ ] faint`. */
    faint: 'faint',
    /** FR-GLOBE-12: "502 of 904 stars above the horizon". */
    count: (p: { up: number; total: number }) => `${String(p.up)} of ${String(p.total)} stars above the horizon`,
    /** FR-GLOBE-12: the planets up with their direction, "Planets up: Venus W · Jupiter ENE". */
    planetsUp: (list: string) => `Planets up: ${list}`,
    planetsNone: 'No planet above the horizon',
    /** FR-GLOBE-12: `In this field` on the globe. */
    upFrom: (place: string) => `Up from ${place}`,
    /** FR-GLOBE-12: the drawing's name — "Celestial globe over Buenos Aires at 21:14 GMT−3, turning with you". */
    label: (p: { place: string; time: string; turn: 'you' | 'stars' }) => `Celestial globe over ${p.place} at ${p.time}, turning ${p.turn === 'you' ? 'with you' : 'with the stars'}`,
  },
};
