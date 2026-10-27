import type { CloudState } from '../../model';
import type { home as EnHome } from '../en/home';

/**
 * R130 (FR-FLOW-1, FR-FLOW-2): las tres puertas del inicio y la línea plegada
 * de Dónde, tipadas contra `en/home.ts`. Cada línea compacta entra en 34
 * celdas, así que la palabra de las nubes es la corta de la puerta.
 */
const cloudWord = { clear: 'Despejado', partly: 'Algo nuboso', obscured: 'Cubierto', unknown: 'Sin datos' } satisfies Record<CloudState, string>;

const landmarkWord = { above: 'sobre', below: 'bajo', beside: 'junto a' } as const;

export const home: typeof EnHome = {
  doors: {
    region: 'Dónde mirar',
    satellites: {
      title: 'Satélites',
      next: (p) => `Próximo ${p.time} · en ${p.countdown}`,
      up: (p) => `Arriba ·${p.kind === 'peak' ? 'culmina' : { horizon: 'se pone', shadow: 'a la sombra', twilight: 'se apaga' }[p.reason]} en ${p.countdown}`,
      path: (p) => `${p.name} · ${p.peakPoint} ${String(p.peakDeg)}° → ${p.endPoint}`,
      none: (hours) => `Ningún pase visible en ${String(hours)} h`,
      pending: 'Buscando el próximo pase…',
    },
    stars: {
      title: 'Estrellas',
      dark: (p) => `Oscuro ${p.from} → ${p.to}${p.cloud === null ? '' : ` · ${cloudWord[p.cloud]}`}`,
      noDark: (cloud) => `Sin oscuridad total · ${cloudWord[cloud]}`,
      brightest: (p) => `La más brillante: ${p.name}, ${p.point}`,
      from: (time) => `Estrellas desde las ${time}`,
      noNight: 'Sin cielo oscuro esta noche',
      moon: (p) => `Luna ${p.pct} % · ${p.event === 'sets' ? 'se pone' : 'sale'} ${p.time}`,
    },
    both: {
      title: 'Ambos · cielo en vivo',
      up: (p) => `${String(p.count)} en el cielo${p.star === null ? '' : `, ${landmarkWord[p.star.word]} ${p.star.name}`}`,
      nothingNext: (time) => `Nada arriba · próximo ${time}`,
      nothing: 'Nada arriba ahora',
      hint: 'Estrellas bajo los arcos, arrastrá',
    },
  },
  whereFold: {
    ready: (age) => `Listo sin conexión · elementos de ${age}`,
    elements: (age) => `Elementos de ${age}`,
  },
};
