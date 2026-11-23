import type { example as EnExample } from '../en/example';

export const example: typeof EnExample = {
  example: {
    label: (city) => `Ejemplo: ${city}, según tu zona horaria`,
    pageLine: 'elegí tu lugar',
    looks: (minutes) => `Un punto que se mueve parejo, sin parpadear, cruza en unos ${String(minutes)} min.`,
  },
};
