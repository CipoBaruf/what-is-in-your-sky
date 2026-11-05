import type { globe as EnGlobe } from '../en/globe';

/** R170 (FR-GLOBE-16, D-1042): las palabras del riel del globo en la página de estrellas. */
export const globe: typeof EnGlobe = {
  globe: {
    view: 'Globo',
    steps: { dayBack: '−1 d', hourBack: '−1 h', hourAhead: '+1 h', dayAhead: '+1 d' },
    stepNames: { dayBack: 'Un día antes', hourBack: 'Una hora antes', hourAhead: 'Una hora después', dayAhead: 'Un día después' },
    stepGroup: 'Pasos',
    clock: 'Hora del globo',
    turnHeading: 'Giro',
    turn: { you: 'con el horizonte', stars: 'con las estrellas' },
    placeHeading: 'Lugar',
    faint: 'débiles',
    count: (p) => `${String(p.up)} de ${String(p.total)} estrellas sobre el horizonte`,
    planetsUp: (list) => `Planetas sobre el horizonte: ${list}`,
    planetsNone: 'Ningún planeta sobre el horizonte',
    upFrom: (place) => `Sobre ${place}`,
    label: (p) => `Globo celeste sobre ${p.place} a las ${p.time}, girando ${p.turn === 'you' ? 'con el horizonte' : 'con las estrellas'}`,
  },
};
