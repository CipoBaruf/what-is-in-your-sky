import type { stars as EnStars } from '../en/stars';

/** FR-I18N-2, FR-STAR-10 (R115, D-756): la sección de la página de estrellas en el catálogo español. Los nombres de estrellas y figuras son datos del catálogo, iguales en los dos idiomas. */
export const stars: typeof EnStars = {
  stars: {
    link: 'estrellas',
    heading: 'Estrellas',
    tonight: 'Estrellas esta noche',
    lookUp: 'mirá arriba',
    loading: 'Cargando las estrellas…',
    noPlace: 'Las estrellas necesitan un lugar.',
    setPlace: 'elegir un lugar',
    drawing: 'El cielo, girado a mano: arrastralo o usá las flechas',
    facing: 'Mirando',
    up: 'arriba',
    layersHeading: 'Capas',
    layers: { stars: 'estrellas', figures: 'figuras', planets: 'planetas', names: 'nombres' },
    fieldHeading: 'En este campo',
    fieldEmpty: 'Nada dibujado en este campo.',
    planets: { Mercury: 'Mercurio', Venus: 'Venus', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno' },
    mag: (p) => `mag ${p.mag}`,
    readout: (p) => `Mirando al ${p.point} · ${p.altitude} de altura · ${p.across} de ancho`,
    named: (p) => `${p.name} · mag ${p.mag} · ${p.altitude} de altura · ${p.point}`,
    holdUp: 'apuntá al cielo',
    keysHeading: 'En la página de estrellas',
    keys: {
      starsTurn: 'Girar el cielo a la izquierda o a la derecha, con el dibujo enfocado',
      starsTilt: 'Inclinarlo hacia arriba o hacia abajo',
    },
  },
};
