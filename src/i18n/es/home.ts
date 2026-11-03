import { laterIsBetter } from '../../lib/nightClouds';
import type { CloudState, TonightCloud } from '../../model';
import type { home as EnHome } from '../en/home';

/**
 * R130 (FR-FLOW-1, FR-FLOW-2): las tres puertas del inicio y la línea plegada
 * de Dónde, tipadas contra `en/home.ts`. Cada línea compacta entra en 34
 * celdas, así que la palabra de las nubes es la corta de la puerta.
 */
const cloudWord = { clear: 'Despejado', partly: 'Algo nuboso', obscured: 'Cubierto', unknown: 'Sin datos' } satisfies Record<CloudState, string>;

const doorCloud = (cloud: TonightCloud): string => (cloud.kind === 'steady' ? cloudWord[cloud.state] : 'Variable');

const landmarkWord = { above: 'sobre', below: 'bajo', beside: 'junto a' } as const;

export const home: typeof EnHome = {
  doors: {
    region: 'Dónde mirar',
    satellites: {
      title: 'Satélites',
      next: (p) => `Próximo ${p.time} · en ${p.countdown}`,
      up: (p) => `Arriba · ${p.kind === 'peak' ? 'culmina' : { horizon: 'se pone', shadow: 'a la sombra', twilight: 'se apaga' }[p.reason]} en ${p.countdown}`,
      path: (p) => `${p.name} · ${p.peakPoint} ${String(p.peakDeg)}° → ${p.endPoint}`,
      none: (hours) => `Ningún pase visible en ${String(hours)} h`,
      pending: 'Buscando el próximo pase…',
    },
    stars: {
      title: 'Estrellas',
      /* D-1028: "Oscuro y algo nuboso 20:25 → 01:00" son 34 celdas, el tope de la puerta. */
      dark: (p) => {
        const c = p.cloud;
        if (c?.kind === 'change') return laterIsBetter(c) ? `Oscuro y ${cloudWord[c.after].toLowerCase()} ${c.at} → ${p.to}` : `Oscuro y ${cloudWord[c.before].toLowerCase()} ${p.from} → ${c.at}`;
        return `Oscuro ${p.from} → ${p.to}${c === null ? '' : ` · ${doorCloud(c)}`}`;
      },
      noDark: (cloud) => `Sin oscuridad total${cloud === null ? '' : ` · ${doorCloud(cloud)}`}`,
      brightest: (p) => `La más brillante: ${p.name}, ${p.point}`,
      from: (time) => `Estrellas desde las ${time}`,
      noNight: 'Sin cielo oscuro esta noche',
      moon: (p) => `Luna ${p.pct} % · ${p.event === 'sets' ? 'se pone' : 'sale'} ${p.time}`,
    },
    live: {
      title: 'Cielo en vivo',
      line: 'satélites y estrellas, ahora',
      up: (p) => `${String(p.count)} en el cielo${p.star === null ? '' : `, ${landmarkWord[p.star.word]} ${p.star.name}`}`,
      nothingNext: (time) => `Nada arriba · próximo ${time}`,
      nothing: 'Nada arriba ahora',
      hint: 'Estrellas bajo los arcos, arrastrá',
    },
  },
};
