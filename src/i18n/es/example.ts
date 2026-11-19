import type { example as EnExample } from '../en/example';

export const example: typeof EnExample = {
  example: {
    label: (city) => `Ejemplo: ${city}, según tu zona horaria`,
    setPlace: '¿No es ahí? Elegí tu lugar',
    finding: (city) => `Buscando los pases de esta noche sobre ${city}…`,
    back: 'volver',
    pageLine: 'elegí tu lugar',
    looks: (minutes) => `Un punto que se mueve parejo, sin parpadear, cruza en unos ${String(minutes)} min.`,
    afterDusk: 'Los satélites solo se ven después del anochecer.',
  },
};
