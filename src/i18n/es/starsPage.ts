import type { starsPage as EnStarsPage } from '../en/starsPage';

/** FR-I18N-2, FR-STAR-10 (R115, D-777): las palabras que solo dibuja la página de estrellas, en el chunk `stars`. Los nombres de estrellas y figuras son datos del catálogo, elegidos por idioma (D-832). */
export const starsPage: typeof EnStarsPage = {
  noPlace: 'Las estrellas necesitan un lugar.',
  setPlace: 'elegir un lugar',
  drawing: 'El cielo: arrastralo o usá las flechas',
  facing: 'Mirando',
  up: 'arriba',
  layersHeading: 'Capas',
  layers: { stars: 'estrellas', figures: 'figuras', planets: 'planetas', names: 'nombres' },
  passesLayer: 'pases',
  passRow: (p) => `${p.key}: ${p.name} · ${p.state} · culmina a ${p.altitude} de altura · ${p.point}`,
  fieldHeading: 'En este campo',
  fieldEmpty: 'Nada dibujado en este campo.',
  planets: { Mercury: 'Mercurio', Venus: 'Venus', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno' },
  mag: (p) => `mag ${p.mag}`,
  named: (p) => `${p.name} · mag ${p.mag} · ${p.altitude} de altura · ${p.point}`,
};
