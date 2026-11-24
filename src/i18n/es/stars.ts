import type { stars as EnStars } from '../en/stars';

/** FR-I18N-2, FR-STAR-10 (R115, D-777): las palabras de la página de estrellas que dibuja el chunk principal; R222: quedan las teclas del cielo enfocado. */
export const stars: typeof EnStars = {
  stars: {
    keysHeading: 'Con el cielo enfocado',
    keys: {
      starsTurn: 'Girar el cielo, con el dibujo enfocado',
      starsTilt: 'Inclinarlo hacia arriba o abajo',
      boxZoom: 'Acercar o alejar (globo, ventana)',
      boxReset: 'Volver al campo (0) o a la vista (Home) del principio',
    },
  },
};
